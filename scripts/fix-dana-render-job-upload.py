from pathlib import Path
import re
import sys

ROOT = Path('.')
TEST = ROOT / 'tests/rendered-html.test.mjs'
PAGE = ROOT / 'app/page.tsx'
WORKER = ROOT / 'services/ffmpeg-worker/main.py'
ROUTE = ROOT / 'app/api/native-job-ticket/route.ts'

TEST_BLOCK = r'''

test("large videos bypass both Vercel body limits and Gemini browser CORS", () => {
  const worker = fs.readFileSync("services/ffmpeg-worker/main.py", "utf8");
  assert.match(page, /fetch\("\/api\/native-job-ticket"/);
  assert.match(page, /fetch\(ticket\.uploadUrl/);
  assert.match(page, /fetch\(ticket\.processUrl/);
  assert.doesNotMatch(page, /fetch\(session\.uploadUrl/);
  assert.match(worker, /CORSMiddleware/);
  assert.match(worker, /@app\.post\("\/jobs\/authorize"\)/);
  assert.match(worker, /@app\.post\("\/jobs\/\{token\}\/upload"\)/);
  assert.match(worker, /@app\.post\("\/jobs\/\{token\}\/process"\)/);
  assert.match(worker, /await file\.read\(1024 \* 1024\)/);
  assert.ok(fs.existsSync("app/api/native-job-ticket/route.ts"));
});
'''

ROUTE_CONTENT = r'''import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const NATIVE_FFMPEG_WORKER = (process.env.FFMPEG_WORKER_URL || "https://ffmpeg-worker-02na.onrender.com").replace(/\/$/, "");

export async function POST(request: Request) {
  try {
    const apiKey = await getStoredKey("gemini");
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "Gemini API key is missing. Save and connect Gemini first." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const originalFile = typeof body?.originalFile === "string" ? body.originalFile.trim() : "";
    const fileSize = Number(body?.fileSize || 0);
    const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "video/mp4";
    const model = typeof body?.model === "string" && body.model ? body.model : "gemini-3.6-flash";
    const chunkLength = String(body?.chunkLength || "10");
    const referenceManifest = typeof body?.referenceManifest === "string" ? body.referenceManifest : "";

    if (!originalFile || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ ok: false, message: "Valid video metadata is required." }, { status: 400 });
    }

    const token = crypto.randomUUID();
    const authorize = await fetch(`${NATIVE_FFMPEG_WORKER}/jobs/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        geminiApiKey: apiKey,
        originalFile,
        fileSize,
        mimeType,
        model,
        chunkLength,
        referenceManifest,
      }),
      cache: "no-store",
    });
    const authorizeData = await authorize.json().catch(() => ({}));
    if (!authorize.ok || !authorizeData?.ok) {
      return NextResponse.json(
        { ok: false, message: authorizeData?.message || `Native upload session could not start (HTTP ${authorize.status}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      uploadUrl: `${NATIVE_FFMPEG_WORKER}/jobs/${encodeURIComponent(token)}/upload`,
      processUrl: `${NATIVE_FFMPEG_WORKER}/jobs/${encodeURIComponent(token)}/process`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "The native upload session could not be created." },
      { status: 502 },
    );
  }
}
'''

NEW_PAGE_BLOCK = r'''  const transcribeVideoDirectly = async (
    file: File,
    _apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ): Promise<TranscriptResult> => {
    onUpdate(`Creating a secure upload job for ${file.name}…`, 38);
    const ticketResponse = await fetch("/api/native-job-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFile: file.name,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
        model: GEMINI_DIRECT_MODEL,
        chunkLength,
        referenceManifest: buildReferenceBrief(appliedSources),
      }),
    });
    const ticket = await ticketResponse.json().catch(() => ({}));
    if (!ticketResponse.ok || !ticket?.ok || !ticket?.uploadUrl || !ticket?.processUrl) {
      throw new Error(ticket?.message || `Secure upload job could not start (HTTP ${ticketResponse.status}).`);
    }

    onUpdate(`Uploading ${file.name} directly to the native processor…`, 42);
    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);
    const uploadResponse = await fetch(ticket.uploadUrl, {
      method: "POST",
      body: uploadForm,
    });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadData?.ok) {
      throw new Error(uploadData?.message || `Native upload failed (HTTP ${uploadResponse.status}).`);
    }

    onUpdate("Upload complete. Native FFmpeg is preparing segments and Gemini is transcribing…", 65);
    const processResponse = await fetch(ticket.processUrl, { method: "POST" });
    const processData = await processResponse.json().catch(() => ({}));
    if (!processResponse.ok || !processData?.ok) {
      throw new Error(processData?.message || `Native transcription failed (HTTP ${processResponse.status}).`);
    }
    const result = processData?.results?.[0];
    if (!result?.transcript || result?.timecodes !== true) {
      throw new Error("The native processor returned no validated timecoded transcript.");
    }
    onUpdate("Transcript returned and timecodes validated.", 90);
    return {
      fileName: result.fileName || file.name,
      transcript: result.transcript,
      model: result.model || GEMINI_DIRECT_MODEL,
      timecodes: true,
    };
  };
'''


def add_test():
    text = TEST.read_text()
    if 'large videos bypass both Vercel body limits and Gemini browser CORS' not in text:
        TEST.write_text(text.rstrip() + TEST_BLOCK + '\n')


def patch_page():
    text = PAGE.read_text()
    pattern = re.compile(r'  const uploadVideoDirectlyToGemini = async \(file: File\) => \{[\s\S]*?\n  const chooseFile = \(\) => fileInput\.current\?\.click\(\);')
    replacement = NEW_PAGE_BLOCK + '  const chooseFile = () => fileInput.current?.click();'
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f'Could not replace direct Gemini browser upload block; matches={count}')
    PAGE.write_text(updated)


def patch_worker():
    text = WORKER.read_text()
    text = text.replace('import tempfile\nimport asyncio\n', 'import tempfile\nimport asyncio\nimport time\n\n')
    text = text.replace('from fastapi import FastAPI, File, Form, UploadFile\n', 'from fastapi import FastAPI, File, Form, UploadFile\nfrom fastapi.middleware.cors import CORSMiddleware\n')
    text = text.replace('app = FastAPI(title="DANA AI Native FFmpeg Worker", version="1.0.0")\n', '''app = FastAPI(title="DANA AI Native FFmpeg Worker", version="1.2.0")\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["https://dana-studio-jet.vercel.app"],\n    allow_origin_regex=r"https://.*\\.vercel\\.app",\n    allow_methods=["POST", "OPTIONS"],\n    allow_headers=["*"],\n)\n''')
    text = text.replace('"version": "native-ffmpeg-1.1",', '"version": "native-ffmpeg-1.2-job-upload",')

    marker = '\n\n@app.post("/process")\n'
    if marker not in text:
        raise SystemExit('Could not find /process marker in worker')

    jobs_code = r'''

JOB_ROOT = Path(tempfile.gettempdir()) / "dana-ai-native-jobs"
JOB_ROOT.mkdir(parents=True, exist_ok=True)
JOBS: dict[str, dict] = {}
JOB_TTL_SECONDS = 30 * 60


def cleanup_expired_jobs():
    now = time.time()
    expired = [token for token, job in JOBS.items() if now - float(job.get("created", now)) > JOB_TTL_SECONDS]
    for token in expired:
        job = JOBS.pop(token, None)
        if job:
            shutil.rmtree(Path(job["root"]), ignore_errors=True)


@app.post("/jobs/authorize")
async def authorize_job(payload: dict):
    cleanup_expired_jobs()
    token = str(payload.get("token") or "").strip()
    api_key = str(payload.get("geminiApiKey") or "").strip()
    original = Path(str(payload.get("originalFile") or "source.mp4")).name
    if not token or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", token):
        return JSONResponse({"ok": False, "message": "Invalid upload token"}, status_code=400)
    if not api_key:
        return JSONResponse({"ok": False, "message": "Gemini API key is missing"}, status_code=400)
    root = JOB_ROOT / token
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True, exist_ok=True)
    JOBS[token] = {
        "created": time.time(),
        "root": str(root),
        "api_key": api_key,
        "original": original,
        "model": str(payload.get("model") or "gemini-3.6-flash"),
        "chunk_length": str(payload.get("chunkLength") or "10"),
        "reference_manifest": str(payload.get("referenceManifest") or ""),
        "mime_type": str(payload.get("mimeType") or "video/mp4"),
        "expected_size": int(payload.get("fileSize") or 0),
        "uploaded": False,
    }
    return {"ok": True, "token": token}


@app.post("/jobs/{token}/upload")
async def upload_job(token: str, file: UploadFile = File(...)):
    cleanup_expired_jobs()
    job = JOBS.get(token)
    if not job:
        return JSONResponse({"ok": False, "message": "Upload job expired or was not authorized"}, status_code=404)
    source = Path(job["root"]) / Path(file.filename or job["original"]).name
    written = 0
    try:
        with source.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                written += len(chunk)
        expected = int(job.get("expected_size") or 0)
        if expected and written != expected:
            source.unlink(missing_ok=True)
            return JSONResponse({"ok": False, "message": f"Upload size mismatch: expected {expected} bytes, received {written}."}, status_code=400)
        job["path"] = str(source)
        job["uploaded"] = True
        return {"ok": True, "bytes": written, "fileName": source.name}
    except Exception as error:
        source.unlink(missing_ok=True)
        return JSONResponse({"ok": False, "message": str(error)}, status_code=502)


@app.post("/jobs/{token}/process")
async def process_job(token: str):
    cleanup_expired_jobs()
    job = JOBS.get(token)
    if not job or not job.get("uploaded") or not job.get("path"):
        return JSONResponse({"ok": False, "message": "The upload job is missing or incomplete"}, status_code=404)
    root = Path(job["root"])
    source = Path(job["path"])
    try:
        total = duration(source)
        chunk = max(60, int(float(job["chunk_length"]) * 60))
        overlap = 3
        starts = [0] if total <= 15 * 60 else list(range(0, int(total), chunk))
        prepared: list[Segment] = []
        for index, nominal in enumerate(starts):
            start = max(0, nominal - overlap if index else 0)
            length = min(total - start, chunk + (overlap if index and nominal + chunk < total else 0))
            segment = root / f"{source.stem}_segment_{index + 1:03d}.mp4"
            run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(start), "-i", str(source), "-t", str(length), "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero", str(segment)])
            prepared.append(Segment(segment, start, job["original"]))

        semaphore = asyncio.Semaphore(3)

        async def bounded(segment: Segment):
            async with semaphore:
                return await transcribe_segment(segment, job["api_key"], job["model"], job["reference_manifest"])

        merged_items = await asyncio.gather(*(bounded(segment) for segment in prepared))
        merged = merge(merged_items)
        if not merged:
            raise RuntimeError("The merged transcript is empty")
        return {
            "ok": True,
            "model": job["model"],
            "results": [{"fileName": job["original"], "transcript": merged, "model": job["model"], "timecodes": True}],
            "segmentCount": len(prepared),
            "processor": "native-ffmpeg-direct-job",
            "overlapSeconds": overlap,
        }
    except Exception as error:
        return JSONResponse({"ok": False, "message": str(error)}, status_code=502)
    finally:
        JOBS.pop(token, None)
        shutil.rmtree(root, ignore_errors=True)
'''
    text = text.replace(marker, jobs_code + marker, 1)
    WORKER.write_text(text)


def apply():
    add_test()
    ROUTE.parent.mkdir(parents=True, exist_ok=True)
    ROUTE.write_text(ROUTE_CONTENT)
    patch_page()
    patch_worker()


if __name__ == '__main__':
    if '--tests-only' in sys.argv:
        add_test()
    elif '--apply' in sys.argv:
        apply()
    else:
        raise SystemExit('Use --tests-only or --apply')
