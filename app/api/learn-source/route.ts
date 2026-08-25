import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";
import { buildLearningAnalysisInput } from "../../lib/learning-contract";
import { learningProfileChunks, parseLearningProfile, verifyLearningProfile } from "../../lib/learning-profile";
import {
  getLearningSource,
  recordLearningEvent,
  replaceLearningChunks,
  saveLearningProfile,
  saveLearningSourceContent,
  updateLearningSource,
} from "../../lib/learning-repository";
import type { LearningContentKind } from "../../lib/learning-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const PRIMARY_LEARNING_MODEL = "gpt-5.6-sol";
const MAX_SOURCE_CHARACTERS = 220_000;

type OpenAIResponse = {
  id?: string;
  status?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string } | null;
};

function responseText(data: OpenAIResponse) {
  if (String(data.output_text || "").trim()) return String(data.output_text).trim();
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => String(item.text).trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function openAIKey() {
  const key = await getStoredKey("openai");
  if (!key) throw new Error("OpenAI is not connected. Connect OpenAI before DANA can extract and verify learning.");
  return key;
}

async function openAIFetch(path: string, apiKey: string, init: RequestInit = {}) {
  const response = await fetch(`${OPENAI_RESPONSES_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI learning request failed (HTTP ${response.status}).`);
  }
  return data;
}

async function failSource(request: Request, sourceId: string, message: string) {
  try {
    await updateLearningSource(request, sourceId, { status: "needs-attention" });
    await recordLearningEvent(request, sourceId, "learning", "failed", message);
  } catch {}
}

export async function POST(request: Request) {
  let sourceId = "";
  try {
    const body = (await request.json()) as {
      sourceId?: string;
      content?: string;
      contentKind?: LearningContentKind;
      language?: string;
      durationSeconds?: number | null;
    };
    sourceId = String(body.sourceId || "");
    const content = String(body.content || "").trim();
    const contentKind = body.contentKind;
    if (!sourceId || !content || !contentKind) {
      return NextResponse.json(
        { ok: false, message: "Source ID, complete source truth and content kind are required." },
        { status: 400 },
      );
    }
    const source = await getLearningSource(request, sourceId);
    if (!source) return NextResponse.json({ ok: false, message: "Learning source not found." }, { status: 404 });

    await updateLearningSource(request, sourceId, {
      status: contentKind === "video-transcript" ? "transcribing" : "extracting",
    });
    await saveLearningSourceContent(request, sourceId, {
      content,
      contentKind,
      language: body.language || "lv",
      durationSeconds: body.durationSeconds ?? null,
    });
    await recordLearningEvent(request, sourceId, "source-truth", "success", "Complete source truth persisted before learning analysis.");
    await updateLearningSource(request, sourceId, { status: "analyzing" });

    const apiKey = await openAIKey();
    const input = buildLearningAnalysisInput({
      filename: source.originalFilename,
      sourceType: source.sourceType,
      authority: source.authority,
      contentKind,
      content: content.slice(0, MAX_SOURCE_CHARACTERS),
    });
    const data = await openAIFetch("", apiKey, {
      method: "POST",
      body: JSON.stringify({
        model: PRIMARY_LEARNING_MODEL,
        background: true,
        store: true,
        input,
        metadata: {
          kind: "dana-workspace-learning",
          sourceId,
          sourceFilename: source.originalFilename.slice(0, 200),
        },
      }),
    });
    if (!data.id) throw new Error("OpenAI did not return a durable learning job ID.");
    await recordLearningEvent(request, sourceId, "analyzing", "queued", `Background learning job ${data.id} started.`);
    return NextResponse.json({
      ok: true,
      sourceId,
      responseId: data.id,
      status: data.status || "queued",
      phase: "analyzing",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DANA source learning failed to start.";
    if (sourceId) await failSource(request, sourceId, message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceId = url.searchParams.get("sourceId") || "";
  const responseId = url.searchParams.get("responseId") || "";
  if (!sourceId || !responseId) {
    return NextResponse.json({ ok: false, message: "sourceId and responseId are required." }, { status: 400 });
  }
  try {
    const apiKey = await openAIKey();
    const data = await openAIFetch(`/${encodeURIComponent(responseId)}`, apiKey);
    if (data.status === "queued" || data.status === "in_progress") {
      await updateLearningSource(request, sourceId, { status: "extracting-learning" });
      return NextResponse.json({ ok: true, sourceId, responseId, status: data.status, phase: "extracting-learning" });
    }
    if (data.status !== "completed") {
      const message = data.error?.message || `Learning job ended with status ${String(data.status || "unknown")}.`;
      await failSource(request, sourceId, message);
      return NextResponse.json({ ok: false, sourceId, responseId, status: data.status || "failed", message }, { status: 502 });
    }

    await updateLearningSource(request, sourceId, { status: "verifying" });
    await recordLearningEvent(request, sourceId, "verifying", "started", "Validating learned editorial essence against DANA profile requirements.");
    const text = responseText(data);
    if (!text) throw new Error("OpenAI completed the learning job without a usable profile.");
    const parsed = parseLearningProfile(sourceId, text);
    const profile = verifyLearningProfile(parsed);
    const source = await getLearningSource(request, sourceId);
    if (!source) throw new Error("Learning source disappeared before verification completed.");
    await saveLearningProfile(request, sourceId, profile);

    if (!profile.verification.verified) {
      await updateLearningSource(request, sourceId, {
        status: "needs-attention",
        modelProvenance: { learningModel: PRIMARY_LEARNING_MODEL, responseId },
      });
      await recordLearningEvent(
        request,
        sourceId,
        "verifying",
        "failed",
        profile.verification.notes.join(" ") || "Learning profile did not meet verification threshold.",
      );
      return NextResponse.json({
        ok: true,
        sourceId,
        responseId,
        status: "needs-attention",
        phase: "verifying",
        profile,
        message: "Source truth is saved, but the learning profile needs attention before DANA will reuse it.",
      });
    }

    const chunks = learningProfileChunks(profile, source.authority);
    await replaceLearningChunks(request, sourceId, chunks);
    const learnedAt = new Date().toISOString();
    const learnedSource = await updateLearningSource(request, sourceId, {
      status: "learned",
      learnedAt,
      modelProvenance: { learningModel: PRIMARY_LEARNING_MODEL, responseId },
    });
    await recordLearningEvent(request, sourceId, "verifying", "success", "Learning profile verified and activated workspace-wide.");
    return NextResponse.json({
      ok: true,
      sourceId,
      responseId,
      status: "learned",
      phase: "learned",
      source: learnedSource,
      profile,
      chunks: chunks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DANA source learning failed.";
    await failSource(request, sourceId, message);
    return NextResponse.json({ ok: false, sourceId, responseId, message }, { status: 500 });
  }
}
