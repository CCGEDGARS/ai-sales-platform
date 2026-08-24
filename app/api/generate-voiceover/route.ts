import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

export const maxDuration = 120;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const REQUIRED_REFERENCE_COUNT = 7;
const VOICEOVER_RATIO_TARGET = 1 / 6;
const VOICEOVER_RATIO_TOLERANCE = 0.005;
const VOICEOVER_WPM = 130;
const MAX_RATIO_REWRITES = 1;
const OPENAI_CALL_TIMEOUT_MS = 45_000;
const CORRECTION_TIMEOUT_MS = 25_000;
const PRIMARY_VOICEOVER_MODEL = "gpt-5.6-sol";
const FALLBACK_VOICEOVER_MODEL = "gpt-5.6-terra";
const DEFAULT_TONE = "Lepers Standard · premium observational comedy";

const RATIO_REFERENCE_SOURCES = [
  "Come Dine With Me.mp4",
  "Ainārs Ašaks · 15.12.2011",
  "Ieva Janiševa · Season 3",
];

const TONE_PROFILES: Record<string, string> = {
  [DEFAULT_TONE]:
    "LEPERS STANDARD. Premium Latvian observational reality-TV narration: warm, intelligent, dryly amused, character-focused and lightly mischievous. Build humour from the gap between intention, words and what the viewer can see. Use understatement, precise observation, awkward pauses, reactions, delayed punchlines, unexpected comparisons, gentle sarcasm and callbacks. Never humiliate participants, never invent facts, never describe obvious actions, and never copy wording from references.",
  "Observational · sharp, warm and lightly humorous":
    "OBSERVATIONAL. Notice the social detail others miss. Use warm precision, character-specific irony and clean comic turns. Never mock vulnerability or narrate the obvious.",
  "Dry irony · understated and precise":
    "DRY IRONY. Underplay. Use economical sentences, deadpan understatement and surgical contrast. Avoid hype, broad sarcasm and obvious punchlines.",
  "Warm human · intimate and empathetic":
    "WARM HUMAN. Lead with curiosity and emotional intelligence. Notice effort, nerves, pride and small acts of courage. Use gentle humour and protect participant dignity.",
  "Rising tension · cinematic and controlled":
    "RISING TENSION. Build a controlled dramatic arc from verified behaviour, timing and contradiction. Use short sentences at turning points. Never invent stakes.",
  "Fast bridge · concise and energetic":
    "FAST BRIDGE. Compact sentences, active verbs and strong transitions. Every line must move the story or sharpen expectation. No decorative filler.",
  "Classic · British original":
    "CLASSIC BRITISH FORMAT. Dry, clever, lightly cheeky and socially observant. Use elegant understatement and comic reversals. Avoid hype, melodrama and direct insults.",
};

type OpenAIOutputItem = { type?: string; text?: string };
type OpenAIResponseData = {
  output_text?: string;
  output?: Array<{ content?: OpenAIOutputItem[] }>;
  error?: { code?: string; message?: string } | null;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
};

type Attempt = {
  response: Response | null;
  data: OpenAIResponseData;
  timedOut: boolean;
  transportError?: string;
};

function spokenWordCount(text: string) {
  return (
    text
      .replace(/^\s*(?:\[[^\]]+\]|\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s*/gm, "")
      .replace(/^[A-ZĀČĒĢĪĶĻŅŠŪŽ][^:]{0,40}:\s*/gm, "")
      .match(/[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+(?:[-'][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+)*/g)?.length || 0
  );
}

function ratioMetrics(text: string, finalRuntimeSeconds: number) {
  const words = spokenWordCount(text);
  const spokenSeconds = (words / VOICEOVER_WPM) * 60;
  const ratio = finalRuntimeSeconds > 0 ? spokenSeconds / finalRuntimeSeconds : 0;
  return {
    words,
    spokenSeconds: Math.round(spokenSeconds),
    ratio,
    ratioPercent: Number((ratio * 100).toFixed(2)),
    targetPercent: Number((VOICEOVER_RATIO_TARGET * 100).toFixed(2)),
    lowerPercent: Number(((VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE) * 100).toFixed(2)),
    upperPercent: Number(((VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE) * 100).toFixed(2)),
    passes:
      finalRuntimeSeconds > 0 &&
      Math.abs(ratio - VOICEOVER_RATIO_TARGET) <= VOICEOVER_RATIO_TOLERANCE,
  };
}

function responseText(data: OpenAIResponseData) {
  const direct = String(data.output_text || "").trim();
  if (direct) return direct;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => String(item.text || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function modelUnavailable(attempt: Attempt) {
  const status = attempt.response?.status || 0;
  const detail = JSON.stringify(attempt.data || "").toLowerCase();
  return (
    status === 404 ||
    status === 403 ||
    (detail.includes("model") &&
      (detail.includes("not found") ||
        detail.includes("not exist") ||
        detail.includes("unavailable") ||
        detail.includes("access")))
  );
}

function retryable(attempt: Attempt) {
  const status = attempt.response?.status || 0;
  const text = responseText(attempt.data);
  return (
    attempt.timedOut ||
    modelUnavailable(attempt) ||
    status >= 500 ||
    (attempt.response?.ok === true && !text) ||
    attempt.data.status === "incomplete"
  );
}

async function requestModel({
  apiKey,
  model,
  system,
  user,
  timeoutMs,
  maxOutputTokens = 8_000,
}: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens?: number;
}): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        max_output_tokens: maxOutputTokens,
        text: { verbosity: "medium" },
        service_tier: "auto",
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as OpenAIResponseData;
    return { response, data, timedOut: false };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      response: null,
      data: {},
      timedOut,
      transportError:
        error instanceof Error
          ? error.message
          : "OpenAI request transport failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function attemptMessage(attempt: Attempt, label: string) {
  if (attempt.timedOut) return `${label} timed out before returning a script.`;
  if (attempt.transportError) return `${label} transport error: ${attempt.transportError}`;
  const status = attempt.response?.status || 0;
  return (
    attempt.data.error?.message ||
    attempt.incomplete_details?.reason ||
    `${label} failed${status ? ` (HTTP ${status})` : ""}.`
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = (await request.json()) as {
      apiKey?: string;
      transcript?: string;
      prompt?: string;
      tone?: string;
      context?: string;
      appliedSources?: string[];
      finalRuntimeSeconds?: number;
    };

    const apiKey = String(body.apiKey || "").trim() || (await getStoredKey("openai"));
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "OpenAI API key is missing. Connect OpenAI in Settings first.", requestId },
        { status: 400 },
      );
    }
    if (!body.transcript?.trim()) {
      return NextResponse.json(
        { ok: false, message: "A validated transcript is required before generating voice-over.", requestId },
        { status: 400 },
      );
    }

    const appliedSources = Array.isArray(body.appliedSources) ? body.appliedSources : [];
    if (appliedSources.length < REQUIRED_REFERENCE_COUNT) {
      return NextResponse.json(
        {
          ok: false,
          message: `Voice-over is blocked until all ${REQUIRED_REFERENCE_COUNT} protected production references are applied.`,
          requestId,
        },
        { status: 400 },
      );
    }

    const finalRuntimeSeconds = Number(body.finalRuntimeSeconds || 0);
    if (!Number.isFinite(finalRuntimeSeconds) || finalRuntimeSeconds <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "The final video runtime is required so the mandatory voice-over ratio can be enforced.",
          requestId,
        },
        { status: 400 },
      );
    }

    const targetWords = Math.round(
      ((finalRuntimeSeconds * VOICEOVER_RATIO_TARGET) / 60) * VOICEOVER_WPM,
    );
    const lowerWords = Math.ceil(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE)) / 60) *
        VOICEOVER_WPM,
    );
    const upperWords = Math.floor(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE)) / 60) *
        VOICEOVER_WPM,
    );
    const selectedTone = String(body.tone || DEFAULT_TONE);
    const toneProfile = TONE_PROFILES[selectedTone] || TONE_PROFILES[DEFAULT_TONE];

    const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer for Gandrīz ideālas vakariņas. Write fluent, natural, witty Latvian television narration. Never invent facts or events not present in the transcript. Never imitate wording from a reference. Do not explain obvious actions. Protect participant dignity. Return only the production-ready voice-over script with useful timecode anchors where the transcript supports them.\n\nSELECTED TONE: ${selectedTone}\n${toneProfile}`;

    const baseUser = `Create the final Latvian voice-over for this scene.\nFinal runtime: ${Math.round(finalRuntimeSeconds)} seconds.\nTarget spoken words: ${targetWords}. HARD accepted word range: ${lowerWords}-${upperWords} words, corresponding to 16.17%-17.17% of runtime at 130 words/minute. Count carefully before answering.\nEditorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}\n\nApplied reference calibration: ${RATIO_REFERENCE_SOURCES.join(", ")}.\nApplied production context:\n${body.context || "No reference manifest supplied."}\n\nSOURCE TRANSCRIPT:\n${body.transcript}`;

    const configuredModel = process.env.OPENAI_VOICEOVER_MODEL || PRIMARY_VOICEOVER_MODEL;
    let activeModel = configuredModel;
    let primary = await requestModel({
      apiKey,
      model: activeModel,
      system,
      user: baseUser,
      timeoutMs: OPENAI_CALL_TIMEOUT_MS,
    });
    let text = responseText(primary.data);

    if ((!primary.response?.ok || !text || primary.data.status === "incomplete") && retryable(primary)) {
      console.warn("DANA voice-over primary attempt required fallback", {
        requestId,
        model: activeModel,
        timedOut: primary.timedOut,
        status: primary.response?.status || 0,
        openaiStatus: primary.data.status || null,
        message: attemptMessage(primary, "Primary OpenAI request"),
      });
      activeModel = FALLBACK_VOICEOVER_MODEL;
      primary = await requestModel({
        apiKey,
        model: activeModel,
        system,
        user: baseUser,
        timeoutMs: OPENAI_CALL_TIMEOUT_MS,
      });
      text = responseText(primary.data);
    }

    if (!primary.response?.ok || !text) {
      const message = attemptMessage(primary, "OpenAI voice-over generation");
      console.error("DANA voice-over generation failed", {
        requestId,
        model: activeModel,
        status: primary.response?.status || 0,
        timedOut: primary.timedOut,
        message,
      });
      return NextResponse.json(
        { ok: false, message: `${message} Reference: ${requestId}`, requestId },
        { status: primary.response?.status === 401 ? 401 : 502 },
      );
    }

    let metrics = ratioMetrics(text, finalRuntimeSeconds);
    let rewriteCount = 0;

    if (!metrics.passes && rewriteCount < MAX_RATIO_REWRITES) {
      rewriteCount += 1;
      const correctionUser = `Rewrite the draft below so the SPOKEN narration is strictly ${lowerWords}-${upperWords} words, ideally ${targetWords}. Preserve its verified facts, strongest humour, Latvian naturalness and useful timecodes. Do not add new facts. Return only the complete replacement script.\n\nCURRENT DRAFT (${metrics.words} words):\n${text}`;
      const correction = await requestModel({
        apiKey,
        model: FALLBACK_VOICEOVER_MODEL,
        system,
        user: correctionUser,
        timeoutMs: CORRECTION_TIMEOUT_MS,
        maxOutputTokens: 6_000,
      });
      const correctedText = responseText(correction.data);
      if (correction.response?.ok && correctedText) {
        const correctedMetrics = ratioMetrics(correctedText, finalRuntimeSeconds);
        if (
          correctedMetrics.passes ||
          Math.abs(correctedMetrics.ratio - VOICEOVER_RATIO_TARGET) <
            Math.abs(metrics.ratio - VOICEOVER_RATIO_TARGET)
        ) {
          text = correctedText;
          metrics = correctedMetrics;
          activeModel = correction.data.model || FALLBACK_VOICEOVER_MODEL;
        }
      } else {
        console.warn("DANA voice-over ratio correction did not complete", {
          requestId,
          status: correction.response?.status || 0,
          timedOut: correction.timedOut,
          message: attemptMessage(correction, "Ratio correction"),
        });
      }
    }

    if (!metrics.passes) {
      console.error("DANA voice-over ratio gate failed", {
        requestId,
        words: metrics.words,
        ratioPercent: metrics.ratioPercent,
        required: `${metrics.lowerPercent}-${metrics.upperPercent}`,
      });
      return NextResponse.json(
        {
          ok: false,
          message: `Voice-over text was generated, but the mandatory ratio gate did not pass (${metrics.ratioPercent}% vs ${metrics.lowerPercent}-${metrics.upperPercent}%). Retry once; the system will regenerate to the exact target. Reference: ${requestId}`,
          metrics,
          rewriteCount,
          requestId,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      model: primary.data.model || activeModel,
      modelTier: "frontier",
      text,
      appliedReferenceCount: appliedSources.length,
      metrics,
      rewriteCount,
      tone: selectedTone,
      requestId,
      ratioRule: "16.67% ± 0.50 percentage points; 130 spoken words/minute estimate",
      ratioReferenceSources: RATIO_REFERENCE_SOURCES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice-over generation failed.";
    console.error("DANA voice-over route exception", { requestId, message });
    return NextResponse.json(
      { ok: false, message: `${message} Reference: ${requestId}`, requestId },
      { status: 500 },
    );
  }
}
