import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const REQUIRED_REFERENCE_COUNT = 7;
const VOICEOVER_RATIO_TARGET = 1 / 6;
const VOICEOVER_RATIO_TOLERANCE = 0.005;
const VOICEOVER_WPM = 130;
const PRIMARY_VOICEOVER_MODEL = "gpt-5.6-sol";
const FALLBACK_VOICEOVER_MODEL = "gpt-5.6-terra";
const LEGACY_VOICEOVER_MODEL = "gpt-5.6-terra";
const DEFAULT_TONE = "Lepers Standard · premium observational comedy";
const MAX_BACKGROUND_CORRECTIONS = 2;

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

function toneProfileFor(tone: string) {
  return TONE_PROFILES[tone] || TONE_PROFILES[DEFAULT_TONE];
}

type OpenAIOutputItem = { type?: string; text?: string };
type OpenAIResponseData = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: OpenAIOutputItem[] }>;
  error?: { code?: string; message?: string } | null;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  metadata?: Record<string, string> | null;
};

type VoiceoverInput = {
  apiKey?: string;
  transcript?: string;
  prompt?: string;
  tone?: string;
  context?: string;
  appliedSources?: string[];
  finalRuntimeSeconds?: number;
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
  const lowerRatio = VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE;
  const upperRatio = VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE;
  const standardStatus =
    finalRuntimeSeconds <= 0
      ? "runtime-missing"
      : ratio > upperRatio
        ? "over-limit"
        : ratio < lowerRatio
          ? "under-standard"
          : "within-standard";
  return {
    words,
    spokenSeconds: Math.round(spokenSeconds),
    ratio,
    ratioPercent: Number((ratio * 100).toFixed(2)),
    targetPercent: Number((VOICEOVER_RATIO_TARGET * 100).toFixed(2)),
    lowerPercent: Number((lowerRatio * 100).toFixed(2)),
    upperPercent: Number((upperRatio * 100).toFixed(2)),
    passes: standardStatus === "within-standard",
    standardStatus,
    overLimit: standardStatus === "over-limit",
  };
}

function voiceoverQualityMetrics(text: string) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const cuePattern = /^\[(\d{1,2}):(\d{2}):(\d{2})\]\s+VO:\s+(.+)$/i;
  const cueLines = lines.filter((line) => cuePattern.test(line));
  const nonCueLines = lines.filter((line) => !cuePattern.test(line));
  const cueWordCounts = cueLines.map((line) =>
    spokenWordCount(line.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s+VO:\s*/i, "")),
  );
  const oversizedCues = cueWordCounts.filter((count) => count > 55).length;
  const cueCount = cueLines.length;
  const formatPasses = cueCount > 0 && nonCueLines.length === 0 && oversizedCues === 0;
  return {
    cueCount,
    nonCueLines: nonCueLines.length,
    oversizedCues,
    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,
    formatPasses,
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

function modelUnavailable(response: Response, data: OpenAIResponseData) {
  const detail = JSON.stringify(data || "").toLowerCase();
  return (
    response.status === 403 ||
    response.status === 404 ||
    (detail.includes("model") &&
      (detail.includes("not found") ||
        detail.includes("not exist") ||
        detail.includes("unavailable") ||
        detail.includes("access")))
  );
}

function inferRuntimeFromTranscript(text: string) {
  const matches = Array.from(
    String(text || "").matchAll(/(?:^|\n|\s)\[?(\d{1,2}):(\d{2}):(\d{2})(?:[,.]\d{1,3})?\]?/g),
  );
  const latest = matches.reduce((max, match) => {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (minutes > 59 || seconds > 59) return max;
    return Math.max(max, hours * 3600 + minutes * 60 + seconds);
  }, 0);
  return latest > 0 ? latest + 2 : 0;
}

function wordTargets(finalRuntimeSeconds: number) {
  return {
    targetWords: Math.round(((finalRuntimeSeconds * VOICEOVER_RATIO_TARGET) / 60) * VOICEOVER_WPM),
    lowerWords: Math.ceil(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE)) / 60) * VOICEOVER_WPM,
    ),
    upperWords: Math.floor(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE)) / 60) * VOICEOVER_WPM,
    ),
  };
}

function prompts(body: VoiceoverInput, finalRuntimeSeconds: number) {
  const selectedTone = String(body.tone || DEFAULT_TONE);
  const toneProfile = toneProfileFor(selectedTone);
  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);
  const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer for Gandrīz ideālas vakariņas. Write fluent, natural, broadcast-ready Latvian. Your task is SELECTIVE NARRATION, not transcript summarisation. Every line must add editorial value that the viewer cannot already get directly from picture or dialogue. Never invent facts. Never imitate wording from references. Protect participant dignity.\n\nSELECTED TONE: ${selectedTone}\n${toneProfile}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;
  const user = `Create the final Latvian TV voice-over for this scene.\n\nEDITORIAL METHOD — FOLLOW IN THIS ORDER:\n1. Read the transcript only as source evidence. Do not recap the scene.\n2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation.\n3. Do not list participant biographies, paraphrase audible dialogue, explain obvious actions, or narrate information the audience already understands.\n4. Leave silence where narration adds nothing. The narrator is selective, not continuous.\n5. Format EVERY intervention on one line exactly as: [HH:MM:SS] VO: <one or two broadcast-ready sentences>. No headings, no prose paragraphs, no commentary outside VO cues.\n6. Keep each cue concise — normally 8-45 spoken words and never more than 55.\n7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.\n\nVOICE-OVER AMOUNT STANDARD:\nFinal runtime: ${Math.round(finalRuntimeSeconds)} seconds.\nTarget ≈ ${targetWords} spoken words. Preferred standard band: ${lowerWords}-${upperWords} words (16.17%-17.17% of runtime at 130 Latvian words/minute). Aim to fit this standard by choosing enough legitimate editorial beats. Never exceed ${upperWords} spoken words. If the source does not contain enough legitimate beats, return a shorter selective script rather than padding with recap, biography, dialogue paraphrase or obvious action.\n\nEditorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}\n\nApplied reference calibration: ${RATIO_REFERENCE_SOURCES.join(", ")}.\nApplied production context:\n${body.context || "No reference manifest supplied."}\n\nSOURCE TRANSCRIPT:\n${body.transcript}`;
  return { selectedTone, system, user, targetWords, lowerWords, upperWords };
}

function metadataFor(finalRuntimeSeconds: number, tone: string, phase: string, correctionAttempt: number) {
  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);
  return {
    dana_phase: phase,
    dana_correction_attempt: String(correctionAttempt),
    dana_runtime_seconds: String(Math.round(finalRuntimeSeconds)),
    dana_target_words: String(targetWords),
    dana_lower_words: String(lowerWords),
    dana_upper_words: String(upperWords),
    dana_tone: tone.slice(0, 500),
  };
}

async function createBackgroundResponse({
  apiKey,
  model,
  system,
  user,
  metadata,
  previousResponseId,
}: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  metadata: Record<string, string>;
  previousResponseId?: string;
}) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      background: true,
      store: true,
      reasoning: { effort: "medium" },
      max_output_tokens: 12_000,
      text: { verbosity: "medium" },
      metadata,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as OpenAIResponseData;
  return { response, data };
}

async function createLegacyResponse({
  apiKey,
  system,
  user,
}: {
  apiKey: string;
  system: string;
  user: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: LEGACY_VOICEOVER_MODEL,
        reasoning: { effort: "none" },
        max_output_tokens: 8_000,
        text: { verbosity: "medium" },
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
    return {
      response: null,
      data: {} as OpenAIResponseData,
      timedOut: error instanceof Error && error.name === "AbortError",
      transportError: error instanceof Error ? error.message : "OpenAI transport failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function providerError(data: OpenAIResponseData, fallback: string) {
  return data.error?.message || data.incomplete_details?.reason || fallback;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = (await request.json()) as VoiceoverInput;
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
        { ok: false, message: `Voice-over is blocked until all ${REQUIRED_REFERENCE_COUNT} protected production references are applied.`, requestId },
        { status: 400 },
      );
    }
    const providedRuntimeSeconds = Number(body.finalRuntimeSeconds || 0);
    const inferredRuntimeSeconds = inferRuntimeFromTranscript(body.transcript || "");
    const finalRuntimeSeconds =
      Number.isFinite(providedRuntimeSeconds) && providedRuntimeSeconds > 0
        ? providedRuntimeSeconds
        : inferredRuntimeSeconds;
    if (!Number.isFinite(finalRuntimeSeconds) || finalRuntimeSeconds <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "DANA AI could not determine the scene runtime. Import a timecoded transcript (HH:MM:SS) or transcribe the source video before generating voice-over.",
          requestId,
        },
        { status: 400 },
      );
    }

    const { selectedTone, system, user } = prompts(body, finalRuntimeSeconds);
    const asyncMode = request.headers.get("x-dana-voiceover-mode") === "background";

    // Compatibility for already-open browser sessions from before the background-job upgrade.
    // This path is intentionally short and uses Terra with no reasoning so the old page can
    // receive a complete script without requiring a refresh that would lose its transcript.
    if (!asyncMode) {
      const legacy = await createLegacyResponse({ apiKey, system, user });
      if (!legacy.response?.ok) {
        const message = legacy.timedOut
          ? "OpenAI voice-over generation timed out. The new background generator is available after refreshing the app."
          : legacy.transportError || providerError(legacy.data, `OpenAI voice-over generation failed${legacy.response ? ` (HTTP ${legacy.response.status})` : ""}.`);
        return NextResponse.json({ ok: false, message: `${message} Reference: ${requestId}`, requestId }, { status: 502 });
      }
      const text = responseText(legacy.data);
      if (!text) {
        return NextResponse.json(
          { ok: false, message: `OpenAI returned no usable voice-over text. Reference: ${requestId}`, requestId },
          { status: 502 },
        );
      }
      const metrics = ratioMetrics(text, finalRuntimeSeconds);
      const quality = voiceoverQualityMetrics(text);
      if (!quality.formatPasses) {
        return NextResponse.json(
          {
            ok: false,
            message: `DANA AI rejected the draft because it was not formatted as selective TV voice-over cues. Refresh the app and regenerate with the current editorial engine. Reference: ${requestId}`,
            requestId,
          },
          { status: 502 },
        );
      }
      return NextResponse.json({
        ok: true,
        status: "completed",
        model: legacy.data.model || LEGACY_VOICEOVER_MODEL,
        text,
        metrics,
        quality,
        ratioWarning: !metrics.passes,
        tone: selectedTone,
        requestId,
      });
    }

    const configuredModel = process.env.OPENAI_VOICEOVER_MODEL || PRIMARY_VOICEOVER_MODEL;
    let model = configuredModel;
    let created = await createBackgroundResponse({
      apiKey,
      model,
      system,
      user,
      metadata: metadataFor(finalRuntimeSeconds, selectedTone, "initial", 0),
    });
    if (!created.response.ok && modelUnavailable(created.response, created.data) && model !== FALLBACK_VOICEOVER_MODEL) {
      model = FALLBACK_VOICEOVER_MODEL;
      created = await createBackgroundResponse({
        apiKey,
        model,
        system,
        user,
        metadata: metadataFor(finalRuntimeSeconds, selectedTone, "initial", 0),
      });
    }
    if (!created.response.ok || !created.data.id) {
      const message = providerError(created.data, `OpenAI background voice-over job could not start (HTTP ${created.response.status}).`);
      return NextResponse.json({ ok: false, message: `${message} Reference: ${requestId}`, requestId }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      status: created.data.status || "queued",
      responseId: created.data.id,
      model: created.data.model || model,
      phase: "initial",
      requestId,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: `${error instanceof Error ? error.message : "Voice-over generation failed."} Reference: ${requestId}`, requestId },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const responseId = new URL(request.url).searchParams.get("responseId")?.trim() || "";
    if (!responseId.startsWith("resp_")) {
      return NextResponse.json({ ok: false, message: "A valid OpenAI response ID is required.", requestId }, { status: 400 });
    }
    const apiKey = await getStoredKey("openai");
    if (!apiKey) {
      return NextResponse.json({ ok: false, message: "OpenAI API key is missing. Reconnect OpenAI in Settings.", requestId }, { status: 400 });
    }

    const provider = await fetch(`${OPENAI_URL}/${encodeURIComponent(responseId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const data = (await provider.json().catch(() => ({}))) as OpenAIResponseData;
    if (!provider.ok) {
      return NextResponse.json(
        { ok: false, message: `${providerError(data, `OpenAI job lookup failed (HTTP ${provider.status}).`)} Reference: ${requestId}`, requestId },
        { status: 502 },
      );
    }

    if (data.status === "queued" || data.status === "in_progress") {
      return NextResponse.json({ ok: true, status: data.status, responseId, phase: data.metadata?.dana_phase || "initial", model: data.model, requestId });
    }
    if (data.status !== "completed") {
      return NextResponse.json(
        { ok: false, message: `${providerError(data, `OpenAI voice-over job ended with status ${data.status || "unknown"}.`)} Reference: ${requestId}`, requestId },
        { status: 502 },
      );
    }

    const text = responseText(data);
    if (!text) {
      return NextResponse.json({ ok: false, message: `OpenAI completed the job without usable voice-over text. Reference: ${requestId}`, requestId }, { status: 502 });
    }

    const metadata = data.metadata || {};
    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);
    const metrics = ratioMetrics(text, finalRuntimeSeconds);
    const quality = voiceoverQualityMetrics(text);
    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);
    const phase = metadata.dana_phase || "initial";
    const correctionTone = metadata.dana_tone || DEFAULT_TONE;
    const correctionToneProfile = toneProfileFor(correctionTone);
    const needsCorrection =
      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard";

    if (needsCorrection && correctionAttempt < MAX_BACKGROUND_CORRECTIONS) {
      const lowerWords = Number(metadata.dana_lower_words || 0);
      const upperWords = Number(metadata.dana_upper_words || 0);
      const targetWords = Number(metadata.dana_target_words || 0);
      const ratioInstruction = metrics.overLimit
        ? `The draft is above the format ceiling. Remove the weakest narrator interventions until the spoken total is no more than ${upperWords} words, preferably near ${targetWords}.`
        : metrics.standardStatus === "under-standard"
          ? `The draft is below the preferred ${lowerWords}-${upperWords} word band. Using the ORIGINAL SOURCE TRANSCRIPT from the previous response context, add only additional legitimate narrator interventions where the narrator contributes new editorial value. If there are no more legitimate beats, keep the script shorter rather than padding it.`
          : `Keep the spoken amount inside the ${lowerWords}-${upperWords} word standard while fixing the voice-over structure.`;
      const correctionSystem = `You are DANA AI's final Latvian television voice-over editor. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} The selected tone must remain clearly recognisable after revision.`;
      const correctionUser = `Rewrite the complete draft as genuine TV voice-over. ${ratioInstruction}\nEvery output line must use exactly: [HH:MM:SS] VO: <one or two concise sentences>. Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio. Do not include headings or explanatory prose. Keep each cue under 55 spoken words.\n\nCURRENT DRAFT (${metrics.words} spoken words; ${quality.cueCount} valid VO cues):\n${text}`;
      const correction = await createBackgroundResponse({
        apiKey,
        model: FALLBACK_VOICEOVER_MODEL,
        system: correctionSystem,
        user: correctionUser,
        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "correction", correctionAttempt + 1),
        previousResponseId: responseId,
      });
      if (correction.response.ok && correction.data.id) {
        return NextResponse.json({
          ok: true,
          status: correction.data.status || "queued",
          responseId: correction.data.id,
          phase: "correction",
          correctionAttempt: correctionAttempt + 1,
          model: correction.data.model || FALLBACK_VOICEOVER_MODEL,
          tone: correctionTone,
          requestId,
        });
      }
    }

    if (!quality.formatPasses) {
      return NextResponse.json(
        {
          ok: false,
          message: `DANA AI rejected the generated text because it still resembled transcript/summary prose instead of selective TV voice-over. Reference: ${requestId}`,
          requestId,
        },
        { status: 502 },
      );
    }
    if (metrics.overLimit) {
      return NextResponse.json(
        {
          ok: false,
          message: `DANA AI rejected the draft because voice-over exceeds the 17.17% format ceiling. Reference: ${requestId}`,
          requestId,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "completed",
      responseId,
      phase,
      model: data.model || FALLBACK_VOICEOVER_MODEL,
      text,
      metrics,
      quality,
      ratioWarning: !metrics.passes,
      tone: correctionTone,
      requestId,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: `${error instanceof Error ? error.message : "Voice-over job lookup failed."} Reference: ${requestId}`, requestId },
      { status: 500 },
    );
  }
}
