export type LearningAuthority =
  | "canonical"
  | "strong"
  | "supporting"
  | "experimental";

export type LearningStatus =
  | "uploading"
  | "extracting"
  | "transcribing"
  | "analyzing"
  | "extracting-learning"
  | "verifying"
  | "learned"
  | "needs-attention";

export type LearningSourceType = "document" | "video";
export type LearningContentKind = "document-text" | "video-transcript";
export type LearningConfidence = "high" | "medium" | "low";

export type LearningSource = {
  id: string;
  sourceFingerprint: string;
  fingerprintAlgorithm: string;
  originalFilename: string;
  sourceType: LearningSourceType;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  authority: LearningAuthority;
  active: boolean;
  status: LearningStatus;
  version: number;
  uploadedAt: string;
  learnedAt: string | null;
  modelProvenance: Record<string, unknown>;
};

export type LearningEvidence = {
  timecode?: string;
  excerpt: string;
  supports: string;
};

export type LearningEditorialEssence = {
  narratorRole: string;
  narratorAttitude: string;
  humourMechanisms: string[];
  sentenceRhythm: string;
  voiceoverDensity: string;
  sceneSelectionLogic: string;
  characterTreatment: string;
  conflictAndDignityRules: string[];
  pacing: string;
  escalationPatterns: string[];
  callbacks: string[];
  transitions: string[];
  hooksAndReveals: string[];
  editingLogic: string[];
  reactionShotLogic: string[];
  promoTeaserMechanisms: string[];
  recurringLanguagePatterns: string[];
  whatWorks: string[];
  whatWeakens: string[];
  avoid: string[];
  productionRules: string[];
};

export type LearningProfile = {
  sourceId: string;
  editorialEssence: LearningEditorialEssence;
  reusablePatterns: {
    structural: string[];
    voiceover: string[];
    editorialDecisions: string[];
    antiPatterns: string[];
  };
  evidence: LearningEvidence[];
  tags: string[];
  verification: {
    coverageScore: number;
    completenessScore: number;
    confidence: LearningConfidence;
    notes: string[];
    conflictingRules: string[];
    verified: boolean;
  };
};

export type LearningSourceContent = {
  sourceId: string;
  content: string;
  contentKind: LearningContentKind;
  language: string;
  durationSeconds: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LearningChunk = {
  id?: string;
  sourceId: string;
  category: string;
  tags: string[];
  authority: LearningAuthority;
  content: string;
};
