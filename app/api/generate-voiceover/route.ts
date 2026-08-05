import { NextResponse } from "next/server";\nimport { getStoredKey } from "../../lib/credentials";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const REQUIRED_REFERENCE_COUNT = 7;
const VOICEOVER_RATIO_TARGET = 1 / 6;
const VOICEOVER_RATIO_TOLERANCE = 0.005;
const VOICEOVER_WPM = 130;
const MAX_RATIO_REWRITES = 3;
const PRIMARY_VOICEOVER_MODEL = "gpt-5.6-sol";
const FALLBACK_VOICEOVER_MODEL = "gpt-5.4";
const DEFAULT_TONE = "Lepers Standard · premium observational comedy";

const RATIO_REFERENCE_SOURCES = [
  "Come Dine With Me.mp4",
  "Ainārs Ašaks · 15.12.2011",
  "Ieva Janiševa · Season 3",
];

const TONE_PROFILES: Record<string, string> = {
  [DEFAULT_TONE]:
    "LEPERS STANDARD. Use a premium Latvian observational reality-TV narrator voice: warm, intelligent, dryly amused, character-focused and lightly mischievous. Build humour from the gap between what a participant intends, what they say and what the viewer can see; use elegant understatement, precise visual observation, awkward pauses, reactions, delayed punchlines, unexpected comparisons, gentle sarcasm and comic callbacks. Give each scene a clear editorial purpose and reveal character through behaviour rather than labels. Alternate short, rhythmic punchlines with occasional longer reflective observations, leaving room for the image and silence to complete the joke. Be provocative only when earned by the footage, never cruel or humiliating; preserve participant dignity and include warmth beneath the irony. Do not describe obvious actions, use generic filler, over-explain jokes, imitate any existing script or invent facts. The result should feel deeper, funnier and more production-useful than a simple bridge: identify the contradiction, sharpen the social tension, set up the next beat and land the strongest observation with confident timing.",
  "Observational · sharp, warm and lightly humorous":
    "OBSERVATIONAL HOUSE STYLE. Sound like an intelligent narrator noticing the social detail everyone else missed. Use warm precision, character-specific irony and one clean comic turn at a time. Do not mock vulnerability. Alternate short punchy sentences with one slightly longer observation. The joke must come from the contrast between what the person says, what they do and what the audience can see.",
  "Dry irony · understated and precise":
    "DRY IRONY. Underplay everything. Use calm, economical sentences, deadpan understatement and surgical contrast. Never announce that something is funny; let the discrepancy carry the joke. Avoid exclamation marks, emotional adjectives, broad sarcasm and obvious punchlines. The narrator should sound faintly amused, never cruel.",
  "Warm human · intimate and empathetic":
    "WARM HUMAN. Lead with curiosity and emotional intelligence. Notice effort, nerves, pride and small acts of courage. Use gentle humour that includes the narrator and protects the participant's dignity. Prefer flowing, intimate sentences and concrete human details. No cynicism, humiliation or detached judging.",
  "Rising tension · cinematic and controlled":
    "RISING TENSION. Build a controlled dramatic arc. Begin with a precise situation, introduce a question or pressure point, then escalate toward the next reveal. Use short sentences at turning points and restrained cinematic language. Do not invent stakes, music or events; tension must come from verified behaviour, timing and contradiction.",
  "Fast bridge · concise and energetic":
    "FAST BRIDGE. Write for a brisk edit. Use compact sentences, active verbs and strong transitions. Each block must move the story to the next beat or sharpen the audience's expectation. Avoid decorative description, repeated context and long setups. Humour should land quickly and cleanly.",
  "Classic · British original":
    "CLASSIC BRITISH FORMAT MODE. Use the restrained, observational reality-TV narrator tradition associated with the original British format: dry, clever, lightly cheeky and socially observant. Frame the contradiction between intention and outcome with elegant understatement. Let awkward pauses and small reactions do part of the work. Use a polished, conversational rhythm with occasional perfectly timed comic reversals. Avoid American-style hype, melodrama, loud punchlines, direct insults and imitation of any existing script.",
};

type OpenAIOutputItem = { type?: string; text?: string };
type OpenAIResponseData = {
  output_text?: string;
  output?: Array<{ content?: OpenAIOutputItem[] }>;
  error?: { message?: string };
  model?: string;
};

function spokenWordCount(text: string) {
  return text
    .replace(/^\s*(?:\[[^\]]+\]|\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s*/gm, "")
    .replace(/^[A-ZĀČĒĢĪĶĻŅŠŪŽ][^:]{0,40}:\s*/gm, "")
    .match(/[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+(?:[-'][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+)*/g)?.length || 0;
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
    passes: finalRuntimeSeconds > 0 && Math.abs(ratio - VOICEOVER_RATIO_TARGET) <= VOICEOVER_RATIO_TOLERANCE,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { apiKey?: string; transcript?: string; prompt?: string; tone?: string; context?: string; appliedSources?: string[]; finalRuntimeSeconds?: number };
    const apiKey = String(body.apiKey || "").trim() || await getStoredKey("openai");
    if (!apiKey) return NextResponse.json({ ok: false, message: "OpenAI API key is missing. Connect OpenAI in Settings first." }, { status: 400 });
    if (!body.transcript?.trim()) return NextResponse.json({ ok: false, message: "A validated transcript is required before generating voice-over." }, { status: 400 });
    const appliedSources = Array.isArray(body.appliedSources) ? body.appliedSources : [];
    if (appliedSources.length < REQUIRED_REFERENCE_COUNT) return NextResponse.json({ ok: false, message: `Voice-over is blocked until all ${REQUIRED_REFERENCE_COUNT} protected production references are applied.` }, { status: 400 });
    const finalRuntimeSeconds = Number(body.finalRuntimeSeconds || 0);
    if (!Number.isFinite(finalRuntimeSeconds) || finalRuntimeSeconds <= 0) return NextResponse.json({ ok: false, message: "The final video runtime is required so the mandatory voice-over ratio can be enforced." }, { status: 400 });
    const targetWords = Math.round((finalRuntimeSeconds * VOICEOVER_RATIO_TARGET / 60) * VOICEOVER_WPM);
    const selectedTone = String(body.tone || DEFAULT_TONE);
    const toneProfile = TONE_PROFILES[selectedTone] || TONE_PROFILES[DEFAULT_TONE];
    const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer. Write fluent, natural, witty Latvian television voice-over for Gandrīz ideālas vakariņas / Come Dine With Me-style factual entertainment. Use the applied references as distinct editorial lenses: format mechanics, Latvian rhythm, approved scene architecture, executive story decisions and proven comic timing. Never invent facts or events not present in the transcript. Do not imitate or copy wording from any reference. Clearly separate confirmed transcript facts from editorial suggestions. Return only the production-ready voice-over script with timecode anchors where available.\n\nSELECTED EDITORIAL TONE: ${selectedTone}\n${toneProfile}\n\nTONE INTEGRITY RULE: The selected tone must be audible in sentence length, comic mechanism, narrator attitude and emotional temperature. Do not blend it with another tone. A draft that could fit every tone is not acceptable.\n\nMANDATORY VOICE-OVER RATIO: the script must contain approximately one-sixth (16.67%) of the final runtime as spoken narration. Estimate spoken duration at 130 Latvian words per minute. The accepted range is 16.17%–17.17%. This is a hard production gate, not a suggestion. Do not add empty filler: every line must add irony, character insight, context, tension or a useful transition.`;
    const referenceVideoNote = `The ratio benchmark is grounded in these three applied reference videos: ${RATIO_REFERENCE_SOURCES.join(", ")}. Use them to calibrate format rhythm and narrator presence; do not copy their wording.`;
    const baseUser = `Create a production-ready Latvian voice-over for this scene.\nFinal runtime: ${Math.round(finalRuntimeSeconds)} seconds.\nMandatory target: ${targetWords} spoken words (approximately 16.67% of runtime at 130 words/minute), accepted only within 16.17%–17.17%.\nTone: ${selectedTone}.\nEditorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}\n\n${referenceVideoNote}\n\nALL ${REQUIRED_REFERENCE_COUNT} APPLIED PRODUCTION REFERENCES MUST BE ACCOUNTED FOR IN YOUR EDITORIAL DECISIONS:\n${body.context || "No reference manifest supplied."}\n\nBefore writing, silently use the references to check: format rhythm; Latvian naturalness; character framing; voice-over density; escalation; humour; chronology; factual safety; and whether the line adds information rather than narrating the obvious.\n\nSOURCE TRANSCRIPT:\n${body.transcript}`;
    const primaryModel = process.env.OPENAI_VOICEOVER_MODEL || PRIMARY_VOICEOVER_MODEL;
    const requestModel = async (model: string, user: string, mode: "pro" | "standard" = "pro") => fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        reasoning: { effort: "max", ...(mode === "pro" ? { mode: "pro" } : {}) },
        max_output_tokens: 12000,
        text: { verbosity: "high" },
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
      }),
    });
    const responseText = (data: OpenAIResponseData) => String(data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "").trim();
    let user = baseUser;
    let activeModel = primaryModel;
    let response = await requestModel(activeModel, user);
    let data = await response.json().catch(() => ({}));
    if (!response.ok && activeModel === primaryModel && modeError(data)) {
      response = await requestModel(activeModel, user, "standard");
      data = await response.json().catch(() => ({}));
    }
    const detail = JSON.stringify(data || "").toLocaleLowerCase();
    const unavailable = response.status === 404 || (detail.includes("model") && (detail.includes("not found") || detail.includes("not exist") || detail.includes("unavailable")));
    if (!response.ok && unavailable && activeModel !== FALLBACK_VOICEOVER_MODEL) {
      activeModel = FALLBACK_VOICEOVER_MODEL;
      response = await requestModel(activeModel, user);
      data = await response.json().catch(() => ({}));
    }
    if (!response.ok) return NextResponse.json({ ok: false, message: data?.error?.message || `OpenAI voice-over generation failed (HTTP ${response.status}).` }, { status: 502 });
    let text = responseText(data);
    if (!text) return NextResponse.json({ ok: false, message: "OpenAI returned no voice-over text." }, { status: 502 });
    let metrics = ratioMetrics(text, finalRuntimeSeconds);
    let rewriteCount = 0;
    while (!metrics.passes && rewriteCount < MAX_RATIO_REWRITES) {
      rewriteCount += 1;
      user = `${baseUser}\n\nThe previous draft measured ${metrics.words} spoken words / ${metrics.ratioPercent}% of runtime. It FAILS the mandatory gate. Rewrite it now to land inside 16.17%–17.17% (${Math.round(metrics.lowerPercent)}%–${Math.round(metrics.upperPercent)}%), while preserving the strongest jokes, facts and timecode anchors. Do not discuss the correction; return only the complete replacement script.`;
      response = await requestModel(activeModel, user);
      data = await response.json().catch(() => ({}));
      if (!response.ok) break;
      text = responseText(data);
      if (!text) break;
      metrics = ratioMetrics(text, finalRuntimeSeconds);
    }
    if (!metrics.passes) return NextResponse.json({ ok: false, message: `Voice-over failed the mandatory ratio gate after ${rewriteCount} rewrite attempts (${metrics.ratioPercent}% vs required ${metrics.lowerPercent}%–${metrics.upperPercent}%).`, metrics, rewriteCount }, { status: 422 });
    return NextResponse.json({ ok: true, model: data.model || activeModel, modelTier: "frontier", text, appliedReferenceCount: appliedSources.length, metrics, rewriteCount, tone: selectedTone, ratioRule: "16.67% ± 0.50 percentage points; 130 spoken words/minute estimate", ratioReferenceSources: RATIO_REFERENCE_SOURCES });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Voice-over generation failed." }, { status: 500 });
  }
}

function modeError(data: unknown) {
  const detail = JSON.stringify(data || "").toLocaleLowerCase();
  return detail.includes("reasoning") && (detail.includes("mode") || detail.includes("pro") || detail.includes("unsupported") || detail.includes("invalid"));
}
