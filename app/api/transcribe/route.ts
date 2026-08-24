import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
// Current stable multimodal model. Keep this in one place so the connection
// test, direct video path and native worker use the same production default.
const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";

type SegmentInfo = { startSeconds: number; originalFile: string };

const NATIVE_FFMPEG_WORKER = (process.env.FFMPEG_WORKER_URL || "https://ffmpeg-worker-02na.onrender.com").replace(/\/$/, "");

async function uploadToGemini(file: File, apiKey: string) {
  const bytes = await file.arrayBuffer();
  const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": file.type || "video/mp4",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  });
  if (!start.ok) throw new Error(`Gemini file upload could not start for ${file.name} (HTTP ${start.status}).`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error(`Gemini did not return an upload URL for ${file.name}.`);
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": file.type || "video/mp4",
    },
    body: bytes,
  });
  const uploadedData = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !uploadedData?.file?.uri) throw new Error(uploadedData?.error?.message || `Gemini rejected ${file.name} (HTTP ${uploaded.status}).`);
  return { name: uploadedData.file.name as string, uri: uploadedData.file.uri as string, mimeType: uploadedData.file.mimeType || file.type || "video/mp4" };
}

async function waitUntilActive(name: string, apiKey: string) {
  // Gemini returns the state inside the `file` object. Poll long enough for
  // video preparation without treating a normal PROCESSING response as a
  // failure.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetch(`${GEMINI_BASE}/v1beta/${name}`, { headers: { "x-goog-api-key": apiKey } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini could not inspect the uploaded file (HTTP ${response.status}).`);
    const file = data?.file || data;
    const state = typeof file?.state === "string" ? file.state : "PROCESSING";
    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error(file?.error?.message || `Gemini failed while processing ${file?.displayName || "the uploaded video"}.`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Gemini is still preparing the uploaded video after 10 minutes. The request was stopped safely; try again or use a shorter segment.");
}

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function addOffset(transcript: string, offsetSeconds: number) {
  return transcript.replace(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g, (_match, a, b, c) => {
    const seconds = c === undefined ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c);
    return `[${formatTime(seconds + offsetSeconds)}]`;
  });
}

function mergeTranscripts(items: Array<{ transcript: string; startSeconds: number }>) {
  const lines: string[] = [];
  for (const item of items) {
    const adjusted = addOffset(item.transcript, item.startSeconds)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of adjusted) {
      const normalized = line.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, " ").toLocaleLowerCase("lv");
      const previous = lines.at(-1)?.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, " ").toLocaleLowerCase("lv");
      if (normalized && normalized === previous) continue;
      lines.push(line);
    }
  }
  return lines.join("\n");
}

function isModelAvailabilityError(status: number, data: unknown) {
  const detail = JSON.stringify(data || "").toLocaleLowerCase();
  return status === 404 || detail.includes("model") && (
    detail.includes("not found") ||
    detail.includes("not supported") ||
    detail.includes("does not exist") ||
    detail.includes("unavailable")
  );
}

async function transcribeWithModel(
  uri: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  model: string,
) {
  const response = await fetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ file_data: { mime_type: mimeType, file_uri: uri } }, { text: prompt }] }] }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const submittedKey = String(form.get("apiKey") || "").trim();
    const apiKey = submittedKey || await getStoredKey("gemini");
    const requestedModel = String(form.get("model") || DEFAULT_MODEL);
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    const processor = String(form.get("processor") || "browser");
    const referenceManifest = String(form.get("referenceManifest") || "");
    const segmentInfoRaw = String(form.get("segmentInfo") || "[]");
    let segmentInfo: SegmentInfo[] = [];
    try { segmentInfo = JSON.parse(segmentInfoRaw) as SegmentInfo[]; } catch { segmentInfo = []; }
    if (!apiKey) return NextResponse.json({ ok: false, message: "Gemini API key is missing. Save and connect Gemini first." }, { status: 400 });
    if (!files.length) return NextResponse.json({ ok: false, message: "No video files were submitted." }, { status: 400 });

    if (processor === "native") {
      if (!NATIVE_FFMPEG_WORKER) {
        return NextResponse.json({ ok: false, message: "Native FFmpeg is not connected. Configure FFMPEG_WORKER_URL before processing long videos." }, { status: 503 });
      }
      const nativeForm = new FormData();
      for (const file of files) nativeForm.append("files", file, file.name);
      nativeForm.append("segmentInfo", segmentInfoRaw);
      nativeForm.append("geminiApiKey", apiKey);
      nativeForm.append("model", requestedModel);
      nativeForm.append("chunkLength", String(form.get("chunkLength") || "10"));
      nativeForm.append("referenceManifest", referenceManifest);
      const nativeResponse = await fetch(`${NATIVE_FFMPEG_WORKER}/process`, { method: "POST", body: nativeForm });
      const nativeData = await nativeResponse.json().catch(() => ({}));
      if (!nativeResponse.ok || !nativeData?.ok) {
        return NextResponse.json({ ok: false, message: nativeData?.message || `Native FFmpeg worker failed (HTTP ${nativeResponse.status}).` }, { status: 502 });
      }
      return NextResponse.json(nativeData);
    }
    const results: Array<{ fileName: string; transcript: string; model: string; timecodes: boolean; startSeconds: number; originalFile: string }> = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const info = segmentInfo[index] || { startSeconds: 0, originalFile: file.name };
      const uploaded = await uploadToGemini(file, apiKey);
      await waitUntilActive(uploaded.name, apiKey);
      const prompt = `You are producing an authentic Latvian television transcript for the original file “${info.originalFile}”. Transcribe this segment word-for-word in fluent Latvian without polishing, inventing, summarising, or omitting speech. Identify speakers when possible. Put a timestamp relative to the beginning of THIS SEGMENT in [HH:MM:SS] format at the beginning of every new phrase, speaker change, or significant pause. Preserve interruptions, laughter, repetitions, and unclear audio as [neskaidrs]. Return only the timecoded transcript. The production system will add the original segment offset later. Never fabricate a word.

Seven applied reference sources are active as editorial guardrails. They must not alter the factual transcript, but the production pipeline must register that they were consulted:
${referenceManifest}`;
      let activeModel = requestedModel;
      let { response, data } = await transcribeWithModel(uploaded.uri, uploaded.mimeType, prompt, apiKey, activeModel);
      if (!response.ok && activeModel !== FALLBACK_MODEL && isModelAvailabilityError(response.status, data)) {
        activeModel = FALLBACK_MODEL;
        ({ response, data } = await transcribeWithModel(uploaded.uri, uploaded.mimeType, prompt, apiKey, activeModel));
      }
      if (!response.ok) {
        const detail = data?.error?.message || data?.error?.status || `HTTP ${response.status}`;
        throw new Error(`Gemini transcription failed for ${file.name} using ${activeModel}: ${detail}`);
      }
      const transcript = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
      if (!transcript) throw new Error(`Gemini returned no transcript for ${file.name}.`);
      results.push({ fileName: file.name, transcript, model: activeModel, timecodes: /\[?\d{1,2}:\d{2}(?::\d{2})?\]?/.test(transcript), startSeconds: Number(info.startSeconds) || 0, originalFile: info.originalFile });
    }
    const merged = mergeTranscripts(results);
    if (!merged || !results.every((result) => result.timecodes)) throw new Error("The returned transcript did not contain valid timecodes for every segment.");
    return NextResponse.json({ ok: true, model: results[0]?.model || requestedModel, requestedModel, results: [{ fileName: "Merged transcript", transcript: merged, model: results[0]?.model || requestedModel, timecodes: true }], segmentResults: results, segmentCount: files.length, appliedReferenceCount: referenceManifest ? referenceManifest.split(/\n(?=\d+\. )/).filter(Boolean).length : 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "The transcription request failed." }, { status: 502 });
  }
}
