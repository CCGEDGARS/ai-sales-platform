import type {
  LearningAuthority,
  LearningChunk,
  LearningConfidence,
  LearningEditorialEssence,
  LearningEvidence,
  LearningProfile,
} from "./learning-types";

const ESSENCE_ARRAY_FIELDS = [
  "humourMechanisms",
  "conflictAndDignityRules",
  "escalationPatterns",
  "callbacks",
  "transitions",
  "hooksAndReveals",
  "editingLogic",
  "reactionShotLogic",
  "promoTeaserMechanisms",
  "recurringLanguagePatterns",
  "whatWorks",
  "whatWeakens",
  "avoid",
  "productionRules",
] as const;

const ESSENCE_STRING_FIELDS = [
  "narratorRole",
  "narratorAttitude",
  "sentenceRhythm",
  "voiceoverDensity",
  "sceneSelectionLogic",
  "characterTreatment",
  "pacing",
] as const;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(cleanString).filter(Boolean).slice(0, 40)
    : [];
}

function extractJson(text: string) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced || raw;
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("The learning model did not return a JSON object.");
  return JSON.parse(source.slice(first, last + 1)) as Record<string, unknown>;
}

function normalizeEvidence(value: unknown): LearningEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const excerpt = cleanString(row.excerpt);
      const supports = cleanString(row.supports);
      const timecode = cleanString(row.timecode);
      if (!excerpt || !supports) return null;
      return { ...(timecode ? { timecode } : {}), excerpt, supports };
    })
    .filter((item): item is LearningEvidence => Boolean(item))
    .slice(0, 30);
}

export function parseLearningProfile(sourceId: string, text: string): LearningProfile {
  const parsed = extractJson(text);
  const rawEssence =
    parsed.editorialEssence && typeof parsed.editorialEssence === "object"
      ? (parsed.editorialEssence as Record<string, unknown>)
      : {};
  const editorialEssence = {} as LearningEditorialEssence;
  for (const key of ESSENCE_STRING_FIELDS) editorialEssence[key] = cleanString(rawEssence[key]);
  for (const key of ESSENCE_ARRAY_FIELDS) editorialEssence[key] = cleanStringArray(rawEssence[key]);

  const reusable =
    parsed.reusablePatterns && typeof parsed.reusablePatterns === "object"
      ? (parsed.reusablePatterns as Record<string, unknown>)
      : {};
  const evidence = normalizeEvidence(parsed.evidence);
  const reportedConflicts = cleanStringArray(parsed.reportedConflicts);
  const profile: LearningProfile = {
    sourceId,
    editorialEssence,
    reusablePatterns: {
      structural: cleanStringArray(reusable.structural),
      voiceover: cleanStringArray(reusable.voiceover),
      editorialDecisions: cleanStringArray(reusable.editorialDecisions),
      antiPatterns: cleanStringArray(reusable.antiPatterns),
    },
    evidence,
    tags: cleanStringArray(parsed.tags),
    verification: {
      coverageScore: 0,
      completenessScore: 0,
      confidence: "low",
      notes: [],
      conflictingRules: reportedConflicts,
      verified: false,
    },
  };
  return verifyLearningProfile(profile);
}

export function verifyLearningProfile(profile: LearningProfile): LearningProfile {
  const essence = profile.editorialEssence;
  const stringFilled = ESSENCE_STRING_FIELDS.filter((key) => cleanString(essence[key])).length;
  const arraysFilled = ESSENCE_ARRAY_FIELDS.filter((key) => cleanStringArray(essence[key]).length > 0).length;
  const reusableFilled = Object.values(profile.reusablePatterns).filter(
    (value) => Array.isArray(value) && value.length > 0,
  ).length;
  const requiredCount = ESSENCE_STRING_FIELDS.length + ESSENCE_ARRAY_FIELDS.length + 4;
  const filledCount = stringFilled + arraysFilled + reusableFilled;
  const completenessScore = Math.round((filledCount / requiredCount) * 100);
  const evidenceCount = profile.evidence.length;
  const coverageScore = Math.min(
    100,
    Math.round(completenessScore * 0.75 + Math.min(evidenceCount, 8) * 3.125),
  );
  const notes: string[] = [];
  if (completenessScore < 75) notes.push("Learning profile is missing too many required editorial dimensions.");
  if (evidenceCount < 2) notes.push("Learning profile needs at least two source-bound evidence points.");
  if (profile.tags.length < 3) notes.push("Learning profile needs at least three useful retrieval tags.");
  if (!essence.narratorRole) notes.push("Narrator role is missing.");
  if (!essence.productionRules.length) notes.push("Reusable production rules are missing.");
  const verified =
    completenessScore >= 75 &&
    evidenceCount >= 2 &&
    profile.tags.length >= 3 &&
    Boolean(essence.narratorRole) &&
    essence.productionRules.length > 0;
  const confidence: LearningConfidence = verified
    ? completenessScore >= 90 && evidenceCount >= 4
      ? "high"
      : "medium"
    : "low";
  return {
    ...profile,
    verification: {
      ...profile.verification,
      coverageScore,
      completenessScore,
      confidence,
      notes,
      verified,
    },
  };
}

export function learningProfileChunks(
  profile: LearningProfile,
  authority: LearningAuthority,
): LearningChunk[] {
  if (!profile.verification.verified) return [];
  const e = profile.editorialEssence;
  const chunks: Array<[string, string]> = [
    ["Narrator", `Narrator role: ${e.narratorRole}\nNarrator attitude: ${e.narratorAttitude}\nSentence rhythm: ${e.sentenceRhythm}\nVO density: ${e.voiceoverDensity}`],
    ["Humour", [...e.humourMechanisms, ...e.callbacks, ...e.recurringLanguagePatterns].join("\n")],
    ["Story structure", [e.sceneSelectionLogic, e.pacing, ...e.escalationPatterns, ...e.transitions, ...e.hooksAndReveals].join("\n")],
    ["Character", [e.characterTreatment, ...e.conflictAndDignityRules].join("\n")],
    ["Editing", [...e.editingLogic, ...e.reactionShotLogic].join("\n")],
    ["Promo", [...e.promoTeaserMechanisms, ...e.hooksAndReveals].join("\n")],
    ["Production rules", [...e.whatWorks, ...e.whatWeakens, ...e.avoid, ...e.productionRules].join("\n")],
    ["Reusable patterns", [...profile.reusablePatterns.structural, ...profile.reusablePatterns.voiceover, ...profile.reusablePatterns.editorialDecisions, ...profile.reusablePatterns.antiPatterns].join("\n")],
  ];
  return chunks
    .filter(([, content]) => content.trim())
    .map(([category, content]) => ({
      sourceId: profile.sourceId,
      category,
      tags: Array.from(new Set([category, ...profile.tags])).slice(0, 20),
      authority,
      content: content.trim(),
    }));
}
