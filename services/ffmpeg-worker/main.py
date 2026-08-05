import json
import os
import re
import shutil
import subprocess
import tempfile
import asyncio
from dataclasses import dataclass
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI(title="DANA AI Native FFmpeg Worker", version="1.0.0")
GEMINI_BASE = "https://generativelanguage.googleapis.com"


@app.get("/health")
def health():
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    return {
        "ok": bool(ffmpeg and ffprobe),
        "version": "native-ffmpeg-1.1",
        "ffmpeg": bool(ffmpeg),
        "ffprobe": bool(ffprobe),
    }


def run(command: list[str]) -> str:
    result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=900)
    if result.returncode:
        raise RuntimeError(result.stderr[-1200:] or "FFmpeg command failed")
    return result.stdout.strip()


def duration(path: Path) -> float:
    value = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    seconds = float(value)
    if seconds <= 0:
        raise RuntimeError("Could not read the source video duration")
    return seconds


def timestamp(seconds: float) -> str:
    total = max(0, round(seconds))
    return f"[{total // 3600:02d}:{(total % 3600) // 60:02d}:{total % 60:02d}]"


def offset_transcript(text: str, offset: float) -> str:
    pattern = re.compile(r"\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?")

    def replace(match: re.Match) -> str:
        a, b, c = match.groups()
        local = int(a) * 3600 + int(b) * 60 + (int(c) if c else 0)
        return timestamp(local + offset)

    return pattern.sub(replace, text)


def merge(items: list[tuple[str, float]]) -> str:
    lines: list[str] = []
    for text, offset in items:
        for line in offset_transcript(text, offset).splitlines():
            line = re.sub(r"\s+", " ", line.strip())
            if not line:
                continue
            body = re.sub(r"^\[[^\]]+\]\s*", "", line).lower()
            previous = re.sub(r"^\[[^\]]+\]\s*", "", lines[-1]).lower() if lines else ""
            if body and body == previous:
                continue
            lines.append(line)
    return "\n".join(lines)


async def gemini_upload(path: Path, api_key: str):
    data = path.read_bytes()
    async with httpx.AsyncClient(timeout=300) as client:
        start = await client.post(f"{GEMINI_BASE}/upload/v1beta/files", headers={"x-goog-api-key": api_key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": str(len(data)), "X-Goog-Upload-Header-Content-Type": "video/mp4", "Content-Type": "application/json"}, json={"file": {"display_name": path.name}})
        start.raise_for_status()
        upload_url = start.headers.get("x-goog-upload-url")
        if not upload_url:
            raise RuntimeError("Gemini did not return an upload URL")
        uploaded = await client.post(upload_url, headers={"Content-Length": str(len(data)), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize", "Content-Type": "video/mp4"}, content=data)
        uploaded.raise_for_status()
        return uploaded.json()["file"]


async def gemini_transcribe(file_data: dict, api_key: str, model: str, original: str, reference_manifest: str):
    async with httpx.AsyncClient(timeout=300) as client:
        name = file_data["name"]
        for _ in range(120):
            status = await client.get(f"{GEMINI_BASE}/v1beta/{name}", headers={"x-goog-api-key": api_key})
            status.raise_for_status()
            payload = status.json()
            file_status = payload.get("file") or payload
            state = file_status.get("state", "PROCESSING")
            if state == "ACTIVE":
                break
            if state == "FAILED":
                detail = (file_status.get("error") or {}).get("message")
                raise RuntimeError(detail or f"Gemini failed to prepare {original}")
            await asyncio.sleep(5)
        else:
            raise RuntimeError(f"Gemini is still preparing {original} after 10 minutes")
        prompt = f"Transcribe this video segment word-for-word in fluent Latvian. Original file: {original}. Put [HH:MM:SS] at every new phrase, speaker change or significant pause, relative to this segment. Preserve interruptions, laughter, repetitions and unclear audio as [neskaidrs]. Return only the timecoded transcript; never invent or summarize.\n\nSeven applied production references are active as editorial guardrails. They must not alter the factual transcript, but they are part of the registered production context:\n{reference_manifest}"
        response = await client.post(f"{GEMINI_BASE}/v1beta/models/{model}:generateContent", headers={"x-goog-api-key": api_key, "Content-Type": "application/json"}, json={"contents": [{"parts": [{"file_data": {"mime_type": file_data.get("mimeType", "video/mp4"), "file_uri": file_data["uri"]}}, {"text": prompt}]}]})
        response.raise_for_status()
        parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "\n".join(part.get("text", "") for part in parts).strip()
        if not text or not re.search(r"\[?\d{1,2}:\d{2}(?::\d{2})?\]?", text):
            raise RuntimeError(f"Gemini returned no valid timecoded transcript for {original}")
        return text


@dataclass
class Segment:
    path: Path
    start: float
    original: str


async def transcribe_segment(segment: Segment, api_key: str, model: str, reference_manifest: str) -> tuple[str, float]:
    """Upload and transcribe one prepared segment.

    The returned offset is kept beside the transcript so concurrent work can
    never reorder or misalign the merged result.
    """
    uploaded = await gemini_upload(segment.path, api_key)
    transcript = await gemini_transcribe(uploaded, api_key, model, segment.original, reference_manifest)
    return transcript, segment.start


@app.post("/process")
async def process(files: list[UploadFile] = File(...), geminiApiKey: str = Form(...), model: str = Form("gemini-3.6-flash"), chunkLength: str = Form("10"), segmentInfo: str = Form("[]"), referenceManifest: str = Form("")):
    if not geminiApiKey.strip():
        return JSONResponse({"ok": False, "message": "Gemini API key is missing"}, status_code=400)
    root = Path(tempfile.mkdtemp(prefix="dana-ffmpeg-"))
    try:
        chunk = max(60, int(float(chunkLength) * 60))
        overlap = 3
        prepared: list[Segment] = []
        for incoming in files:
            source = root / Path(incoming.filename or "source.mp4").name
            source.write_bytes(await incoming.read())
            total = duration(source)
            starts = [0] if total <= 15 * 60 else list(range(0, int(total), chunk))
            for index, nominal in enumerate(starts):
                start = max(0, nominal - overlap if index else 0)
                length = min(total - start, chunk + (overlap if index and nominal + chunk < total else 0))
                segment = root / f"{source.stem}_segment_{index + 1:03d}.mp4"
                run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(start), "-i", str(source), "-t", str(length), "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero", str(segment)])
                prepared.append(Segment(segment, start, source.name))

        # Upload/transcribe a small bounded batch concurrently. This keeps the
        # fast FFmpeg stage fast without creating an unbounded Gemini burst.
        semaphore = asyncio.Semaphore(3)

        async def bounded(segment: Segment):
            async with semaphore:
                return await transcribe_segment(segment, geminiApiKey, model, referenceManifest)

        merged_items = await asyncio.gather(*(bounded(segment) for segment in prepared))
        merged = merge(merged_items)
        if not merged:
            raise RuntimeError("The merged transcript is empty")
        return {"ok": True, "model": model, "results": [{"fileName": "Merged transcript", "transcript": merged, "model": model, "timecodes": True}], "segmentCount": len(prepared), "processor": "native-ffmpeg", "overlapSeconds": overlap, "appliedReferenceCount": len([line for line in referenceManifest.splitlines() if re.match(r"^\d+\. ", line)])}
    except Exception as error:
        return JSONResponse({"ok": False, "message": str(error)}, status_code=502)
    finally:
        shutil.rmtree(root, ignore_errors=True)
