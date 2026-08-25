import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";
import { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";
import { LEPERS_GOLDEN_MASTER_FINGERPRINT, LEPERS_GOLDEN_MASTER_NAME, LEPERS_GOLDEN_MASTER_THRESHOLD, scoreLepersGoldenMaster } from "../../lib/lepers-golden-master";

export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const VOICEOVER_RATIO_TARGET = 1 / 6;
const VOICEOVER_RATIO_TOLERANCE = 0.005;
const VOICEOVER_WPM = 130;
const PRIMARY_VOICEOVER_MODEL = "gpt-5.6-sol";
const FALLBACK_VOICEOVER_MODEL = "gpt-5.6-terra";
const LEGACY_VOICEOVER_MODEL = "gpt-5.6-terra";
const DEFAULT_TONE = "Lepers Standard · premium observational comedy";
const TAILORED_TONE = "Tailored · custom editorial direction";
const MAX_BACKGROUND_CORRECTIONS = 5;
const BACKGROUND_MAX_OUTPUT_TOKENS = 64_000;
const MAX_OUTPUT_RECOVERY_TOKENS = 96_000;
const MAX_OUTPUT_RECOVERIES = 2;

const RATIO_REFERENCE_SOURCES = [
  "Come Dine With Me.mp4",
  "Ainārs Ašaks · 15.12.2011",
  "Ieva Janiševa · Season 3",
];

const GLOBAL_SCENE_DIRECTIVE_RULES = `
GLOBAL SCENE DIRECTIVE — MANDATORY APPLICATION RULE
- The user's Editorial brief is a GLOBAL SCENE DIRECTIVE, not a VO-only note.
- In Lepers Standard, apply it coherently across all 8 sections of the Lepers production package: EP decision and story priorities; dramaturgy and act emphasis; KEEP / TIGHTEN / REMOVE / VERIFY decisions; VO MASTER narrator attitude and beat selection; teasers and promo; editorial/factual risk emphasis where relevant; editing and sound recommendations; and the final producer recommendation.
- The brief may change emphasis, comic pressure, warmth, provocativeness, pacing, character focus, tension, sentiment and what moments are prioritised, as long as the source supports those choices.
- Do not confine an edited brief to section 4. If the brief says to sharpen awkwardness, reduce sentiment, foreground a character contradiction, or prioritise a story line, that decision must be visible consistently throughout the package.
- The brief must not override mandatory channel rules, the DANA Master Production System, participant dignity, factual discipline, canonical Lepers package structure or the current transcript as factual source of truth.
- If the user's brief conflicts with a higher-priority rule, preserve the higher-priority rule and apply the brief as far as safely and editorially possible.
`.trim();

const FIFTH_DINER_EDITORIAL_RULES = `
PIEKTĀ VAKARIŅOTĀJA PRINCIPS — MANDATORY CHANNEL RULE
- The narrator is the invisible fifth dinner guest: present throughout the story, with a point of view and a recognisable editorial personality.
- The narrator adds a second layer of entertainment and interpretation by articulating what the viewer is likely thinking, but with wit, intelligence and restraint.
- The narrator uses internal dialogue when useful: react mentally to claims, promises, awkward pauses and reversals instead of merely explaining them.
- Actively hunt for details the participants miss or do not verbalise: facial expressions, silence, glances, hesitation, strange objects, timing mistakes, forgotten ingredients, inconsistencies, accidental double meanings, background reactions and confident claims followed by reality.
- The narrator may tease, gently pull someone's leg, sharpen a contradiction, provoke with a question or say the socially obvious thing the room leaves unsaid.
- Register memorable claims, predictions and boasts and look for 2–4 running jokes or callbacks per episode when the source supports them. Set up a promise now and pay it off later.
- The narrator may articulate hidden emotional dynamics such as nerves, pride, scepticism, relief or social politeness hiding disagreement, but uncertain interpretation must be framed as interpretation rather than fact.
- The narrator is not merely an observer and must not collapse into empty reactions such as “hmm…”, “jā…”, “traki…”, “nu gan…” or similar filler.
- Every VO cue must contain an editorial proposition: opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, emotional punctuation or a non-obvious detail.
- Do not manufacture jokes continuously. Humour should come from truth + observation + timing; prefer specific observation → slight exaggeration → punchline/reaction.
- Humour targets the situation, contradiction, timing, absurdity or behaviour, never a person's dignity. No brutal insults, humiliation or contempt.
- Protect strong natural dialogue, laughter, emotional silence and reaction shots. Sometimes the best fifth-diner move is a setup followed by silence.
- GOLDEN TEST 1: If deleting a VO line loses nothing entertaining, emotional, revealing or narratively useful, delete it.
- GOLDEN TEST 2: If a generic documentary narrator could have said the line, rewrite it. Generic descriptive VO is not acceptable Fifth Dinner Guest narration.
- The selected tone changes HOW this fifth diner speaks; it never removes the fifth diner's active point of view or added-value function.
`.trim();

const SECOND_STORY_EDITORIAL_RULES = `
SECOND STORY — MANDATORY EDITORIAL AUTHORSHIP RULE
- DANA is an editorial co-author, not a reflective commentator. Do not merely react to what the participants already said or what the picture already shows.
- For every significant scene, actively ask: “What else could this scene be about?” Then build one additional editorial storyline from verified reality.
- The Second Story may be a tension, game, contradiction or lens such as confidence versus the clock, control versus chaos, politeness versus true reaction, ambition versus reality, friendship versus scoring, or another source-grounded angle unique to the scene.
- DANA may create framing, metaphor, comic premise, hypothesis, prediction, provocative question, juxtaposition, narrative label, setup, escalation, payoff and running motif. This is editorial authorship, not factual invention.
- Ground the Second Story in the two factual evidence channels supplied by DANA: the authentic transcript for spoken words and the Visual Evidence Pass for observable non-verbal facts. Use real claims, behaviour, timing, reactions, objects, silences or reversals as anchors, then create original language and an original editorial angle around them.
- Treat visual evidence as observation, never as ready-made interpretation. DANA may interpret it editorially only after grounding the claim and must qualify uncertain emotional readings.
- Develop the strongest Second Story across setup → escalation → payoff/callback when the source supports it. Remember earlier claims and let later reality test them.
- Reflection-only VO is a failure mode. A line that merely says someone is nervous, surprised, cooking, waiting or losing confidence must be rewritten unless it adds a new authored angle.
- Invent the editorial idea around reality; never invent reality.
- Never invent events, quotations, motives, relationships, private thoughts, off-camera facts or causal claims that the source does not support. Uncertain emotional interpretation must remain clearly framed as interpretation.
- Be courageous, proactive, engaging and provocative while protecting participant dignity. The goal is an additional entertainment line that makes the episode richer than the raw material alone.
`.trim();

const CREATIVE_EXECUTIVE_PRODUCER_RULES = `
WOW CREATIVE EXECUTIVE PRODUCER MODE — MANDATORY
- Factually conservative, creatively aggressive. Evidence discipline stays strict; creative ambition does not.
- Do not submit the first reasonable idea. The first obvious interpretation is a draft, not the answer.
- Before final writing, run a Creative Room: generate at least 5 genuinely different source-grounded editorial angles, deliberately reject safe/reflection-only options, then show the 3 strongest finalists in the package.
- Divergence must be real: vary the game, tension, metaphor, character lens, structural device and audience expectation — do not create five paraphrases of the same idea.
- At least 2 predictable ideas must be named and rejected explicitly so the package proves it escaped safe mode.
- FORMAT SPICE is mandatory: propose at least 3 source-grounded devices that enrich the format itself. Examples include countdown, contradiction tracker, freeze-frame observation, split-screen comparison, faux-serious audit, scorecard, recurring sound cue, ironic chapter title, prediction meter, visual motif, audience question or another equally strong device.
- At least one Format Spice idea must change how the scene is presented in edit, graphics, sound, structure or recurring game — not merely add another VO joke.
- Create the line the raw footage does not already hand you: a new game, premise, tension, anticipation mechanism, metaphor, recurring motif, provocation or payoff architecture.
- Be willing to make a bold editorial choice. Safe, generic, tasteful-but-forgettable output is a failure even when factually correct.
- Provocative does not mean cruel: protect dignity, legal safety and factual truth while pushing surprise, wit, tension and entertainment.
- Final self-test: “What did the production team add that was NOT already sitting in the transcript or picture?” If the answer is vague, rewrite.
`.trim();

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
  [TAILORED_TONE]:
    "TAILORED. Follow the user's editorial brief as the primary stylistic direction. Translate that brief into a coherent Latvian broadcast narrator voice while preserving evidence discipline, participant dignity, selective narration and the voice-over amount standard. Do not inherit Lepers styling unless the user's brief explicitly asks for it.",
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
  visualEvidence?: string;
  prompt?: string;
  tone?: string;
  context?: string;
  appliedSources?: string[];
  finalRuntimeSeconds?: number;
  referenceContents?: Record<string, string>;
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

function isLowValueObserverCue(text: string) {
  const normalized = String(text || "")
    .replace(/^\s*\[\d{1,2}:\d{2}:\d{2}\]\s+VO:\s*/i, "")
    .toLocaleLowerCase("lv-LV")
    .replace(/[.…!?;,:'"“”‘’()\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  const emptyObserverReactions = new Set([
    "hmm",
    "hm",
    "jā",
    "nu jā",
    "traki",
    "nu gan",
    "oho",
    "ak vai",
    "interesanti",
    "nu ko",
  ]);
  return emptyObserverReactions.has(normalized);
}

function isGenericDescriptiveCue(text: string) {
  const normalized = String(text || "")
    .replace(/^\s*\[\d{1,2}:\d{2}:\d{2}\]\s+VO:\s*/i, "")
    .toLocaleLowerCase("lv-LV")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;

  const hasEditorialSignal =
    /\b(bet|tomēr|toties|tikai|šķiet|izskatās|laikam|acīmredzot|protams|ironiski|par laimi|par nelaimi|atcerēsimies|jautājums|vai tiešām|cik ilgi|interesanti,|teorētiski|praktiski|tikmēr|pagaidām)\b/i.test(normalized) ||
    /[?!]/.test(normalized);
  if (hasEditorialSignal) return false;

  const genericActionLead = /^(?:tagad\s+)?(?:saimnieks|saimniece|rihards|viņš|viņa|viesi|dalībnieki)\s+(?:turpina|gatavo|liek|dodas|ierodas|sāk|pasniedz|ņem|atgriežas|gaida|klāj|ēd|runā|stāsta|izvēlas)\b/i;
  const genericSceneLead = /^(?:tagad|tikmēr)\s+(?:notiek|sākas|turpinās|redzam|seko)\b/i;
  return genericActionLead.test(normalized) || genericSceneLead.test(normalized);
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
  const lowValueObserverCues = cueLines.filter((line) => isLowValueObserverCue(line)).length;
  const genericDescriptiveCues = cueLines.filter((line) => isGenericDescriptiveCue(line)).length;
  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const fifthDinerPasses = editorialValuePasses;
  const requiresEditorialCorrection = !editorialValuePasses;
  const formatPasses =
    cueCount > 0 &&
    nonCueLines.length === 0 &&
    oversizedCues === 0 &&
    editorialValuePasses;
  return {
    cueCount,
    nonCueLines: nonCueLines.length,
    oversizedCues,
    lowValueObserverCues,
    genericDescriptiveCues,
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
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

function isLepersTone(tone: string) {
  return tone === DEFAULT_TONE;
}

function extractVoiceoverMasterSection(text: string) {
  const source = String(text || "");
  const start = source.search(/(?:^|\n)#{0,3}\s*4\.\s*VO MASTER\b/i);
  if (start < 0) return "";
  const rest = source.slice(start);
  const next = rest.search(/\n#{0,3}\s*5\.\s*Teaseri/i);
  return next > 0 ? rest.slice(0, next) : rest;
}

function extractVoiceoverMasterText(text: string) {
  const section = extractVoiceoverMasterSection(text);
  if (!section) return "";
  return section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .map((cells) => cells[3] || "")
    .filter(
      (cell) =>
        cell &&
        !/GALA VO TEKSTS/i.test(cell) &&
        !/^:?-{3,}:?$/.test(cell.replace(/\s/g, "")),
    )
    .join("\n")
    .trim();
}

function lepersPackageQualityMetrics(text: string) {
  const missingSections = LEPERS_REQUIRED_SECTIONS.filter((heading) => !String(text || "").includes(heading));
  const section = extractVoiceoverMasterSection(text);
  const tableHeaderPasses = /\|\s*Laiks\s*\|\s*Funkcija\s*\|\s*GALA VO TEKSTS\s*\|\s*Izpildījums \/ montāža\s*\|/i.test(section);
  const spoken = extractVoiceoverMasterText(text);
  const masterCueTexts = spoken
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const cueCount = section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|\s*\d{1,2}:\d{2}(?::\d{2})?\s*\|/.test(line)).length;
  const lowValueObserverCues = masterCueTexts.filter((cue) => isLowValueObserverCue(cue)).length;
  const genericDescriptiveCues = masterCueTexts.filter((cue) => isGenericDescriptiveCue(cue)).length;
  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const fifthDinerPasses = editorialValuePasses;
  const requiresEditorialCorrection = !editorialValuePasses;
  return {
    cueCount,
    nonCueLines: 0,
    oversizedCues: 0,
    lowValueObserverCues,
    genericDescriptiveCues,
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
    maxCueWords: 0,
    missingSections,
    tableHeaderPasses,
    formatPasses:
      missingSections.length === 0 &&
      tableHeaderPasses &&
      cueCount >= 4 &&
      spoken.length > 0 &&
      editorialValuePasses,
  };
}

function qualityMetricsForOutput(text: string, tone: string) {
  return isLepersTone(tone) ? lepersPackageQualityMetrics(text) : voiceoverQualityMetrics(text);
}

function ratioMetricsForOutput(text: string, finalRuntimeSeconds: number, tone: string) {
  return isLepersTone(tone)
    ? ratioMetrics(extractVoiceoverMasterText(text), finalRuntimeSeconds)
    : ratioMetrics(text, finalRuntimeSeconds);
}

function referenceContentBlock(body: VoiceoverInput) {
  const contents = body.referenceContents || {};
  const applied = new Set(Array.isArray(body.appliedSources) ? body.appliedSources : []);
  let remaining = 140_000;
  const blocks: string[] = [];
  for (const [name, raw] of Object.entries(contents)) {
    if (!applied.has(name) || !String(raw || "").trim() || remaining <= 0) continue;
    const clean = String(raw).trim();
    const excerpt = clean.slice(0, Math.min(60_000, remaining));
    remaining -= excerpt.length;
    blocks.push(`REFERENCE: ${name}\n${excerpt}`);
  }
  return blocks.length ? blocks.join("\n\n---\n\n") : "No extracted reference document text was supplied in this run.";
}

function prompts(body: VoiceoverInput, finalRuntimeSeconds: number) {
  const selectedTone = String(body.tone || DEFAULT_TONE);
  const toneProfile = toneProfileFor(selectedTone);
  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);
  const references = referenceContentBlock(body);
  const visualEvidence = body.visualEvidence?.trim()
    ? body.visualEvidence.trim()
    : "VISUAL EVIDENCE UNAVAILABLE — transcript-only source. Do not invent visual actions, reactions, objects, gestures or off-camera facts.";
  if (isLepersTone(selectedTone)) {
    const system = `You are DANA AI, a senior Latvian executive television producer, story editor and voice-over writer for Gandrīz ideālas vakariņas. The Rihards Lepers production-analysis reference is the canonical editorial benchmark for this mode. Write fluent, natural, production-ready Latvian. Never invent facts and never transfer factual details from a reference episode into the current episode.

SELECTED TONE: ${selectedTone}
${toneProfile}

${FIFTH_DINER_EDITORIAL_RULES}

${SECOND_STORY_EDITORIAL_RULES}

${CREATIVE_EXECUTIVE_PRODUCER_RULES}

${GLOBAL_SCENE_DIRECTIVE_RULES}

GOLDEN MASTER CONFORMANCE — LOCKED BENCHMARK
${LEPERS_GOLDEN_MASTER_NAME}. Variation is allowed in content, never in production standard. Match the reference fingerprint before returning the package: 16-page analytical depth, seven-act dramaturgical logic when source length supports it, five teaser beats, 30s + 15s promo, four social hooks, fifth-diner humour, concise cue rhythm, decisive editor-facing recommendations, exact tables and the locked VO ratio. Minimum conformance score: ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100.
Fingerprint: ${JSON.stringify(LEPERS_GOLDEN_MASTER_FINGERPRINT)}

${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;
    const user = `Create the COMPLETE Lepers Standard production package for the CURRENT transcript, not merely a voice-over list. Follow the canonical section order and tables exactly. Match the Rihards Lepers reference in depth, rhythm, character insight, intelligent humour, decisive edit recommendations, VO delivery notes, teasers, risk control and final producer judgement.

CREATIVE ROOM / WOW REQUIREMENT: do not submit the first reasonable idea. Explore at least 5 genuinely different source-grounded angles before final writing. In section 1, visibly show CREATIVE ROOM — WOW PASS with exactly 3 strongest OTRĀ STĀSTA KANDIDĀTI, at least 2 NORAIDĪTIE PAREDZAMIE LEŅĶI, at least 3 FORMAT SPICE devices, KO MĒS PIEVIENOJAM, KAS NAV JAU GATAVS MATERIĀLĀ, and one DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA. Be factually conservative and creatively aggressive.

SECOND STORY REQUIREMENT: after the Creative Room, select the strongest bold additional editorial storyline from verified reality, label it OTRĀ STĀSTA LĪNIJA in section 1, develop it through setup → escalation → payoff/callback in section 2, and let it influence VO, edit choices, teasers and the final producer judgement. Do not merely reflect the existing dialogue or action.

FRESHNESS / WOW GATE: a technically correct package that is safe, predictable, merely reflective or adds nothing to the format must be rewritten. The production team must contribute a genuinely new entertainment line beyond the raw material.

VOICE-OVER AMOUNT CONTROL: final runtime ${Math.round(finalRuntimeSeconds)} seconds; target approximately ${targetWords} spoken VO words; preferred band ${lowerWords}-${upperWords}. Count ONLY the GALA VO TEKSTS column in section 4. Never count analysis, production notes, promos or other sections. Never exceed ${upperWords}; never pad with obvious action, biography or dialogue paraphrase simply to reach the target.

GLOBAL SCENE DIRECTIVE — APPLY TO THE ENTIRE PACKAGE:
${body.prompt || "Use the Rihards Lepers production standard as the benchmark for this scene."}

Application check: before finalising, verify that this directive materially influences the EP decision, dramaturgy, KEEP / TIGHTEN / REMOVE / VERIFY choices, VO MASTER, teasers and promo, editing and sound recommendations, and final producer recommendation wherever the source evidence makes it relevant.

APPLIED REFERENCE MANIFEST:
${body.context || "No reference manifest supplied."}

APPLIED REFERENCE CONTENT:
${references}

VISUAL EVIDENCE — OBSERVABLE FACTS ONLY, NOT EDITORIAL INTERPRETATION:
${visualEvidence}

EVIDENCE DISCIPLINE: the authentic transcript is the factual source of truth for spoken words. The Visual Evidence Pass is a separate factual observation channel for what is directly visible or non-verbally audible. Do not convert a visual observation into motive, emotion or causality unless the source supports it; uncertain interpretation must remain qualified.

CURRENT SOURCE TRANSCRIPT — THIS IS THE FACTUAL SOURCE OF TRUTH FOR DIALOGUE:
${body.transcript}`;
    return { selectedTone, system, user, targetWords, lowerWords, upperWords };
  }

  const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer for Gandrīz ideālas vakariņas. Write fluent, natural, broadcast-ready Latvian. Your task is SELECTIVE NARRATION, not transcript summarisation. Every line must add editorial value that the viewer cannot already get directly from picture or dialogue. Never invent facts. Never imitate wording from references. Protect participant dignity.

SELECTED TONE: ${selectedTone}
${toneProfile}

${FIFTH_DINER_EDITORIAL_RULES}

${SECOND_STORY_EDITORIAL_RULES}

${CREATIVE_EXECUTIVE_PRODUCER_RULES}

${GLOBAL_SCENE_DIRECTIVE_RULES}
The selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;
  const user = `Create the final Latvian TV voice-over for this scene.

EDITORIAL METHOD — FOLLOW IN THIS ORDER:
1. Read the transcript only as source evidence. Do not recap the scene.
2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback, comic escalation, internal dialogue or a detail the participants miss.
3. Do not list participant biographies, paraphrase audible dialogue, explain obvious actions, or narrate information the audience already understands.
4. Leave silence where narration adds nothing. The narrator is selective, not continuous.
5. Format EVERY intervention on one line exactly as: [HH:MM:SS] VO: <one or two broadcast-ready sentences>. No headings, no prose paragraphs, no commentary outside VO cues.
6. Keep each cue concise — normally 8-45 spoken words and never more than 55.
7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.
8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Hunt for details the participants miss, use internal dialogue when natural, and preserve opportunities for running jokes or callbacks. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”. If a generic documentary narrator could say the line, rewrite it.
9. CREATE A SECOND STORY: do not stop at reflection. Identify an additional source-grounded angle or game in the scene and author original framing, metaphor, hypothesis, prediction, provocative question or callback around verified facts. Advance that additional line across multiple cues when the material supports it. Invent the editorial idea around reality; never invent reality.
10. CREATIVE DIVERGENCE: do not submit the first reasonable idea. Generate competing alternatives, reject predictable reflection-only angles, and choose the freshest source-grounded premise. When the footage supports it, use format-level devices such as countdown, freeze-frame, split-screen, scorecard, contradiction tracker, recurring sound cue or ironic chapter title so the format becomes richer, not merely the VO.

VOICE-OVER AMOUNT STANDARD:
Final runtime: ${Math.round(finalRuntimeSeconds)} seconds.
Target ≈ ${targetWords} spoken words. Preferred standard band: ${lowerWords}-${upperWords} words (16.17%-17.17% of runtime at 130 Latvian words/minute). Aim to fit this standard by choosing enough legitimate editorial beats. Never exceed ${upperWords} spoken words. If the source does not contain enough legitimate beats, return a shorter selective script rather than padding with recap, biography, dialogue paraphrase or obvious action.

GLOBAL SCENE DIRECTIVE — APPLY TO THE COMPLETE VO OUTPUT:
${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}

Applied reference calibration: ${RATIO_REFERENCE_SOURCES.join(", ")}.
Applied production context:
${body.context || "No reference manifest supplied."}

APPLIED REFERENCE CONTENT:
${references}

VISUAL EVIDENCE — OBSERVABLE FACTS ONLY, NOT EDITORIAL INTERPRETATION:
${visualEvidence}

EVIDENCE DISCIPLINE: transcript = factual spoken-word channel; Visual Evidence Pass = factual observable channel. Editorial interpretation is DANA's separate layer and must never be presented as an observed fact when uncertain.

SOURCE TRANSCRIPT — FACTUAL DIALOGUE SOURCE OF TRUTH:
${body.transcript}`;
  return { selectedTone, system, user, targetWords, lowerWords, upperWords };
}

function metadataFor(finalRuntimeSeconds: number, tone: string, phase: string, correctionAttempt: number, outputRecoveryAttempt = 0) {
  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);
  return {
    dana_phase: phase,
    dana_correction_attempt: String(correctionAttempt),
    dana_output_recovery_attempt: String(outputRecoveryAttempt),
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
  maxOutputTokens = BACKGROUND_MAX_OUTPUT_TOKENS,
}: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  metadata: Record<string, string>;
  previousResponseId?: string;
  maxOutputTokens?: number;
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
      reasoning: { effort: "high" },
      max_output_tokens: maxOutputTokens,
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


async function createCorrectionResponse({
  apiKey,
  system,
  user,
  metadata,
  previousResponseId,
  maxOutputTokens = BACKGROUND_MAX_OUTPUT_TOKENS,
}: {
  apiKey: string;
  system: string;
  user: string;
  metadata: Record<string, string>;
  previousResponseId: string;
  maxOutputTokens?: number;
}) {
  const configuredCorrectionModel = process.env.OPENAI_VOICEOVER_MODEL || PRIMARY_VOICEOVER_MODEL;
  let model = configuredCorrectionModel;
  let created = await createBackgroundResponse({
    apiKey,
    model,
    system,
    user,
    metadata,
    previousResponseId,
    maxOutputTokens,
  });
  if (!created.response.ok && modelUnavailable(created.response, created.data) && model !== FALLBACK_VOICEOVER_MODEL) {
    model = FALLBACK_VOICEOVER_MODEL;
    created = await createBackgroundResponse({
      apiKey,
      model,
      system,
      user,
      metadata,
      previousResponseId,
      maxOutputTokens,
    });
  }
  return { ...created, model };
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


function goldenMasterRepairInstructions(goldenMaster: ReturnType<typeof scoreLepersGoldenMaster> | null) {
  if (!goldenMaster) return "No Golden Master repair map is required for this tone.";
  const d = goldenMaster.dimensions;
  const repairs: string[] = [];
  if (d.structure < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.structure) {
    repairs.push("STRUCTURE: restore every required section in exact order and all five canonical table schemas; do not rename headings or columns.");
  }
  if (d.depth < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.depth) {
    repairs.push("DEPTH: reach the reference-level deterministic target with about 1400+ analytical words outside VO MASTER, at least 10 edit rows, and at least 4 risk rows. Add only source-grounded analysis; never invent facts.");
  }
  if (d.voAmount < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.voAmount) {
    repairs.push("VO AMOUNT: keep only GALA VO TEKSTS spoken words inside the locked 16.17%–17.17% runtime band without recap or padding.");
  }
  if (d.humourAndPov < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.humourAndPov) {
    repairs.push("HUMOUR + POV: strengthen Fifth Dinner Guest opinion, contradiction, internal dialogue, viewer-thought questions and callbacks in legitimate VO beats; remove passive reactions and generic description.");
  }
  if (!goldenMaster.secondStory?.passes) {
    repairs.push("SECOND STORY: create and explicitly label OTRĀ STĀSTA LĪNIJA from verified reality, then develop the same authored angle through OTRĀ STĀSTA ATTĪSTĪBA as setup → escalation → payoff/callback. Do not settle for reflection-only commentary; preserve strong existing dimensions while adding the missing editorial storyline.");
  }
  if (!goldenMaster.creativeFreshness?.passes) {
    repairs.push(`FRESHNESS / WOW: current ${goldenMaster.creativeFreshness?.score ?? 0}/${goldenMaster.creativeFreshness?.threshold ?? 80}. Run the Creative Room again: generate genuinely competing angles, reject predictable ones, strengthen FORMAT SPICE with at least one scene-presentation device, state what production adds beyond the raw material, and choose a bolder source-defensible idea. ${goldenMaster.creativeFreshness?.deficiencies?.join(" ") || ""}`);
  }
  if (d.pace < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.pace) {
    repairs.push("PACE: keep VO cues concise, preferably 8–45 words, average roughly 12–35 words, and never exceed 55 words per cue.");
  }
  if (d.productionUsefulness < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.productionUsefulness) {
    repairs.push("PRODUCTION USEFULNESS: restore explicit KEEP, TIGHTEN, REMOVE and VERIFY decisions plus concrete Montāžas ritms, Skaņas un mūzikas akcenti, Grafikas and B-roll guidance where supported.");
  }
  if (d.promo < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.promo) {
    repairs.push("PROMO: provide 5 teaser beats, a 30 sekunžu promo VO, a 15 sekunžu promo VO, and 4 social hooks, all grounded in the current episode.");
  }
  if (d.characterInsight < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.characterInsight) {
    repairs.push("CHARACTER: restore EP LĒMUMS, Epizodes caurviju motīvs, Raksturu funkcijas montāžā, Kas strādā and Kas bremzē with specific source-grounded judgement.");
  }
  if (d.formatting < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.formatting) {
    repairs.push("FORMATTING: restore exact Golden Master headings, canonical table columns and Galīgā producenta rekomendācija formatting.");
  }
  return repairs.length ? repairs.join("\n") : "All deterministic Golden Master dimensions are already at target; preserve them exactly.";
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
    if (!appliedSources.includes("DANA AI Master Production System")) {
      return NextResponse.json(
        { ok: false, message: "The DANA AI Master Production System must remain applied as the governing editorial source.", requestId },
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
      const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, selectedTone);
      const quality = qualityMetricsForOutput(text, selectedTone);
      const goldenMaster = isLepersTone(selectedTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;
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
      if (goldenMaster && (!goldenMaster.secondStory?.passes || !goldenMaster.creativeFreshness?.passes)) {
        return NextResponse.json(
          {
            ok: false,
            message: `This older synchronous session cannot release a Lepers package without the mandatory Second Story and WOW Creative Freshness gates. Refresh DANA Studio and regenerate with the current Creative Room engine. Reference: ${requestId}`,
            goldenMaster,
            requestId,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({
        ok: true,
        status: "completed",
        model: legacy.data.model || LEGACY_VOICEOVER_MODEL,
        text,
        metrics,
        quality,
        goldenMaster,
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

    const metadata = data.metadata || {};
    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);
    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);
    const outputRecoveryAttempt = Number(metadata.dana_output_recovery_attempt || 0);
    const phase = metadata.dana_phase || "initial";
    const correctionTone = metadata.dana_tone || DEFAULT_TONE;
    const correctionToneProfile = toneProfileFor(correctionTone);

    if (data.status === "queued" || data.status === "in_progress") {
      return NextResponse.json({ ok: true, status: data.status, responseId, phase, model: data.model, requestId });
    }

    if (data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens" && outputRecoveryAttempt < MAX_OUTPUT_RECOVERIES) {
      const lepersRecovery = isLepersTone(correctionTone);
      const recoverySystem = lepersRecovery
        ? `You are DANA AI's final Latvian executive story editor, fifth diner and creative executive producer. The previous response reached its output-token ceiling before the complete package was delivered. Regenerate the COMPLETE Lepers Golden Master package from the beginning using the original source context. Preserve verified facts, participant dignity, exact package architecture, Fifth Dinner Guest POV, Second Story, Creative Room / WOW, FORMAT SPICE and Golden Master requirements. Do not continue a truncated fragment. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`
        : `You are DANA AI's final Latvian television voice-over editor, fifth diner and creative executive producer. The previous response reached its output-token ceiling. Regenerate the COMPLETE deliverable from the beginning using the original source context; do not continue a truncated fragment. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES}`;
      const recoveryUser = lepersRecovery
        ? `OUTPUT EXPANSION RECOVERY ${outputRecoveryAttempt + 1}/${MAX_OUTPUT_RECOVERIES}: Produce the entire nine-part Lepers Golden Master package from the beginning. The previous draft was incomplete only because the token ceiling was reached. Keep the strongest source-grounded creative decisions, but return one complete self-contained package. Do not omit late sections, do not stop after VO MASTER, and do not merely continue from the cutoff.`
        : `OUTPUT EXPANSION RECOVERY ${outputRecoveryAttempt + 1}/${MAX_OUTPUT_RECOVERIES}: Return the complete final deliverable from the beginning. The previous response was truncated by the output-token ceiling; do not continue from the cutoff.`;
      const recovery = await createCorrectionResponse({
        apiKey,
        system: recoverySystem,
        user: recoveryUser,
        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "output-expansion", correctionAttempt, outputRecoveryAttempt + 1),
        previousResponseId: responseId,
        maxOutputTokens: MAX_OUTPUT_RECOVERY_TOKENS,
      });
      if (recovery.response.ok && recovery.data.id) {
        return NextResponse.json({
          ok: true,
          status: recovery.data.status || "queued",
          responseId: recovery.data.id,
          phase: "output-expansion",
          outputRecoveryAttempt: outputRecoveryAttempt + 1,
          model: recovery.data.model || recovery.model,
          tone: correctionTone,
          requestId,
        });
      }
    }

    if (data.status !== "completed") {
      const statusMessage = data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens"
        ? "DANA AI could not complete the full package within the expanded output budget. Please regenerate; the source and editorial settings remain intact."
        : providerError(data, `OpenAI voice-over job ended with status ${data.status || "unknown"}.`);
      return NextResponse.json(
        { ok: false, message: `${statusMessage} Reference: ${requestId}`, requestId },
        { status: 502 },
      );
    }

    const text = responseText(data);
    if (!text) {
      return NextResponse.json({ ok: false, message: `OpenAI completed the job without usable voice-over text. Reference: ${requestId}`, requestId }, { status: 502 });
    }
    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);
    const quality = qualityMetricsForOutput(text, correctionTone);
    const goldenMaster = isLepersTone(correctionTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;
    const needsCorrection =
      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard" || Boolean(goldenMaster && (goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes || !goldenMaster.creativeFreshness?.passes));

    if (needsCorrection && correctionAttempt < MAX_BACKGROUND_CORRECTIONS) {
      const lowerWords = Number(metadata.dana_lower_words || 0);
      const upperWords = Number(metadata.dana_upper_words || 0);
      const targetWords = Number(metadata.dana_target_words || 0);
      const ratioInstruction = metrics.overLimit
        ? `The draft is above the format ceiling. Remove the weakest narrator interventions until the spoken total is no more than ${upperWords} words, preferably near ${targetWords}.`
        : metrics.standardStatus === "under-standard"
          ? `The draft is below the preferred ${lowerWords}-${upperWords} word band. Using the ORIGINAL SOURCE TRANSCRIPT from the previous response context, add only additional legitimate narrator interventions where the narrator contributes new editorial value. If there are no more legitimate beats, keep the script shorter rather than padding it.`
          : `Keep the spoken amount inside the ${lowerWords}-${upperWords} word standard while fixing the voice-over structure.`;
      const lepersCorrection = isLepersTone(correctionTone);
      const correctionSystem = lepersCorrection
        ? `You are DANA AI's final Latvian executive story editor and fifth diner. Preserve the COMPLETE Lepers Standard production package, its exact nine-part architecture, verified facts, decisive edit logic, warm lightly ironic mood and participant dignity. Every VO cue must retain active fifth-diner opinion and added value; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} GOLDEN MASTER CONFORMANCE: preserve the original GLOBAL SCENE DIRECTIVE from previous response context and revise the complete package until the deterministic Golden Master score reaches at least ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`
        : `You are DANA AI's final Latvian television voice-over editor, fifth diner and creative executive producer. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. Every cue must express an active point of view or added editorial layer; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} The selected tone must remain clearly recognisable after revision; do not let correction collapse into safe, predictable or reflection-only writing.`;
      const correctionUser = lepersCorrection
        ? `Revise the COMPLETE production package without deleting or renaming any required section. ${ratioInstruction} The narration ratio counts ONLY words in the GALA VO TEKSTS column of section 4. Keep the Laiks / Funkcija / GALA VO TEKSTS / Izpildījums / montāža table. Improve or trim only legitimate narrator beats; every GALA VO TEKSTS row must contain opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, internal dialogue or a non-obvious detail. Replace generic descriptive VO with opinionated Fifth Dinner Guest narration. Hunt for details the participants miss and exploit running jokes/callbacks when supported. Remove “hmm”, “jā”, “traki”, “nu gan” and similar empty observer reactions. Never pad with transcript recap. Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth. Preserve and develop the Second Story across the package: OTRĀ STĀSTA LĪNIJA must be a source-grounded authored premise, and OTRĀ STĀSTA ATTĪSTĪBA must carry it through setup → escalation → payoff/callback. CREATIVE ROOM / WOW: preserve or rebuild the visible Creative Room with 3 finalists, 2 rejected predictable angles, 3+ FORMAT SPICE devices, the explicit new production value and the boldest defendable idea. Do not merely polish the same safe premise. GOLDEN MASTER CONFORMANCE: current score ${goldenMaster?.score ?? 0}/100. Current dimension scores: ${JSON.stringify(goldenMaster?.dimensions || {})}. Fix these measurable deficiencies without changing verified facts or losing the original Editorial brief: ${(goldenMaster?.deficiencies || []).join(" ")}\n\nPRECISION REPAIR MAP — repair deficient dimensions first and preserve dimensions already at full score:\n${goldenMasterRepairInstructions(goldenMaster)}\n\nCURRENT PACKAGE (${metrics.words} spoken VO words; ${quality.cueCount} VO rows):\n${text}`
        : `Rewrite the complete draft as genuine TV voice-over. ${ratioInstruction}\nEvery output line must use exactly: [HH:MM:SS] VO: <one or two concise sentences>. Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Every cue must contain opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, internal dialogue or a non-obvious detail. Rewrite generic descriptive VO as active Fifth Dinner Guest narration; hunt for details the participants miss and exploit callbacks when the source supports them. Remove empty “hmm”, “jā”, “traki”, “nu gan” reactions. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio. Do not include headings or explanatory prose. Keep each cue under 55 spoken words.\n\nCURRENT DRAFT (${metrics.words} spoken words; ${quality.cueCount} valid VO cues):\n${text}`;
      const correction = await createCorrectionResponse({
        apiKey,
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
          model: correction.data.model || correction.model,
          tone: correctionTone,
          requestId,
        });
      }
    }

    if (!quality.formatPasses) {
      return NextResponse.json(
        {
          ok: false,
          message: `DANA AI rejected the generated output because it did not satisfy the selected editorial format contract. Reference: ${requestId}`,
          requestId,
        },
        { status: 502 },
      );
    }
    if (goldenMaster && (goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes || !goldenMaster.creativeFreshness?.passes)) {
      return NextResponse.json(
        {
          ok: false,
          message: `DANA AI rejected the Lepers package because ${!goldenMaster.creativeFreshness?.passes ? `Creative Freshness / WOW remained ${goldenMaster.creativeFreshness?.score ?? 0}/${goldenMaster.creativeFreshness?.threshold ?? 80}` : !goldenMaster.secondStory?.passes ? "the required Second Story editorial line was still missing or underdeveloped" : `Golden Master conformance remained ${goldenMaster.score}/100`}; minimum Golden Master quality is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100 and WOW freshness must also pass. Reference: ${requestId}`,
          goldenMaster,
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
      goldenMaster,
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
