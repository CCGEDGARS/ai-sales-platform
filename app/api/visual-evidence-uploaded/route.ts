import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

export const maxDuration = 300;

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
    let model = typeof body?.model === "string" && body.model ? body.model : DEFAULT_MODEL;

    if (!FILE_NAME.test(name) || !uri.startsWith(`${GEMINI_BASE}/`)) {
      return NextResponse.json({ ok: false, message: "Invalid uploaded Gemini file metadata." }, { status: 400 });
    }

    const prompt = `VISUAL EVIDENCE PASS — FACTUAL OBSERVATION ONLY\n\nYou are creating a timestamped factual visual evidence log for the Latvian television source “${originalFile}”. This is NOT a transcript and NOT an editorial interpretation. Record only meaningful observable evidence that is directly visible in the video or clearly audible as non-verbal behaviour.\n\nInclude useful production evidence such as: facial movements and reactions, glances, gestures, posture changes, pauses/silences, entrances and exits, objects and props, food/cooking states, spills or preparation mishaps, timing pressure visible on screen, background reactions, spatial behaviour and visible contradictions between an earlier action and a later action.\n\nSTRICT EVIDENCE RULES:\n- Never infer motives, emotions, relationships, intentions, private thoughts or personality.\n- Do not write “she is nervous”, “he is jealous”, “she dislikes it” or similar interpretation. Describe the observable evidence instead, for example: “Linda looks at the plate, raises her eyebrows and remains silent for several seconds.”\n- Do not transcribe or paraphrase spoken dialogue. Speech belongs exclusively to the authentic transcript channel.\n- Do not invent off-camera events or causal explanations.\n- Use participant names only when identity is unambiguous from the video context; otherwise use a neutral label such as “viesis” or “saimnieks”.\n- Select meaningful evidence; do not describe every frame or obvious routine action.\n- Put a timestamp relative to the beginning of the video at the start of every line.\n\nReturn ONLY factual evidence lines in fluent Latvian using exactly this format:\n[HH:MM:SS] VISUAL: <one concise observable fact>\n\nIf no meaningful visual evidence is available at a moment, omit it. Never add interpretation.`;

    let { response, data } = await generate(uri, mimeType, prompt, apiKey, model);
    if (!response.ok && model !== FALLBACK_MODEL && isModelAvailabilityError(response.status, data)) {
      model = FALLBACK_MODEL;
      ({ response, data } = await generate(uri, mimeType, prompt, apiKey, model));
    }
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: data?.error?.message || `Gemini visual evidence pass failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }

    const visualEvidence = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();

    if (!visualEvidence) {
      return NextResponse.json({ ok: false, message: "Gemini returned no visual evidence." }, { status: 502 });
    }

    const evidenceLines = visualEvidence
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);
    const validEvidenceLine = /^\[\d{2}:\d{2}:\d{2}\]\s+VISUAL:\s+\S.+$/;
    if (!evidenceLines.length || !evidenceLines.every((line: string) => validEvidenceLine.test(line))) {
      return NextResponse.json(
        { ok: false, message: "Gemini returned visual evidence outside the strict [HH:MM:SS] VISUAL factual-log format." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      fileName: originalFile,
      visualEvidence: evidenceLines.join("\n"),
      model,
      timecodes: true,
      evidenceType: "observable-facts-only",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "The visual evidence pass failed." },
      { status: 502 },
    );
  }
}
