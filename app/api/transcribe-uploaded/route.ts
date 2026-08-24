import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";
const FILE_NAME = /^files\/[A-Za-z0-9_-]+$/;

function isModelAvailabilityError(status: number, data: unknown) {
  const detail = JSON.stringify(data || "").toLocaleLowerCase();
  return status === 404 || (detail.includes("model") && (
    detail.includes("not found") ||
    detail.includes("not supported") ||
    detail.includes("does not exist") ||
    detail.includes("unavailable")
  ));
}

async function generate(uri: string, mimeType: string, prompt: string, apiKey: string, model: string) {
  const response = await fetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ file_data: { mime_type: mimeType, file_uri: uri } }, { text: prompt }] }],
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function POST(request: Request) {
  try {
    const apiKey = await getStoredKey("gemini");
    if (!apiKey) return NextResponse.json({ ok: false, message: "Gemini API key is missing." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const uploaded = body?.uploadedFile || {};
    const name = typeof uploaded?.name === "string" ? uploaded.name.trim() : "";
    const uri = typeof uploaded?.uri === "string" ? uploaded.uri.trim() : "";
    const mimeType = typeof uploaded?.mimeType === "string" && uploaded.mimeType.startsWith("video/") ? uploaded.mimeType : "video/mp4";
    const originalFile = typeof body?.originalFile === "string" ? body.originalFile.trim() : "video";
    const referenceManifest = typeof body?.referenceManifest === "string" ? body.referenceManifest : "";
    let model = typeof body?.model === "string" && body.model ? body.model : DEFAULT_MODEL;

    if (!FILE_NAME.test(name) || !uri.startsWith(`${GEMINI_BASE}/`)) {
      return NextResponse.json({ ok: false, message: "Invalid uploaded Gemini file metadata." }, { status: 400 });
    }

    const prompt = `You are producing an authentic Latvian television transcript for the original file “${originalFile}”. Transcribe this video word-for-word in fluent Latvian without polishing, inventing, summarising, or omitting speech. Identify speakers when possible. Put a timestamp relative to the beginning of the video in [HH:MM:SS] format at the beginning of every new phrase, speaker change, or significant pause. Preserve interruptions, laughter, repetitions, and unclear audio as [neskaidrs]. Return only the timecoded transcript. Never fabricate a word.\n\nThe following applied references are active in this project. They are editorial guardrails only for later analysis; they must not change, polish, replace or hallucinate anything in this factual transcript:\n${referenceManifest}`;

    let { response, data } = await generate(uri, mimeType, prompt, apiKey, model);
    if (!response.ok && model !== FALLBACK_MODEL && isModelAvailabilityError(response.status, data)) {
      model = FALLBACK_MODEL;
      ({ response, data } = await generate(uri, mimeType, prompt, apiKey, model));
    }
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: data?.error?.message || `Gemini transcription failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }

    const transcript = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();
    if (!transcript) return NextResponse.json({ ok: false, message: "Gemini returned no transcript." }, { status: 502 });
    if (!/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/.test(transcript)) {
      return NextResponse.json({ ok: false, message: "Gemini returned text without usable timecodes." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, fileName: originalFile, transcript, model, timecodes: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "The uploaded video could not be transcribed." },
      { status: 502 },
    );
  }
}
