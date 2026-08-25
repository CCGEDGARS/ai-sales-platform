import { LEPERS_REQUIRED_SECTIONS } from "./lepers-standard";

export const LEPERS_GOLDEN_MASTER_NAME = "Lepers Golden Master · locked 10/10 benchmark";
export const LEPERS_GOLDEN_MASTER_THRESHOLD = 95;

export const LEPERS_GOLDEN_MASTER_FINGERPRINT = {
  source: "RIHARDS_LEPERS_Production_Analysis_and_VO.docx",
  referencePages: 16,
  dramaturgyActs: 7,
  teaserBeats: 5,
  socialHooks: 4,
  targetVoRatio: 1 / 6,
  preferredVoRatioMin: 0.1617,
  preferredVoRatioMax: 0.1717,
  narratorWpm: 130,
  cueWordMin: 8,
  cueWordPreferredMax: 45,
  cueWordHardMax: 55,
  weights: {
    structure: 20,
    depth: 15,
    voAmount: 15,
    humourAndPov: 15,
    pace: 10,
    productionUsefulness: 10,
    promo: 5,
    characterInsight: 5,
    formatting: 5,
    total: 100,
  },
} as const;

export type GoldenMasterDimensions = {
  structure: number;
  depth: number;
  voAmount: number;
  humourAndPov: number;
  pace: number;
  productionUsefulness: number;
  promo: number;
  characterInsight: number;
  formatting: number;
};

export type LepersGoldenMasterScore = {
  name: string;
  score: number;
  threshold: number;
  passes: boolean;
  dimensions: GoldenMasterDimensions;
  secondStory: {
    present: boolean;
    developed: boolean;
    signals: number;
    passes: boolean;
  };
  deficiencies: string[];
};

const WORD_RE = /[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+(?:[-'][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+)*/g;

function words(text: string) {
  return String(text || "").match(WORD_RE)?.length || 0;
}

function section(text: string, start: RegExp, end?: RegExp) {
  const source = String(text || "");
  const startIndex = source.search(start);
  if (startIndex < 0) return "";
  const rest = source.slice(startIndex);
  if (!end) return rest;
  const next = rest.search(end);
  return next > 0 ? rest.slice(0, next) : rest;
}

function tableRows(block: string) {
  return String(block || "")
    .split(/\r?\n/)
    .filter((line) => /^\s*\|/.test(line))
    .filter((line) => !/^\s*\|\s*:?-{3,}/.test(line))
    .filter((line) => !/\|\s*(Akts|Laiks|Līmenis|✓|#)\s*\|/i.test(line)).length;
}

function voCells(text: string) {
  const block = section(text, /(?:^|\n)#{0,3}\s*4\.\s*VO MASTER\b/i, /\n#{0,3}\s*5\.\s*Teaseri/i);
  return block
    .split(/\r?\n/)
    .filter((line) => /^\s*\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .map((cells) => cells[3] || "")
    .filter((cell) => cell && !/GALA VO TEKSTS/i.test(cell) && !/^-{3,}$/.test(cell.replace(/\s/g, "")));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}


function secondStoryMetrics(source: string) {
  const premise = source.match(/OTRĀ STĀSTA LĪNIJA\s*[:—-]\**\s*([^\n]{35,})/i);
  const development = source.match(/OTRĀ STĀSTA ATTĪSTĪBA\s*[:—-]\**\s*([^\n]{35,})/i);
  const authoredText = `${premise?.[1] || ""} ${development?.[1] || ""} ${voCells(source).join(" ")}`.toLocaleLowerCase("lv-LV");
  const signals = (authoredText.match(/\b(atcerēsimies|atgriežamies|solīj|prognoz|hipotēz|jautājum|pulksten|spēl|pretstat|metafor|iron|tikmēr|bet|tomēr|vs)\b/g) || []).length +
    (authoredText.match(/\?/g) || []).length;
  const present = Boolean(premise);
  const developed = Boolean(development);
  return { present, developed, signals, passes: present && developed };
}

export function scoreLepersGoldenMaster(text: string, runtimeSeconds: number): LepersGoldenMasterScore {
  const source = String(text || "");
  const deficiencies: string[] = [];
  const weights = LEPERS_GOLDEN_MASTER_FINGERPRINT.weights;

  const requiredPresent = LEPERS_REQUIRED_SECTIONS.filter((heading) => source.includes(heading)).length;
  const exactTables = [
    /\|\s*Akts\s*\|\s*Laiks\s*\|\s*Funkcija\s*\|\s*Saturs\s*\|\s*Montāžas uzdevums\s*\|/i,
    /\|\s*Laiks\s*\|\s*Lēmums\s*\|\s*Materiāls\s*\|\s*Konkrēta darbība\s*\|\s*Vērtība\s*\|/i,
    /\|\s*Laiks\s*\|\s*Funkcija\s*\|\s*GALA VO TEKSTS\s*\|\s*Izpildījums \/ montāža\s*\|/i,
    /\|\s*Līmenis\s*\|\s*Laiks\s*\|\s*Jautājums\s*\|\s*Risks\s*\|\s*Lēmums\s*\|/i,
    /\|\s*✓\s*\|\s*Joma\s*\|\s*Pārbaude\s*\|/i,
  ].filter((pattern) => pattern.test(source)).length;
  const structure = clamp(Math.round(weights.structure * ((requiredPresent / LEPERS_REQUIRED_SECTIONS.length) * 0.7 + (exactTables / 5) * 0.3)), 0, weights.structure);
  if (structure < weights.structure) deficiencies.push("Restore the exact Golden Master section order and required table schemas.");

  const analysisWords = Math.max(0, words(source) - words(voCells(source).join(" ")));
  const editRows = tableRows(section(source, /(?:^|\n)#{0,3}\s*3\.\s*Montāžas lēmumi/i, /\n#{0,3}\s*4\.\s*VO MASTER/i));
  const riskRows = tableRows(section(source, /(?:^|\n)#{0,3}\s*6\.\s*Redakcionālie/i, /\n#{0,3}\s*7\.\s*Montāžas/i));
  const depthRatio = clamp(analysisWords / 1400, 0, 1) * 0.55 + clamp(editRows / 10, 0, 1) * 0.3 + clamp(riskRows / 4, 0, 1) * 0.15;
  const depth = Math.round(weights.depth * depthRatio);
  if (depth < weights.depth) deficiencies.push("Increase analytical depth, chronological edit decisions and source-grounded risk control to the 16-page reference level.");

  const cues = voCells(source);
  const voWords = words(cues.join(" "));
  const spokenSeconds = (voWords / LEPERS_GOLDEN_MASTER_FINGERPRINT.narratorWpm) * 60;
  const ratio = runtimeSeconds > 0 ? spokenSeconds / runtimeSeconds : 0;
  let voAmount = 0;
  if (ratio >= LEPERS_GOLDEN_MASTER_FINGERPRINT.preferredVoRatioMin && ratio <= LEPERS_GOLDEN_MASTER_FINGERPRINT.preferredVoRatioMax) voAmount = weights.voAmount;
  else if (ratio > 0 && ratio <= 0.19) voAmount = Math.round(weights.voAmount * 0.7);
  if (voAmount < weights.voAmount) deficiencies.push("Bring VO MASTER spoken words into the locked 16.17%–17.17% runtime band without padding.");

  const joinedCues = cues.join(" ").toLocaleLowerCase("lv-LV");
  const emptyReaction = /(^|[.!?]\s*)(hmm|hm|jā|nu jā|traki|nu gan|oho|interesanti)([.!?]|$)/i.test(joinedCues);
  const editorialSignals = (joinedCues.match(/\b(bet|taču|izskatās|tiesa|vai|tomēr|pirms|acīmredzot|laikam|kamēr)\b/g) || []).length;
  const questionSignals = (cues.join(" ").match(/\?/g) || []).length;
  const secondStory = secondStoryMetrics(source);
  const authoredLayer = clamp((editorialSignals + questionSignals * 2 + secondStory.signals) / Math.max(6, cues.length), 0.65, 1);
  const authorshipMultiplier = secondStory.passes ? 1 : 0.45;
  const humourAndPov = emptyReaction ? 0 : Math.round(weights.humourAndPov * authoredLayer * authorshipMultiplier);
  if (!secondStory.passes) deficiencies.push("Create and develop OTRĀ STĀSTA LĪNIJA from verified reality. Reflection-only VO is not enough: add a distinct authored premise and carry it through OTRĀ STĀSTA ATTĪSTĪBA as setup, escalation and payoff/callback without inventing facts.");
  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");

  const cueWordCounts = cues.map(words);
  const avgCueWords = cueWordCounts.length ? cueWordCounts.reduce((a, b) => a + b, 0) / cueWordCounts.length : 0;
  const hardOvers = cueWordCounts.filter((count) => count > LEPERS_GOLDEN_MASTER_FINGERPRINT.cueWordHardMax).length;
  const preferredCueShare = cueWordCounts.length ? cueWordCounts.filter((count) => count >= 8 && count <= 45).length / cueWordCounts.length : 0;
  const pace = hardOvers ? 0 : Math.round(weights.pace * (preferredCueShare * 0.75 + (avgCueWords >= 12 && avgCueWords <= 35 ? 0.25 : 0)));
  if (pace < weights.pace) deficiencies.push("Match Golden Master cue rhythm: concise 8–45 word interventions, varied sentence shape, no cue above 55 words.");

  const productionSignals = ["KEEP", "TIGHTEN", "REMOVE", "VERIFY", "Montāžas ritms", "Skaņas un mūzikas akcenti", "Grafikas", "B-roll"].filter((needle) => source.includes(needle)).length;
  const productionUsefulness = Math.round(weights.productionUsefulness * clamp(productionSignals / 8, 0, 1));
  if (productionUsefulness < weights.productionUsefulness) deficiencies.push("Restore editor-facing KEEP/TIGHTEN/REMOVE/VERIFY density plus concrete rhythm, sound, graphics and B-roll decisions.");

  const teaserBlock = section(source, /(?:^|\n)#{0,3}\s*5\.\s*Teaseri/i, /\n#{0,3}\s*6\.\s*Redakcionālie/i);
  const teaserRows = tableRows(teaserBlock);
  const socialHookCount = (teaserBlock.match(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/g) || []).length;
  const promoSignals = Number(/30 sekunžu promo VO/i.test(teaserBlock)) + Number(/15 sekunžu promo VO/i.test(teaserBlock));
  const promo = Math.round(weights.promo * clamp((clamp(teaserRows / 5, 0, 1) * 0.45) + (clamp(socialHookCount / 4, 0, 1) * 0.35) + ((promoSignals / 2) * 0.2), 0, 1));
  if (promo < weights.promo) deficiencies.push("Match the reference promo package: 5 teaser beats, 30s VO, 15s VO and 4 social hooks.");

  const characterSignals = ["EP LĒMUMS", "Epizodes caurviju motīvs", "Raksturu funkcijas montāžā", "Kas strādā", "Kas bremzē"].filter((needle) => source.includes(needle)).length;
  const characterInsight = Math.round(weights.characterInsight * clamp(characterSignals / 5, 0, 1));
  if (characterInsight < weights.characterInsight) deficiencies.push("Strengthen character thesis, through-line motif, role functions and explicit EP judgement.");

  const formattingSignals = exactTables + Number(requiredPresent === LEPERS_REQUIRED_SECTIONS.length) + Number(/Galīgā producenta rekomendācija/.test(source));
  const formatting = Math.round(weights.formatting * clamp(formattingSignals / 7, 0, 1));
  if (formatting < weights.formatting) deficiencies.push("Restore exact Golden Master headings, table columns and final recommendation formatting.");

  const dimensions = { structure, depth, voAmount, humourAndPov, pace, productionUsefulness, promo, characterInsight, formatting };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  return {
    name: LEPERS_GOLDEN_MASTER_NAME,
    score,
    threshold: LEPERS_GOLDEN_MASTER_THRESHOLD,
    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes,
    dimensions,
    secondStory,
    deficiencies,
  };
}
