"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { createFile as createMp4File } from "mp4box";
import { buildFormattedProductionDocx } from "./lib/formatted-production-docx";
import "./progress.css";
import "./modules.css";

const stages = [
  ["01", "Knowledge base", "Reference library"],
  ["02", "Transcription", "Authentic timecoded transcript"],
  ["03", "Story analysis", "Editorial intelligence"],
  ["04", "Voice-over", "Editor-ready script"],
  ["05", "Export", "Production package"],
] as const;

type Source = [string, string, string, string];
type Voiceover = {
  id: number;
  title: string;
  project: string;
  scene: string;
  updated: string;
  status: "Draft" | "Approved" | "Final";
  text: string;
};
type TimecodeDocument = {
  id: number;
  title: string;
  updated: string;
  text: string;
};
type VoiceoverMetrics = {
  words: number;
  spokenSeconds: number;
  ratioPercent: number;
  targetPercent: number;
  lowerPercent: number;
  upperPercent: number;
  passes: boolean;
};
type GoldenMasterMetrics = {
  score: number;
  threshold: number;
  passes: boolean;
  dimensions: Record<string, number>;
  narratorPresence?: {
    score: number;
    threshold: number;
    passes: boolean;
    deficiencies: string[];
  };
  creativeFreshness?: {
    score: number;
    threshold: number;
    passes: boolean;
    dimensions: Record<string, number>;
    deficiencies: string[];
  };
  deficiencies: string[];
};
type TranscriptResult = {
  fileName: string;
  transcript: string;
  model: string;
  timecodes: boolean;
  visualEvidence?: string;
  visualEvidenceAvailable?: boolean;
  visualEvidenceModel?: string;
};
type SegmentPayload = {
  file: File;
  startSeconds: number;
  originalFile: string;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_DIRECT_MODEL = "gemini-3.6-flash";
const VERCEL_NATIVE_PROXY_LIMIT = 3_800_000;
type Mp4Track = {
  id: number;
  video?: unknown;
  audio?: unknown;
  duration?: number;
  timescale?: number;
  nb_samples?: number;
};
type Mp4Info = { duration: number; timescale: number; tracks: Mp4Track[] };
type Mp4Processor = {
  onError?: (error: unknown) => void;
  onReady?: (info: Mp4Info) => void;
  onSegment?: (
    trackId: number,
    user: unknown,
    buffer: ArrayBuffer,
    sampleNumber: number,
    last: boolean,
  ) => void;
  setSegmentOptions: (
    trackId: number,
    user: number,
    options: { nbSamples: number; rapAlignement: boolean },
  ) => void;
  initializeSegmentation: (mode: "combined") => { buffer?: ArrayBuffer };
  start: () => void;
  appendBuffer: (buffer: ArrayBuffer & { fileStart: number }) => unknown;
  flush: () => void;
};

const CORE_SOURCE_NAME = "DANA AI Master Production System";

const defaultSources = [
  ["British original", "Come Dine With Me.mp4", "Format reference", "MP4"],
  [
    "Latvian reference",
    "Ainārs Ašaks · 15.12.2011",
    "Episode reference",
    "MP4",
  ],
  ["Latvian reference", "Ieva Janiševa · Season 3", "Episode reference", "MP4"],
  [
    "Production system",
    "DANA AI Master Production System",
    "Editorial rules",
    "TXT",
  ],
  [
    "Production reference",
    "RIHARDS LEPERS.docx",
    "Protected production reference",
    "DOCX",
  ],
  [
    "Production reference",
    "DANA AI — EXECUTIVE STORY PRODUCER v3.docx",
    "Protected production reference",
    "DOCX",
  ],
  [
    "Video reference",
    "Top Ultimate Come Dine With Me Moments.mp4",
    "Protected format reference",
    "MP4",
  ],
] as Source[];

const sourceApplications: Record<string, string> = {
  "Come Dine With Me.mp4": "British format benchmark: observational narration, comic timing, reveal structure and the balance between participant dialogue and narrator commentary.",
  "Ainārs Ašaks · 15.12.2011": "Latvian episode benchmark: local rhythm, conversational density, scene transitions and culturally natural humour.",
  "Ieva Janiševa · Season 3": "Latvian episode benchmark: character positioning, reaction editing, escalation and the amount of narration used between authentic exchanges.",
  "DANA AI Master Production System": "Governing production rules: chronology, evidence discipline, timecode accuracy, participant dignity and Green/Amber/Red editorial risk review.",
  "RIHARDS LEPERS.docx": "Reference editorial benchmark: approved story architecture, voice-over density, humour style, character framing and the standard expected from a finished scene analysis.",
  "DANA AI — EXECUTIVE STORY PRODUCER v3.docx": "Executive story-editing benchmark: decision quality, conflict, stakes, pacing, hooks, scene purpose and production-ready recommendations.",
  "Top Ultimate Come Dine With Me Moments.mp4": "Format-moment benchmark: proven comic mechanisms, awkward pauses, reaction shots, escalation and memorable narrator interventions.",
};

const TAILORED_TONE = "Tailored · custom editorial direction";
const DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";
const GOLDEN_MASTER_LABEL = "Lepers Golden Master · locked 10/10 benchmark";
const LEGACY_DEFAULT_EDITORIAL_BRIEF = 'Create a production-ready Latvian package for this scene at the Rihards Lepers benchmark: warm, knowing, lightly ironic and character-led. Build from contrast, reactions, awkwardness, callbacks and controlled chaos without describing obvious actions, humiliating participants or inventing facts.';
const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive: do not submit the first reasonable idea. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE—bold callbacks, visual/editing games, provocations, metaphors and hooks that make the show richer than the raw footage. Fifth Dinner Guest VO must surprise, not reflect. Never invent reality or humiliate participants; keep VO selective near 16.67%. The narrator is the invisible fifth dinner guest and must be recognisably and conversationally present across the scene: directly react to participant statements, question or challenge weak logic, occasionally address participants, remember promises and contradictions, and build callbacks/running jokes from verified behaviour. Short live reactions are allowed when the exact moment earns them. Presence does not mean more VO.';
const PREVIOUS_EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-25-wow-creative-room-v5";
const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-31-active-fifth-diner-v6";
const EDITORIAL_BRIEF_VERSION_KEY = "dana-ai-editorial-brief-version";
const MAX_VOICEOVER_POLL_COUNT = 2160; // 90 minutes at 2.5s; pending job remains resumable after this window.
const VOICEOVER_LONG_RUNNING_POLL_COUNT = 360; // 15 minutes.
const VOICEOVER_POLL_INTERVAL_MS = 2500;

const EDITORIAL_TONE_BRIEFS: Record<string, string> = {
  [DEFAULT_EDITORIAL_TONE]: DEFAULT_LEPERS_EDITORIAL_BRIEF,
  "Observational · sharp, warm and lightly humorous":
    "Create selective Latvian voice-over that notices the social details others miss. Use warm precision, character-specific observation and clean comic turns. Add meaning through reactions, contradictions and behaviour without narrating the obvious or mocking vulnerability.",
  "Dry irony · understated and precise":
    "Create concise Latvian voice-over with dry, understated humour. Focus on contradictions, awkward pauses, reactions and subtle irony. Underplay rather than exaggerate. Do not describe obvious actions, invent facts, paraphrase dialogue or humiliate participants.",
  "Warm human · intimate and empathetic":
    "Create warm, intimate Latvian voice-over that notices effort, nerves, pride, vulnerability and small acts of courage. Use gentle humour and emotional intelligence. Protect participant dignity and avoid sarcasm that turns a person into the joke.",
  "Rising tension · cinematic and controlled":
    "Create controlled Latvian voice-over that builds anticipation and tension from verified behaviour, timing, uncertainty and contradiction. Use short, precise interventions around turning points. Never invent stakes or over-dramatise routine actions.",
  "Fast bridge · concise and energetic":
    "Create fast, economical Latvian voice-over with compact sentences, active verbs and clean transitions. Every intervention must move the story, sharpen expectation or land a reaction. Avoid decorative filler, recap and long explanations.",
  "Classic · British original":
    "Create Latvian voice-over with the dry, clever, lightly cheeky observational spirit of the British format. Use elegant understatement, social observation and comic reversals while preserving Latvian naturalness. Avoid melodrama, cruelty and obvious narration.",
  [TAILORED_TONE]: "",
};

function defaultEditorialBrief(tone: string) {
  return EDITORIAL_TONE_BRIEFS[tone] ?? "";
}

function mergeSavedEditorialBriefs(saved: Record<string, string>) {
  const merged = { ...EDITORIAL_TONE_BRIEFS, ...saved };
  if (saved[DEFAULT_EDITORIAL_TONE] === LEGACY_DEFAULT_EDITORIAL_BRIEF) {
    merged[DEFAULT_EDITORIAL_TONE] = DEFAULT_LEPERS_EDITORIAL_BRIEF;
  }
  return merged;
}

function buildReferenceBrief(names: string[]) {
  return names
    .map((name, index) => `${index + 1}. ${name}\n   Applied function: ${sourceApplications[name] || "Additional applied production reference. Use only when relevant and never invent facts from it."}`)
    .join("\n");
}

export default function Home() {
  const [active, setActive] = useState("Workspace");
  const [uploaded, setUploaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chunkLength, setChunkLength] = useState("10");
  const [fileName, setFileName] = useState("");
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [finalRuntimeSeconds, setFinalRuntimeSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [transcriptResults, setTranscriptResults] = useState<
    TranscriptResult[]
  >([]);
  const [transcriptionMessage, setTranscriptionMessage] = useState("");
  const [preferredTool, setPreferredTool] = useState<string | null>(null);
  const [showGeminiEditor, setShowGeminiEditor] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiStatus, setGeminiStatus] = useState<
    "Not configured" | "Saving and testing…" | "Connected" | "Connection failed"
  >("Not configured");
  const [geminiMessage, setGeminiMessage] = useState("");
  const [showOpenAIEditor, setShowOpenAIEditor] = useState(false);
  const [openAIKey, setOpenAIKey] = useState("");
  const [openAIStatus, setOpenAIStatus] = useState<
    "Not configured" | "Saving and testing…" | "Connected" | "Connection failed"
  >("Not configured");
  const [openAIMessage, setOpenAIMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [losslessSegments, setLosslessSegments] = useState<string[]>([]);
  const [processingMessage, setProcessingMessage] = useState("");
  const [generatedSegments, setGeneratedSegments] = useState<string[]>([]);
  const [processingStage, setProcessingStage] = useState<
    | "idle"
    | "inspecting"
    | "splitting"
    | "uploading"
    | "transcribing"
    | "merging"
    | "complete"
    | "failed"
  >("idle");
  const [processingPercent, setProcessingPercent] = useState(0);
  const [processingDetail, setProcessingDetail] = useState("");
  const [nativeFfmpeg, setNativeFfmpeg] = useState(false);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(
    null,
  );
  const [processingElapsed, setProcessingElapsed] = useState(0);
  const [sourceStatus, setSourceStatus] = useState<
    "idle" | "indexing" | "success" | "error"
  >("idle");
  const [sourceMessage, setSourceMessage] = useState("");
  const [librarySources, setLibrarySources] = useState<Source[]>(() => {
    if (typeof window === "undefined") return defaultSources;
    try {
      const raw = window.localStorage.getItem("dana-ai-library-sources");
      if (!raw) return defaultSources;
      const saved = JSON.parse(raw) as Source[];
      const core = defaultSources.find((source) => source[1] === CORE_SOURCE_NAME)!;
      return [
        core,
        ...saved.filter(
          (item, index, all) =>
            item[1] !== CORE_SOURCE_NAME &&
            all.findIndex((candidate) => candidate[1] === item[1]) === index,
        ),
      ];
    } catch {
      return defaultSources;
    }
  });
  const [appliedSources, setAppliedSources] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultSources.map((source) => source[1]);
    try {
      const raw = window.localStorage.getItem("dana-ai-applied-sources");
      if (!raw) return defaultSources.map((source) => source[1]);
      const saved = JSON.parse(raw) as string[];
      return Array.from(new Set([CORE_SOURCE_NAME, ...saved]));
    } catch {
      return [CORE_SOURCE_NAME];
    }
  });
  const [referenceContents, setReferenceContents] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem("dana-ai-reference-contents") || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [voiceovers, setVoiceovers] = useState<Voiceover[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        window.localStorage.getItem("dana-ai-voiceovers") || "[]",
      ) as Voiceover[];
    } catch {
      return [];
    }
  });
  const [voiceoverSearch, setVoiceoverSearch] = useState("");
  const [timecodeDocuments, setTimecodeDocuments] = useState<TimecodeDocument[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("dana-ai-timecode-documents") || "[]") as TimecodeDocument[];
    } catch {
      return [];
    }
  });
  const [voiceoverTone, setVoiceoverTone] = useState(DEFAULT_EDITORIAL_TONE);
  const [voiceoverBriefs, setVoiceoverBriefs] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return { ...EDITORIAL_TONE_BRIEFS };
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("dana-ai-editorial-briefs") || "{}",
      ) as Record<string, string>;
      return mergeSavedEditorialBriefs(saved);
    } catch {
      return { ...EDITORIAL_TONE_BRIEFS };
    }
  });
  const [voiceoverPrompt, setVoiceoverPrompt] = useState(() => {
    if (typeof window === "undefined") return defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("dana-ai-editorial-briefs") || "{}",
      ) as Record<string, string>;
      return mergeSavedEditorialBriefs(saved)[DEFAULT_EDITORIAL_TONE];
    } catch {
      return defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);
    }
  });
  const [voiceoverDraft, setVoiceoverDraft] = useState("");
  const [voiceoverStatus, setVoiceoverStatus] = useState<
    "idle" | "generating" | "generated" | "failed"
  >("idle");
  const [voiceoverMessage, setVoiceoverMessage] = useState("");
  const [voiceoverMetrics, setVoiceoverMetrics] = useState<VoiceoverMetrics | null>(null);
  const [goldenMasterMetrics, setGoldenMasterMetrics] = useState<GoldenMasterMetrics | null>(null);
  const [projectMessage, setProjectMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const segmentInput = useRef<HTMLInputElement>(null);
  const transcriptImportInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!processing || !processingStartedAt) return;
    const timer = window.setInterval(
      () =>
        setProcessingElapsed(
          Math.floor((Date.now() - processingStartedAt) / 1000),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [processing, processingStartedAt]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system-health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const geminiConnected =
          data?.gemini?.configured === true && data?.gemini?.signal === "healthy";
        const openAIConnected =
          data?.openai?.configured === true && data?.openai?.signal === "healthy";
        setGeminiStatus(
          geminiConnected
            ? "Connected"
            : data?.gemini?.signal === "problem"
              ? "Connection failed"
              : "Not configured",
        );
        setOpenAIStatus(
          openAIConnected
            ? "Connected"
            : data?.openai?.signal === "problem"
              ? "Connection failed"
              : "Not configured",
        );
        setNativeFfmpeg(data?.ffmpeg?.signal === "healthy");
        if (geminiConnected)
          setGeminiMessage("Saved Gemini connection restored securely.");
        if (openAIConnected)
          setOpenAIMessage("Saved OpenAI connection restored securely.");
      })
      .catch(() => {
        if (!cancelled) setNativeFfmpeg(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    try {
      const savedVersion = window.localStorage.getItem(EDITORIAL_BRIEF_VERSION_KEY);
      if (savedVersion !== EDITORIAL_BRIEF_SCHEMA_VERSION) {
        setVoiceoverBriefs((current) => {
          const migrated = {
            ...current,
            [DEFAULT_EDITORIAL_TONE]: DEFAULT_LEPERS_EDITORIAL_BRIEF,
          };
          window.localStorage.setItem(
            "dana-ai-editorial-briefs",
            JSON.stringify(migrated),
          );
          return migrated;
        });
        setVoiceoverPrompt(DEFAULT_LEPERS_EDITORIAL_BRIEF);
        window.localStorage.setItem(
          EDITORIAL_BRIEF_VERSION_KEY,
          EDITORIAL_BRIEF_SCHEMA_VERSION,
        );
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-editorial-briefs",
        JSON.stringify(voiceoverBriefs),
      );
    } catch {}
  }, [voiceoverBriefs]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-voiceovers",
        JSON.stringify(voiceovers),
      );
    } catch {}
  }, [voiceovers]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-timecode-documents",
        JSON.stringify(timecodeDocuments),
      );
    } catch {}
  }, [timecodeDocuments]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-library-sources",
        JSON.stringify(librarySources),
      );
    } catch {}
  }, [librarySources]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-applied-sources",
        JSON.stringify(appliedSources),
      );
    } catch {}
  }, [appliedSources]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-reference-contents",
        JSON.stringify(referenceContents),
      );
    } catch {}
  }, [referenceContents]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("dana-ai-transcript-session");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        transcriptResults?: TranscriptResult[];
        finalRuntimeSeconds?: number;
        fileName?: string;
      };
      if (Array.isArray(saved.transcriptResults) && saved.transcriptResults.length) {
        setTranscriptResults(saved.transcriptResults);
        setFinalRuntimeSeconds(Number(saved.finalRuntimeSeconds) || 0);
        setFileName(saved.fileName || saved.transcriptResults[0]?.fileName || "");
        setProcessed(true);
        setUploaded(true);
        setTranscriptionMessage("Validated transcript restored from this device.");
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!processed || !transcriptResults.length) return;
    try {
      window.localStorage.setItem(
        "dana-ai-transcript-session",
        JSON.stringify({ transcriptResults, finalRuntimeSeconds, fileName }),
      );
    } catch {}
  }, [processed, transcriptResults, finalRuntimeSeconds, fileName]);
  const formatElapsed = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const uploadVideoDirectlyToGemini = async (file: File) => {
    const sessionResponse = await fetch("/api/gemini-upload-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
      }),
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session?.ok || !session?.uploadUrl) {
      throw new Error(session?.message || `Gemini upload session could not start (HTTP ${sessionResponse.status}).`);
    }

    const uploaded = await fetch(session.uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": file.type || "video/mp4",
      },
      body: file,
    });
    const uploadedData = await uploaded.json().catch(() => ({}));
    if (!uploaded.ok || !uploadedData?.file?.uri) {
      throw new Error(uploadedData?.error?.message || `Gemini rejected ${file.name} (HTTP ${uploaded.status}).`);
    }
    return {
      name: uploadedData.file.name as string,
      uri: uploadedData.file.uri as string,
      mimeType: uploadedData.file.mimeType || file.type || "video/mp4",
    };
  };

  const waitForGeminiVideo = async (
    name: string,
    _apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch("/api/gemini-file-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Gemini could not inspect the uploaded video (HTTP ${response.status}).`);
      }
      const state = typeof data?.state === "string" ? data.state : "PROCESSING";
      if (state === "ACTIVE") return;
      if (state === "FAILED") throw new Error(data?.error || "Gemini failed while preparing the uploaded video.");
      onUpdate(`Gemini is preparing ${data?.displayName || "the video"}…`, Math.min(62, 43 + Math.floor(attempt / 3)));
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
    }
    throw new Error("Gemini is still preparing the video after 15 minutes. The request was stopped safely.");
  };

  const transcribeVideoDirectly = async (
    file: File,
    apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ): Promise<TranscriptResult> => {
    onUpdate(`Uploading ${file.name} directly to Gemini…`, 40);
    const uploaded = await uploadVideoDirectlyToGemini(file);
    await waitForGeminiVideo(uploaded.name, apiKey, onUpdate);
    onUpdate("Gemini is transcribing the video…", 70);
    const response = await fetch("/api/transcribe-uploaded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadedFile: uploaded,
        originalFile: file.name,
        model: GEMINI_DIRECT_MODEL,
        referenceManifest: buildReferenceBrief(appliedSources),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || `Gemini transcription failed (HTTP ${response.status}).`);
    }

    onUpdate("Gemini is creating a separate Visual Evidence Pass…", 82);
    let visualEvidence = "";
    let visualEvidenceAvailable = false;
    let visualEvidenceModel = "";
    try {
      const visualResponse = await fetch("/api/visual-evidence-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadedFile: uploaded,
          originalFile: file.name,
          model: GEMINI_DIRECT_MODEL,
        }),
      });
      const visualData = await visualResponse.json().catch(() => ({}));
      if (visualResponse.ok && visualData?.ok && typeof visualData.visualEvidence === "string") {
        visualEvidence = visualData.visualEvidence.trim();
        visualEvidenceAvailable = Boolean(visualEvidence);
        visualEvidenceModel = visualData.model || GEMINI_DIRECT_MODEL;
      }
    } catch {
      // Visual evidence is an additive channel. A failed visual pass never corrupts
      // or blocks an otherwise valid authentic transcript.
    }

    onUpdate(
      visualEvidenceAvailable
        ? "Transcript and separate timestamped visual evidence returned."
        : "Transcript returned; visual evidence unavailable for this source.",
      90,
    );
    return {
      fileName: data.fileName || file.name,
      transcript: data.transcript,
      model: data.model || GEMINI_DIRECT_MODEL,
      timecodes: data.timecodes === true,
      visualEvidence,
      visualEvidenceAvailable,
      visualEvidenceModel,
    };
  };

  const analyzeVisualEvidenceDirectly = async (
    file: File,
    apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ): Promise<Pick<TranscriptResult, "visualEvidence" | "visualEvidenceAvailable" | "visualEvidenceModel">> => {
    try {
      onUpdate(`Uploading ${file.name} for the separate Visual Evidence Pass…`, 72);
      const uploaded = await uploadVideoDirectlyToGemini(file);
      await waitForGeminiVideo(uploaded.name, apiKey, onUpdate);
      const response = await fetch("/api/visual-evidence-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadedFile: uploaded,
          originalFile: file.name,
          model: GEMINI_DIRECT_MODEL,
        }),
      });
      const visualData = await response.json().catch(() => ({}));
      if (!response.ok || !visualData?.ok || typeof visualData.visualEvidence !== "string") {
        return { visualEvidence: "", visualEvidenceAvailable: false, visualEvidenceModel: "" };
      }
      return {
        visualEvidence: visualData.visualEvidence.trim(),
        visualEvidenceAvailable: Boolean(visualData.visualEvidence.trim()),
        visualEvidenceModel: visualData.model || GEMINI_DIRECT_MODEL,
      };
    } catch {
      return { visualEvidence: "", visualEvidenceAvailable: false, visualEvidenceModel: "" };
    }
  };
  const inferRuntimeFromTranscript = (value: string) => {
    const matches = Array.from(
      value.matchAll(/(?:^|\n)\s*\[?(\d{2}):(\d{2}):(\d{2})\]?/g),
    );
    const latest = matches.reduce((max, match) => {
      const seconds =
        Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      return Math.max(max, seconds);
    }, 0);
    return latest > 0 ? latest + 2 : 0;
  };
  const chooseTranscriptImport = () => transcriptImportInput.current?.click();
  const onTranscriptImport = async (files?: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setTranscriptionMessage(`Importing ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/import-transcript", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.transcript) {
        throw new Error(
          data?.message || `Transcript import failed (HTTP ${response.status}).`,
        );
      }
      const importedTranscript = String(data.transcript).trim();
      const runtimeSeconds =
        Number(data.runtimeSeconds) || inferRuntimeFromTranscript(importedTranscript);
      if (!runtimeSeconds) {
        throw new Error(
          "The imported transcript has no usable HH:MM:SS timecodes, so DANA AI cannot calculate the voice-over ratio.",
        );
      }
      setTranscriptResults([
        {
          fileName: data.fileName || file.name,
          transcript: importedTranscript,
          model: "Imported validated transcript",
          timecodes: data.timecodes === true,
          visualEvidence: "",
          visualEvidenceAvailable: false,
          visualEvidenceModel: "",
        },
      ]);
      setFinalRuntimeSeconds(runtimeSeconds);
      setFileName(data.fileName || file.name);
      setProcessed(true);
      setVoiceoverDraft("");
      setVoiceoverMetrics(null);
      setVoiceoverStatus("idle");
      setVoiceoverMessage("");
      setTranscriptionMessage(
        `Imported ${file.name}. Timecoded transcript restored; voice-over is unlocked. Runtime inferred as ${formatElapsed(runtimeSeconds)} from the final timecode.`,
      );
      setProjectMessage(
        "Existing transcript imported successfully. You can proceed directly to Voice-over without retranscribing the video.",
      );
    } catch (error) {
      setTranscriptionMessage(
        error instanceof Error ? error.message : "Transcript import failed.",
      );
    } finally {
      if (transcriptImportInput.current) transcriptImportInput.current.value = "";
    }
  };
  const chooseFile = () => fileInput.current?.click();
  const onFiles = (files?: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).filter(
      (file) =>
        /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name) ||
        file.type.startsWith("video/"),
    );
    if (!selected.length) return;
    setVideoFiles((current) => {
      const merged = [...current, ...selected].filter(
        (file, index, all) =>
          all.findIndex(
            (item) => item.name === file.name && item.size === file.size,
          ) === index,
      );
      setFileName(
        merged.length === 1
          ? merged[0].name
          : `${merged.length} videos selected`,
      );
      return merged;
    });
    setUploaded(true);
    setProcessed(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const removeVideo = (name: string, size: number) => {
    setVideoFiles((current) => {
      const remaining = current.filter(
        (file) => !(file.name === name && file.size === size),
      );
      setFileName(
        remaining.length === 0
          ? ""
          : remaining.length === 1
            ? remaining[0].name
            : `${remaining.length} videos selected`,
      );
      setUploaded(remaining.length > 0);
      return remaining;
    });
  };
  const chooseSource = () => sourceInput.current?.click();
  const isVideoReferenceFile = (file: File) =>
    file.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
  const onSegments = (files?: FileList | null) => {
    if (!files?.length) return;
    const imported = Array.from(files)
      .filter((file) => /\.(mp4|mov|mkv|webm)$/i.test(file.name))
      .map((file) => file.name);
    setLosslessSegments((current) =>
      Array.from(new Set([...current, ...imported])),
    );
    if (segmentInput.current) segmentInput.current.value = "";
  };
  const onSources = async (files?: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    setSourceStatus("indexing");
    setSourceMessage(
      `Indexing ${incoming.length} source${incoming.length === 1 ? "" : "s"}…`,
    );
    setProjectMessage(
      `Indexing ${incoming.length} reference source${incoming.length === 1 ? "" : "s"}…`,
    );
    const additions: Source[] = [];
    const indexedContents: Record<string, string> = {};
    const failures: string[] = [];
    const existingNames = new Set(librarySources.map((source) => source[1]));
    const updatedNames: string[] = [];
    const addedNames: string[] = [];

    for (const file of incoming) {
      try {
        if (isVideoReferenceFile(file)) {
          const extension = String(file.name.split(".").pop() || "VIDEO").toUpperCase();
          additions.push([
            "Video reference",
            file.name,
            "Registered video reference",
            extension,
          ]);
          (existingNames.has(file.name) ? updatedNames : addedNames).push(file.name);
          continue;
        }

        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/ingest-reference", {
          method: "POST",
          body: form,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.message || `Could not index ${file.name} (HTTP ${response.status}).`,
          );
        }
        const extension = String(
          data.extension || file.name.split(".").pop() || "FILE",
        ).toUpperCase();
        const type =
          data.kind === "video" ? "Video reference" : "Production reference";
        additions.push([
          type,
          file.name,
          data.indexed ? "Indexed knowledge source" : "Registered video reference",
          extension,
        ]);
        (existingNames.has(file.name) ? updatedNames : addedNames).push(file.name);
        if (
          data.indexed &&
          typeof data.content === "string" &&
          data.content.trim()
        ) {
          indexedContents[file.name] = data.content;
        }
      } catch (error) {
        failures.push(
          error instanceof Error
            ? `${file.name}: ${error.message}`
            : `${file.name}: indexing failed`,
        );
      }
    }

    if (additions.length) {
      setLibrarySources((current) => {
        const incomingNames = new Set(additions.map((source) => source[1]));
        const coreSources = current.filter(
          (source) => source[1] === CORE_SOURCE_NAME,
        );
        const remaining = current.filter(
          (source) =>
            source[1] !== CORE_SOURCE_NAME && !incomingNames.has(source[1]),
        );
        return [...coreSources, ...additions, ...remaining];
      });
      setReferenceContents((current) => ({
        ...current,
        ...indexedContents,
      }));
      setAppliedSources((current) =>
        Array.from(
          new Set([
            ...current,
            ...additions.map((source) => source[1]),
            CORE_SOURCE_NAME,
          ]),
        ),
      );
    }

    const successParts = [
      addedNames.length
        ? `Added: ${addedNames.join(", ")}.`
        : "",
      updatedNames.length
        ? `Updated/re-indexed: ${updatedNames.join(", ")}.`
        : "",
      Object.keys(indexedContents).length
        ? `${Object.keys(indexedContents).length} document${Object.keys(indexedContents).length === 1 ? "" : "s"} indexed into editorial context.`
        : "",
      additions.some((source) => source[0] === "Video reference")
        ? "Video references were registered without uploading unused video bytes."
        : "",
    ].filter(Boolean);

    const finalMessage = [
      successParts.join(" "),
      failures.length ? `Failed: ${failures.join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    setSourceStatus(
      failures.length && !additions.length ? "error" : failures.length ? "error" : "success",
    );
    setSourceMessage(
      finalMessage || "No sources were added. Choose a supported reference file.",
    );
    setProjectMessage(
      finalMessage || "No sources were added. Choose a supported reference file.",
    );
    if (sourceInput.current) sourceInput.current.value = "";
  };
  const applyAllSources = () => {
    const names = librarySources.map((source) => source[1]);
    setAppliedSources(names);
    setProjectMessage(
      `${names.length} reference sources are now active in this device's project manifest. The DANA Master Production System remains the only locked core source.`,
    );
  };
  const removeSource = (name: string) => {
    if (name === CORE_SOURCE_NAME) {
      setProjectMessage("The DANA AI Master Production System is the governing core and cannot be removed.");
      return;
    }
    const source = librarySources.find((item) => item[1] === name);
    if (!source) return;
    if (!window.confirm(`Remove “${name}” from the reference library?

This also removes it from the active project context.`)) return;
    setLibrarySources((current) => current.filter((item) => item[1] !== name));
    setAppliedSources((current) => current.filter((item) => item !== name));
    setReferenceContents((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setProjectMessage(`Removed ${name} from the library and active editorial context.`);
  };
  // Retained as an explicit manual fallback for future native-worker recovery.
  // The production path now uses direct Gemini instead of browser re-encoding.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const segmentVideo = async (
    file: File,
    onProgress?: (percent: number, detail: string) => void,
  ): Promise<SegmentPayload[]> => {
    const limit = Number(chunkLength) * 60;
    if (!/^video\/mp4$/i.test(file.type) && !/\.mp4$/i.test(file.name)) {
      throw new Error(
        `${file.name} is not an MP4. Fast stream-copy splitting supports MP4 only; use a native FFmpeg processor or add pre-cut segments.`,
      );
    }
    const source = await file.arrayBuffer();
    onProgress?.(8, `${file.name}: reading MP4 structure (no re-encoding)`);
    return await new Promise<SegmentPayload[]>((resolve, reject) => {
      const mp4 = createMp4File() as unknown as Mp4Processor;
      let readyInfo: Mp4Info | null = null;
      let initSegment: ArrayBuffer | null = null;
      let trackIds: number[] = [];
      const perTrackIndex = new Map<number, number>();
      const buckets = new Map<number, ArrayBuffer[]>();
      const finishedTracks = new Set<number>();
      let settled = false;
      const fail = (message: string) => {
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      };
      const finish = () => {
        if (settled || !readyInfo || finishedTracks.size !== trackIds.length)
          return;
        const duration =
          Number(readyInfo.duration) / Number(readyInfo.timescale);
        if (!Number.isFinite(duration) || duration <= 0)
          return fail(`Could not read the duration of ${file.name}.`);
        if (duration <= 15 * 60) {
          settled = true;
          onProgress?.(100, `${file.name} does not need splitting`);
          resolve([{ file, startSeconds: 0, originalFile: file.name }]);
          return;
        }
        const output = Array.from(buckets.entries())
          .sort(([a], [b]) => a - b)
          .map(([index, parts]) => ({
            file: new File(
              [initSegment as ArrayBuffer, ...parts],
              `${file.name.replace(/\.[^.]+$/i, "")}_segment_${String(index + 1).padStart(3, "0")}_${Math.floor(index * limit)}s.mp4`,
              { type: "video/mp4" },
            ),
            startSeconds: index * limit,
            originalFile: file.name,
          }));
        if (!output.length)
          return fail(
            `MP4Box could not create stream-copy segments for ${file.name}.`,
          );
        settled = true;
        onProgress?.(
          100,
          `${file.name}: ${output.length} stream-copy segments created`,
        );
        resolve(output);
      };
      mp4.onError = (error: unknown) =>
        fail(`Fast MP4 splitting failed for ${file.name}: ${String(error)}`);
      mp4.onReady = (info: Mp4Info) => {
        readyInfo = info;
        const tracks = (info.tracks || []).filter((track) =>
          Boolean(track.video || track.audio),
        );
        if (!tracks.length)
          return fail(`${file.name} contains no usable audio or video tracks.`);
        trackIds = tracks.map((track) => Number(track.id));
        try {
          tracks.forEach((track) => {
            const trackDuration =
              Number(track.duration) /
              Number(track.timescale || info.timescale);
            const samplesPerSegment = Math.max(
              1,
              Math.round(
                (Number(track.nb_samples || 1) * limit) /
                  Math.max(1, trackDuration),
              ),
            );
            mp4.setSegmentOptions(Number(track.id), Number(track.id), {
              nbSamples: samplesPerSegment,
              rapAlignement: true,
            });
          });
          const initialization = mp4.initializeSegmentation("combined");
          initSegment = initialization?.buffer || null;
          if (!initSegment)
            return fail(
              `MP4Box did not produce an initialization segment for ${file.name}.`,
            );
          mp4.start();
        } catch (error) {
          fail(
            `Fast MP4 splitting could not start for ${file.name}: ${String(error)}`,
          );
        }
      };
      mp4.onSegment = (
        trackId: number,
        _user: unknown,
        buffer: ArrayBuffer,
        _sampleNumber: number,
        last: boolean,
      ) => {
        const index = perTrackIndex.get(trackId) || 0;
        perTrackIndex.set(trackId, index + 1);
        const parts = buckets.get(index) || [];
        parts.push(buffer);
        buckets.set(index, parts);
        if (last) finishedTracks.add(trackId);
        onProgress?.(
          Math.min(
            98,
            15 +
              Math.round(
                ((index + 1) * 80) /
                  Math.max(
                    1,
                    Math.ceil(
                      Number(readyInfo?.duration) /
                        Number(readyInfo?.timescale || 1) /
                        limit,
                    ),
                  ),
              ),
          ),
          `${file.name}: stream-copy segment ${index + 1}`,
        );
        finish();
      };
      try {
        const input = source as ArrayBuffer & { fileStart: number };
        input.fileStart = 0;
        mp4.appendBuffer(input);
        mp4.flush();
      } catch (error) {
        fail(
          `Fast MP4 splitting could not read ${file.name}: ${String(error)}`,
        );
      }
    });
  };
  const startProcessing = async () => {
    if (!uploaded) return chooseFile();
    if (geminiStatus !== "Connected") {
      setShowSettings(true);
      setShowGeminiEditor(true);
      setGeminiMessage(
        "Gemini is not connected yet. Save a valid API key and wait for a successful connection test before starting transcription.",
      );
      return;
    }
    const totalVideoBytes = videoFiles.reduce((total, file) => total + file.size, 0);
    const nativeProxySafe =
      nativeFfmpeg && videoFiles.length === 1 && totalVideoBytes <= VERCEL_NATIVE_PROXY_LIMIT;
    setPreferredTool("Gemini 3.6 Flash");
    setProcessing(true);
    setProcessed(false);
    setProcessingMessage("");
    setProcessingStage("inspecting");
    setProcessingPercent(2);
    setProcessingDetail("Checking the selected videos…");
    setProcessingStartedAt(Date.now());
    setProcessingElapsed(0);
    try {
      const segments: SegmentPayload[] = [];
      const durations = await Promise.all(videoFiles.map((file) => new Promise<number>((resolve) => {
        const element = document.createElement("video");
        const url = URL.createObjectURL(file);
        element.preload = "metadata";
        element.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number(element.duration) || 0); };
        element.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
        element.src = url;
      })));
      setFinalRuntimeSeconds(durations.reduce((total, duration) => total + duration, 0));
      let cumulativeStartSeconds = 0;
      for (let index = 0; index < videoFiles.length; index += 1) {
        const file = videoFiles[index];
        setProcessingStage(nativeProxySafe ? "splitting" : "uploading");
        setProcessingMessage(
          nativeProxySafe
            ? `Preparing ${file.name} with native FFmpeg…`
            : `Sending ${file.name} directly to Gemini without browser re-encoding…`,
        );
        setProcessingPercent(Math.max(8, Math.round(((index + 1) / videoFiles.length) * 35)));
        setProcessingDetail(
          nativeProxySafe
            ? `File ${index + 1} of ${videoFiles.length} · native stream-copy path`
            : `File ${index + 1} of ${videoFiles.length} · direct video path${durations[index] > 15 * 60 ? " · long-video mode" : ""}`,
        );
        // Direct Gemini is deliberately the fallback. It avoids the old
        // MediaRecorder/MP4Box browser re-encoding trap and supports long
        // videos within Gemini's multimodal context limits.
        segments.push({
          file,
          startSeconds: cumulativeStartSeconds,
          originalFile: file.name,
        });
        cumulativeStartSeconds += durations[index] || 0;
      }
      setGeneratedSegments(segments.map((segment) => segment.file.name));
      setProcessingStage("uploading");
      setProcessingPercent(40);
      setProcessingDetail(
        nativeProxySafe
          ? `${segments.length} source file${segments.length === 1 ? "" : "s"} ready · native processor`
          : `${segments.length} source file${segments.length === 1 ? "" : "s"} ready · direct Gemini mode`,
      );
      setProcessingMessage(
        nativeProxySafe
          ? `Native FFmpeg prepared ${segments.length} source file${segments.length === 1 ? "" : "s"}. Transcribing with overlap and offset restoration…`
          : `Direct Gemini mode is processing ${segments.length} source file${segments.length === 1 ? "" : "s"} without slow browser splitting…`,
      );
      setTranscriptionMessage(
        nativeProxySafe
          ? "Secure upload is sending the video directly to Gemini, then the system will transcribe, offset, merge and validate it."
          : "The browser is uploading the source directly to Gemini so the hosted app cannot time out.",
      );
      let results: TranscriptResult[] = [];
      if (nativeProxySafe) {
        const form = new FormData();
        segments.forEach((segment) =>
          form.append("files", segment.file, segment.file.name),
        );
        form.append(
          "segmentInfo",
          JSON.stringify(
            segments.map((segment) => ({
              startSeconds: segment.startSeconds,
              originalFile: segment.originalFile,
            })),
          ),
        );
        form.append("apiKey", geminiKey.trim());
        form.append("processor", "native");
        form.append("model", GEMINI_DIRECT_MODEL);
        form.append("chunkLength", chunkLength);
        form.append("referenceManifest", buildReferenceBrief(appliedSources));
        setProcessingStage("transcribing");
        setProcessingPercent(65);
        setProcessingDetail(
          `Gemini is processing ${segments.length} segment${segments.length === 1 ? "" : "s"} through the native processor…`,
        );
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.message || "The native transcription worker returned an error.");
        results = result.results || [];
        if (results.length && videoFiles[0]) {
          const visual = await analyzeVisualEvidenceDirectly(
            videoFiles[0],
            geminiKey.trim(),
            (detail, percent) => {
              setProcessingDetail(detail);
              setProcessingPercent(Math.max(70, percent));
              setProcessingMessage(detail);
            },
          );
          results = results.map((item, itemIndex) =>
            itemIndex === 0 ? { ...item, ...visual } : item,
          );
        }
      } else {
        setProcessingStage("uploading");
        setProcessingPercent(40);
        const directResults: TranscriptResult[] = [];
        for (const segment of segments) {
          setProcessingStage("transcribing");
          const directResult = await transcribeVideoDirectly(
            segment.file,
            geminiKey.trim(),
            (detail, percent) => {
              setProcessingDetail(detail);
              setProcessingPercent(percent);
              setProcessingMessage(detail);
            },
          );
          const adjustedTranscript = directResult.transcript.replace(
            /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g,
            (_match, a, b, c) => {
              const localSeconds =
                c === undefined
                  ? Number(a) * 60 + Number(b)
                  : Number(a) * 3600 + Number(b) * 60 + Number(c);
              const totalSeconds = Math.max(
                0,
                Math.round(localSeconds + segment.startSeconds),
              );
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              return `[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
            },
          );
          const adjustedVisualEvidence = (directResult.visualEvidence || "").replace(
            /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g,
            (_match, a, b, c) => {
              const localSeconds =
                c === undefined
                  ? Number(a) * 60 + Number(b)
                  : Number(a) * 3600 + Number(b) * 60 + Number(c);
              const totalSeconds = Math.max(
                0,
                Math.round(localSeconds + segment.startSeconds),
              );
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              return `[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
            },
          );
          directResults.push({
            ...directResult,
            transcript: adjustedTranscript,
            visualEvidence: adjustedVisualEvidence,
            visualEvidenceAvailable: Boolean(adjustedVisualEvidence.trim()),
          });
        }
        results = directResults;
      }
      setTranscriptResults(results);
      setProcessingStage("merging");
      setProcessingPercent(90);
      setProcessingDetail(
        nativeProxySafe
          ? "Merging transcripts, restoring offsets and validating timecodes..."
          : "Validating the direct Gemini transcript and preparing it for editorial review...",
      );
      setProcessed(true);
      setProcessingStage("complete");
      setProcessingPercent(100);
      setProcessingDetail("Transcript returned and validated");
      setProcessingMessage(
        nativeProxySafe
          ? `Merged and validated ${segments.length} segment${segments.length === 1 ? "" : "s"} with original timeline offsets.`
          : `Gemini returned and validated ${results.length} editor-ready transcript${results.length === 1 ? "" : "s"}.`,
      );
      setTranscriptionMessage(
        "Transcript returned, merged and timecode-validated. Review it before editorial use.",
      );
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Processing failed.";
      setProcessingStage("failed");
      setProcessingDetail(
        failureMessage,
      );
      setProcessingMessage(
        `Processing failed: ${failureMessage}`,
      );
      setGeneratedSegments([]);
      setTranscriptionMessage(
        `Transcription failed: ${failureMessage}`,
      );
    } finally {
      setProcessing(false);
    }
  };
  const openGeminiEditor = () => {
    setGeminiMessage("");
    setShowGeminiEditor(true);
  };
  const openOpenAIEditor = () => {
    setOpenAIMessage("");
    setShowOpenAIEditor(true);
  };
  const saveOpenAIKey = async () => {
    if (!openAIKey.trim()) {
      setOpenAIMessage("Paste an OpenAI API key before saving.");
      return;
    }
    setOpenAIStatus("Saving and testing…");
    setOpenAIMessage("Testing the live OpenAI connection.");
    try {
      const response = await fetch("/api/openai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openAIKey }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.message || "OpenAI connection failed.");
      setOpenAIStatus("Connected");
      setOpenAIMessage(
        `Connected successfully to ${result.model}. The live API test passed.`,
      );
    } catch (error) {
      setOpenAIStatus("Connection failed");
      setOpenAIMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const testOpenAIConnection = async () => {
    setOpenAIStatus("Saving and testing…");
    setOpenAIMessage("Testing the saved OpenAI connection.");
    try {
      const response = await fetch("/api/openai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openAIKey.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(result.message || "OpenAI connection failed.");
      setOpenAIStatus("Connected");
      setOpenAIMessage(`Connection verified successfully to ${result.model}.`);
    } catch (error) {
      setOpenAIStatus("Connection failed");
      setOpenAIMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const saveGeminiKey = async () => {
    if (!geminiKey.trim()) {
      setGeminiMessage("Paste a Gemini API key before saving.");
      return;
    }
    setGeminiStatus("Saving and testing…");
    setGeminiMessage(
      "Testing the live Gemini connection. After validation, the key is stored securely in an HTTP-only cookie on this device for up to 180 days.",
    );
    try {
      const response = await fetch("/api/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: geminiKey,
          model: "gemini-3.6-flash",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Gemini connection failed.");
      setGeminiStatus("Connected");
      setGeminiMessage(
        `Connected successfully to ${result.model}. The live API test passed. You can now start a real transcription.`,
      );
    } catch (error) {
      setGeminiStatus("Connection failed");
      setGeminiMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const testGeminiConnection = async () => {
    setGeminiStatus("Saving and testing…");
    setGeminiMessage("Testing the saved Gemini connection.");
    try {
      const response = await fetch("/api/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: geminiKey.trim(),
          model: GEMINI_DIRECT_MODEL,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Gemini connection failed.");
      setGeminiStatus("Connected");
      setGeminiMessage(`Connection verified successfully to ${result.model}.`);
    } catch (error) {
      setGeminiStatus("Connection failed");
      setGeminiMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const refreshStatus = async () => {
    setRefreshing(true);
    setExportMessage("");
    try {
      const response = await fetch("/api/system-health", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("System health check failed.");
      const geminiConnected =
        data?.gemini?.configured === true && data?.gemini?.signal === "healthy";
      const openAIConnected =
        data?.openai?.configured === true && data?.openai?.signal === "healthy";
      setGeminiStatus(
        geminiConnected
          ? "Connected"
          : data?.gemini?.signal === "problem"
            ? "Connection failed"
            : "Not configured",
      );
      setOpenAIStatus(
        openAIConnected
          ? "Connected"
          : data?.openai?.signal === "problem"
            ? "Connection failed"
            : "Not configured",
      );
      setNativeFfmpeg(data?.ffmpeg?.signal === "healthy");
      setGeminiMessage(data?.gemini?.message || "Gemini status refreshed.");
      setOpenAIMessage(data?.openai?.message || "OpenAI status refreshed.");
      setExportMessage(
        data?.ffmpeg?.signal === "healthy"
          ? "System status refreshed. Native FFmpeg is online."
          : data?.ffmpeg?.message || "System status refreshed.",
      );
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "System status refresh failed.",
      );
    } finally {
      setRefreshing(false);
    }
  };
  const pollVoiceoverJob = async (
    responseId: string,
    pollCount = 0,
  ): Promise<void> => {
    if (pollCount > MAX_VOICEOVER_POLL_COUNT) {
      setVoiceoverStatus("generating");
      setVoiceoverMessage(
        "DANA AI is still working on this background job. The exact OpenAI response ID is preserved on this device; reload the page at any time and DANA will resume checking the same run automatically. Do not start a duplicate run unless you intentionally want to replace it.",
      );
      return;
    }
    try {
      const response = await fetch(
        `/api/generate-voiceover?responseId=${encodeURIComponent(responseId)}`,
        { cache: "no-store" },
      );
      const raw = await response.text();
      let result: Record<string, any> = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Voice-over service returned HTTP ${response.status} without JSON${raw ? `: ${raw.slice(0, 220)}` : "."}`,
        );
      }
      if (!response.ok || !result.ok) {
        throw new Error(
          String(result.message || `Voice-over job check failed (HTTP ${response.status}).`),
        );
      }
      const nextId = String(result.responseId || responseId);
      if (result.status === "completed" && typeof result.text === "string" && result.text.trim()) {
        window.localStorage.removeItem("dana-ai-pending-voiceover");
        setVoiceoverDraft(result.text);
        setVoiceoverMetrics(result.metrics || null);
        setGoldenMasterMetrics(result.goldenMaster || null);
        setVoiceoverStatus("generated");
        const ratioStatus = String(result.metrics?.standardStatus || "");
        const toneApplied = String(result.tone || voiceoverTone);
        const cueCount = Number(result.quality?.cueCount || 0);
        setVoiceoverMessage(
          ratioStatus === "within-standard"
            ? `Selective voice-over generated with ${result.model}. Tone: ${toneApplied} · ${cueCount} VO cues · ${result.metrics?.ratioPercent ?? "—"}% of runtime — inside the 16.17%-17.17% standard.`
            : `Selective voice-over generated with ${result.model}. Tone: ${toneApplied} · ${cueCount} VO cues · ${result.metrics?.ratioPercent ?? "—"}% of runtime. The script is below the preferred standard because DANA AI did not add recap or filler merely to increase narration. Review whether more narrator beats are editorially justified.`,
        );
        return;
      }
      if (result.status === "queued" || result.status === "in_progress") {
        window.localStorage.setItem("dana-ai-pending-voiceover", nextId);
        setVoiceoverStatus("generating");
        setVoiceoverMessage(
          result.phase === "output-expansion"
            ? "DANA AI is rebuilding the complete WOW package with the expanded output budget so no section is truncated. The same source context is preserved…"
            : result.phase === "correction"
              ? "DANA AI is running the Golden Master / WOW correction pass: structure, freshness, Fifth Dinner Guest POV and narration ratio are being checked…"
              : pollCount >= VOICEOVER_LONG_RUNNING_POLL_COUNT
                ? "DANA AI is still working on the full WOW package. This is a durable OpenAI background job; the response ID is preserved and the page will keep checking it automatically…"
                : "OpenAI is generating the voice-over in a durable background job. You can keep this page open while it finishes…",
        );
        window.setTimeout(() => {
          void pollVoiceoverJob(nextId, pollCount + 1);
        }, VOICEOVER_POLL_INTERVAL_MS);
        return;
      }
      throw new Error(`Unexpected voice-over job status: ${String(result.status || "unknown")}.`);
    } catch (error) {
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        `${error instanceof Error ? error.message : "Voice-over job check was interrupted."} The pending OpenAI response ID is preserved; reload the page to resume checking this exact run.`,
      );
    }
  };
  useEffect(() => {
    let pendingResponseId = "";
    try {
      pendingResponseId = window.localStorage.getItem("dana-ai-pending-voiceover") || "";
    } catch {}
    if (!pendingResponseId.startsWith("resp_")) return;
    setVoiceoverStatus("generating");
    setVoiceoverMessage(
      "Restoring the pending DANA AI generation from this device and reconnecting to the same OpenAI background job…",
    );
    void pollVoiceoverJob(pendingResponseId);
  }, []);
  const updateEditorialBrief = (value: string) => {
    setVoiceoverPrompt(value);
    setVoiceoverBriefs((current) => ({ ...current, [voiceoverTone]: value }));
  };

  const changeEditorialTone = (nextTone: string) => {
    setVoiceoverBriefs((current) => ({
      ...current,
      [voiceoverTone]: voiceoverPrompt,
    }));
    const nextBrief = voiceoverBriefs[nextTone] ?? defaultEditorialBrief(nextTone);
    setVoiceoverTone(nextTone);
    setVoiceoverPrompt(nextBrief);
    setVoiceoverMessage(
      nextTone === TAILORED_TONE
        ? "Tailored mode selected. Describe the exact editorial direction for this scene."
        : `Editorial brief switched to ${nextTone}.`,
    );
  };

  const generateVoiceover = async () => {
    if (!processed || !transcriptResults.length) {
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Generate is blocked until a real validated transcript exists.",
      );
      return;
    }
    if (openAIStatus !== "Connected") {
      setShowSettings(true);
      setShowOpenAIEditor(true);
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Connect OpenAI first. The voice-over generator uses the connected OpenAI API.",
      );
      return;
    }
    setVoiceoverStatus("generating");
    setVoiceoverMessage("Starting a durable OpenAI background voice-over job…");
    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DANA-Voiceover-Mode": "background",
        },
        body: JSON.stringify({
          apiKey: openAIKey.trim(),
          transcript: transcriptText,
          visualEvidence: visualEvidenceText,
          prompt: voiceoverPrompt,
          tone: voiceoverTone,
          context: buildReferenceBrief(appliedSources),
          appliedSources,
          referenceContents: Object.fromEntries(
            appliedSources
              .filter((name) => Boolean(referenceContents[name]))
              .map((name) => [name, referenceContents[name]]),
          ),
          finalRuntimeSeconds: effectiveRuntimeSeconds,
        }),
      });
      const raw = await response.text();
      let result: Record<string, any> = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Voice-over service returned HTTP ${response.status} without JSON${raw ? `: ${raw.slice(0, 220)}` : "."}`,
        );
      }
      if (!response.ok || !result.ok) {
        throw new Error(
          String(result.message || `Voice-over job could not start (HTTP ${response.status}).`),
        );
      }
      const responseId = String(result.responseId || "");
      if (!responseId) throw new Error("OpenAI started no retrievable voice-over job.");
      window.localStorage.setItem("dana-ai-pending-voiceover", responseId);
      setVoiceoverMessage("Voice-over job started. Waiting for OpenAI to finish…");
      await pollVoiceoverJob(responseId);
    } catch (error) {
      window.localStorage.removeItem("dana-ai-pending-voiceover");
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        error instanceof Error ? error.message : "Voice-over generation failed.",
      );
    }
  };
  const saveVoiceover = () => {
    if (!voiceoverDraft.trim()) {
      setVoiceoverMessage("Generate a voice-over before saving it.");
      return;
    }
    const item: Voiceover = {
      id: voiceovers.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
      title: fileName || "Untitled scene",
      project: "Gandrīz ideālas vakariņas",
      scene: "Scene 02",
      updated: new Date().toLocaleString("lv-LV"),
      status: "Final",
      text: voiceoverDraft,
    };
    setVoiceovers((current) => [item, ...current]);
    setVoiceoverMessage(
      "Final voice-over document saved to this device's production library.",
    );
    setActive("Voice-over library");
  };
  const saveTimecodeDocument = () => {
    if (!processed || !transcriptResults.length) {
      setExportMessage("Save is blocked until a validated timecoded transcript exists.");
      return;
    }
    const item: TimecodeDocument = {
      id: timecodeDocuments.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
      title: fileName || "Untitled scene",
      updated: new Date().toLocaleString("lv-LV"),
      text: transcriptText,
    };
    setTimecodeDocuments((current) => [item, ...current]);
    setExportMessage("Timecode document saved to this device's production library.");
  };
  const deleteTimecodeDocument = (id: number) => {
    setTimecodeDocuments((current) => current.filter((item) => item.id !== id));
    setExportMessage("Timecode document deleted.");
  };
  const deleteVoiceover = (id: number) => {
    setVoiceovers((current) => current.filter((item) => item.id !== id));
    setVoiceoverMessage("Final voice-over document deleted.");
  };
  const createProject = () => {
    setProjectMessage(
      "Current project is already active: GIV · Season 11 · Scene 02. New-project creation is intentionally disabled until a project persistence backend is connected.",
    );
  };
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const visualEvidenceText = transcriptResults
    .filter((result) => result.visualEvidenceAvailable && result.visualEvidence?.trim())
    .map((result) => `## ${result.fileName}\n\n${result.visualEvidence}`)
    .join("\n\n");
  const transcriptText =
    transcriptResults
      .map((result) => `## ${result.fileName}\n\n${result.transcript}`)
      .join("\n\n") ||
    transcriptionMessage ||
    "No transcript has been returned yet.";
  const effectiveRuntimeSeconds =
    finalRuntimeSeconds || inferRuntimeFromTranscript(transcriptText);
  const workflowStates = [
    "ready",
    processed ? "ready" : "active",
    processed ? "available" : "locked",
    voiceoverStatus === "generated" ? "ready" : processed ? "active" : "locked",
    voiceoverStatus === "generated" ? "ready" : "locked",
  ];
  const voiceoverLabel =
    voiceoverStatus === "generated"
      ? "DRAFT READY"
      : processed
        ? "READY TO WRITE"
        : "WAITING FOR TRANSCRIPT";
  const exportText = (kind: "txt" | "srt") => {
    if (!processed || !transcriptResults.length) {
      setExportMessage(
        "Export is blocked until a real validated transcript is returned.",
      );
      return;
    }
    const title = fileName || "GIV production workspace";
    const srtLines = transcriptResults.flatMap((result) =>
      result.transcript.split(/\r?\n/).filter(Boolean),
    );
    const body =
      kind === "srt"
        ? srtLines
            .map((line, index, all) => {
              const match = line.match(
                /^\s*\[?(\d{2}):(\d{2}):(\d{2})\]?\s*(.*)$/,
              );
              if (!match)
                throw new Error(
                  "SRT export blocked: every transcript line must have a validated timecode.",
                );
              const [, h, m, s, text] = match;
              const start = Number(h) * 3600 + Number(m) * 60 + Number(s);
              const next = all[index + 1]?.match(
                /^\s*\[?(\d{2}):(\d{2}):(\d{2})\]?/,
              );
              const nextSeconds = next
                ? Number(next[1]) * 3600 +
                  Number(next[2]) * 60 +
                  Number(next[3])
                : start + 2;
              const end = Math.max(start + 1, nextSeconds);
              const eh = String(Math.floor(end / 3600)).padStart(2, "0");
              const em = String(Math.floor((end % 3600) / 60)).padStart(
                2,
                "0",
              );
              const es = String(end % 60).padStart(2, "0");
              return `${index + 1}\n${h}:${m}:${s},000 --> ${eh}:${em}:${es},000\n${text}\n`;
            })
            .join("\n")
        : `DANA AI PRODUCTION STUDIO\n${title}\n\nExported: ${new Date().toLocaleString("lv-LV")}\nStatus: ${uploaded ? (processed ? "Transcript returned" : "Video queued") : "No video uploaded"}\nGemini: ${geminiStatus}\nChunk length: ${chunkLength} minutes\n\n${transcriptText}`;
    try {
      downloadBlob(
        new Blob([body], {
          type:
            kind === "srt"
              ? "application/x-subrip"
              : "text/plain;charset=utf-8",
        }),
        `dana-ai-${kind}.${kind}`,
      );
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "Export failed.",
      );
      return;
    }
    setExportMessage(`${kind.toUpperCase()} downloaded successfully.`);
  };
  const exportDocx = async () => {
    if (!processed || !transcriptResults.length) {
      setExportMessage(
        "Export is blocked until a real validated transcript is returned.",
      );
      return;
    }
    const title = fileName || "GIV production workspace";
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "DANA AI PRODUCTION STUDIO",
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 24 })],
            }),
            new Paragraph(`Exported: ${new Date().toLocaleString("lv-LV")}`),
            new Paragraph(`Gemini status: ${geminiStatus}`),
            new Paragraph(`Processing chunk: ${chunkLength} minutes`),
            new Paragraph(
              uploaded
                ? processed
                  ? "Transcript returned and ready for review."
                  : "Video is queued for transcription."
                : "No video has been uploaded yet.",
            ),
            new Paragraph(transcriptText),
          ],
        },
      ],
    });
    downloadBlob(await Packer.toBlob(doc), "dana-ai-production-export.docx");
    setExportMessage("DOCX downloaded successfully.");
  };
  const exportVoiceoverDocx = async () => {
    if (!voiceoverDraft.trim()) {
      setVoiceoverMessage("Generate a voice-over before downloading the final document.");
      return;
    }
    const title = fileName || "GIV production workspace";
    const exportedAt = new Date().toLocaleString("lv-LV");
    const ratioLine = voiceoverMetrics
      ? `Ratio: ${voiceoverMetrics.ratioPercent}% · ${voiceoverMetrics.words} words · ${voiceoverMetrics.spokenSeconds}s spoken`
      : "Ratio metrics unavailable.";
    const doc = buildFormattedProductionDocx({
      markdown: voiceoverDraft,
      fileName: title,
      tone: voiceoverTone,
      exportedAt,
      ratioLine,
    });
    const safeName = title
      .replace(/\.[^.]+$/, "")
      .replace(/[^A-Za-z0-9ĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]+/g, "_")
      .replace(/^_+|_+$/g, "") || "DANA_AI";
    downloadBlob(
      await Packer.toBlob(doc),
      `${safeName}_Production_Analysis_and_VO_Formatted.docx`,
    );
    setVoiceoverMessage("Production-ready formatted DOCX downloaded successfully.");
  };
  const exportPdf = async () => {
    if (!processed || !transcriptResults.length) {
      setExportMessage(
        "Export is blocked until a real validated transcript is returned.",
      );
      return;
    }
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return entities[character] || character;
      });
    const popup = window.open("", "_blank");
    if (!popup) {
      setExportMessage(
        "PDF export was blocked by the browser. Allow pop-ups for this site and try again.",
      );
      return;
    }
    popup.opener = null;
    const title = fileName || "GIV production workspace";
    popup.document.write(`<!doctype html><html lang="lv"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{margin:18mm}body{font-family:Arial,Helvetica,sans-serif;color:#17221d;line-height:1.45}h1{font-size:20px;margin:0 0 6px}p{font-size:11px;color:#4b5a52}pre{font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:20px}</style></head><body><h1>DANA AI PRODUCTION STUDIO</h1><p>${escapeHtml(title)} · Exported ${escapeHtml(new Date().toLocaleString("lv-LV"))}</p><pre>${escapeHtml(transcriptText)}</pre></body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
    setExportMessage('PDF print view opened. Choose “Save as PDF” in the browser print dialog.');
  };

  const navigateTo = (item: string) => {
    setActive(item);
    const selector = item === "Workspace" ? ".topbar" : item === "Projects" ? ".project-strip" : item === "Knowledge base" ? ".source-list" : item === "Voice-over library" ? ".voiceover-generator" : ".export-panel";
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div>
            <b>DANA AI</b>
            <small>PRODUCTION STUDIO</small>
          </div>
        </div>
        <div className="workspace-switch">
          <span className="live-dot" /> Dana&apos;s workspace <span>⌄</span>
        </div>
        <nav>
          {[
            "Workspace",
            "Projects",
            "Knowledge base",
            "Voice-over library",
            "Exports",
          ].map((item) => (
            <button
              key={item}
              className={active === item ? "nav-item active" : "nav-item"}
              onClick={() => navigateTo(item)}
            >
              <span>
                {item === "Workspace"
                  ? "◈"
                  : item === "Projects"
                    ? "▣"
                    : item === "Knowledge base"
                      ? "◫"
                      : item === "Voice-over library"
                        ? "▤"
                        : "↗"}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setShowSettings(!showSettings)}
          >
            <span>⚙</span>Settings
          </button>
          <div className="user-card">
            <div className="avatar">DA</div>
            <div>
              <b>Dana Albrehta</b>
              <small>Producer workspace</small>
            </div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <div className="mobile-appbar" aria-label="DANA AI mobile header">
          <div className="mobile-brand"><span className="brand-mark">D</span><div><b>DANA AI</b><small>PRODUCTION STUDIO</small></div></div>
          <button type="button" className="mobile-settings" aria-label="Open settings" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <input
          ref={sourceInput}
          type="file"
          accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.txt,.pdf,.docx,.srt,.vtt,.md,.csv"
          multiple
          hidden
          onChange={(e) => onSources(e.target.files)}
        />
        <input
          ref={segmentInput}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => onSegments(e.target.files)}
        />
        <input
          ref={transcriptImportInput}
          type="file"
          accept=".txt,.srt,.vtt,.docx"
          hidden
          onChange={(e) => void onTranscriptImport(e.target.files)}
        />
        <header id="workspace-top" className="topbar">
          <div>
            <div className="eyebrow">PROJECT / GIV · SEASON 11</div>
            <h1>Production workspace</h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="Refresh status"
              onClick={() => void refreshStatus()}
            >
              {refreshing ? "…" : "↻"}
            </button>
            <button
              className="icon-btn"
              aria-label="Help"
              onClick={() =>
                setProjectMessage(
                  "Workflow: select video → connect Gemini → Start transcription → review transcript → generate voice-over → export.",
                )
              }
            >
              ?
            </button>
            <button
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
            >
              ⚙ Configure
            </button>
          </div>
        </header>

        <div id="projects-module" className="project-strip">
          <div>
            <span className="status-pill">● IN PROGRESS</span>
            <h2>Gandrīz ideālas vakariņas</h2>
            <p>Episode workspace · Scene 02 · Updated just now</p>
            {projectMessage && (
              <p className="inline-message">{projectMessage}</p>
            )}
          </div>
          <div className="strip-right">
            <span>
              Last run{" "}
              <b>
                {processed
                  ? "Transcript returned"
                  : processing
                    ? "Processing"
                    : "—"}
              </b>
            </span>
            <button className="ghost-btn" onClick={createProject}>
              ＋ New project
            </button>
          </div>
        </div>

        <div className="workflow">
          <div className="section-label">
            PRODUCTION FLOW{" "}
            <span>Each stage opens when its source material is ready</span>
          </div>
          <div className="stage-row">
            {stages.map(([num, title, sub], i) => {
              const state = workflowStates[i];
              return (
                <div
                  className={
                    state === "active"
                      ? "stage active-stage"
                      : state === "available"
                        ? "stage available-stage"
                        : "stage"
                  }
                  key={num}
                >
                  <div className="stage-top">
                    <span className="stage-num">{num}</span>
                    <span
                      className={
                        state === "active"
                          ? "stage-state active-state"
                          : "stage-state"
                      }
                    >
                      {state === "ready"
                        ? "✓"
                        : state === "active"
                          ? "●"
                          : state === "available"
                            ? "→"
                            : "·"}
                    </span>
                  </div>
                  <b>{title}</b>
                  <small>{sub}</small>
                  {i < stages.length - 1 && <span className="connector" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="main-grid">
          <div className="primary-column">
            <section className="panel intake-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">CURRENT STAGE · 02</div>
                  <h3>Upload raw video</h3>
                  <p>
                    Generate an authentic Latvian transcript with precise
                    timecodes.
                  </p>
                </div>
                <span className="stage-badge">TRANSCRIPTION</span>
              </div>
              <div
                className={uploaded ? "dropzone uploaded" : "dropzone"}
                onClick={chooseFile}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onFiles(e.dataTransfer.files);
                }}
              >
                <div className="upload-icon">{uploaded ? "✓" : "↑"}</div>
                <b>
                  {uploaded
                    ? `${videoFiles.length} video${videoFiles.length === 1 ? "" : "s"} queued for transcription`
                    : "Drop a video here or browse files"}
                </b>
                <span>
                  {uploaded
                    ? "Select more files any time · originals remain untouched"
                    : "MP4, MOV or MKV · select multiple files"}
                </span>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    chooseFile();
                  }}
                >
                  {uploaded ? "＋ Add videos" : "Browse video"}
                </button>
              </div>
              {videoFiles.length > 0 && (
                <div className="selected-files" aria-label="Selected videos">
                  {videoFiles.map((file) => (
                    <div
                      className="selected-file"
                      key={`${file.name}-${file.size}`}
                    >
                      <span>▶ {file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeVideo(file.name, file.size)}
                        aria-label={`Remove ${file.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="processing-options">
                <div>
                  <b>Fast MP4 stream-copy → Gemini → merge</b>
                  <small>
                    Long MP4 files are split by container structure without
                    re-encoding. Segments are keyframe-aligned, retain the
                    original quality, and receive original timeline offsets.
                  </small>
                </div>
                <label>
                  <span>Segment length</span>
                  <select
                    value={chunkLength}
                    onChange={(e) => setChunkLength(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="8">8 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="12">12 minutes</option>
                    <option value="15">15 minutes</option>
                  </select>
                </label>
              </div>
              <div className="authentic-note">
                <span>◉</span>
                <div>
                  <b>Authenticity lock is on</b>
                  <p>
                    Word-for-word dialogue, natural repetitions, interruptions,
                    laughter and unclear words marked — never invented.
                  </p>
                </div>
                <span className="toggle on" />
              </div>
              <div className="source-preservation">
                <span>◈</span> Original files are never overwritten. Generated
                MP4 segments are temporary derivatives with recorded original
                offsets.
              </div>
              {processingMessage && (
                <div className="processing-message">{processingMessage}</div>
              )}
              {generatedSegments.length > 0 && (
                <div className="segment-list">
                  <b>Generated segments:</b>
                  {generatedSegments.map((name) => (
                    <span key={name}>✓ {name}</span>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading compact">
                <div>
                  <div className="eyebrow">CONNECTED KNOWLEDGE</div>
                  <h3>Reference library</h3>
                  <p className="knowledge-status">
                    {appliedSources.length} of {librarySources.length} sources
                    applied to this project
                  </p>
                </div>
                <div className="library-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={chooseSource}
                    disabled={sourceStatus === "indexing"}
                  >
                    {sourceStatus === "indexing" ? "Indexing…" : "＋ Add source"}
                  </button>
                  <button
                    type="button"
                    className="apply-btn"
                    onClick={applyAllSources}
                  >
                    {appliedSources.length === librarySources.length
                      ? "✓ Applied"
                      : "Apply to project"}
                  </button>
                </div>
              </div>
              {sourceMessage && (
                <div
                  className={`source-feedback ${sourceStatus}`}
                  role={sourceStatus === "error" ? "alert" : "status"}
                >
                  <span>{sourceStatus === "indexing" ? "…" : sourceStatus === "error" ? "!" : "✓"}</span>
                  <div>
                    <b>
                      {sourceStatus === "indexing"
                        ? "Indexing source"
                        : sourceStatus === "error"
                          ? "Source needs attention"
                          : "Source ready"}
                    </b>
                    <small>{sourceMessage}</small>
                  </div>
                </div>
              )}
              <div className="source-list">
                {librarySources.map(([type, name, , ext]) => {
                  const isApplied = appliedSources.includes(name);
                  const isCore = name === CORE_SOURCE_NAME;
                  const isVideo = ["MP4", "MOV", "MKV", "WEBM", "AVI", "M4V"].includes(ext);
                  const isIndexed = Boolean(referenceContents[name]);
                  return (
                    <div
                      className={
                        isApplied ? "source-row applied" : "source-row"
                      }
                      key={`${name}-${ext}`}
                    >
                      <span className="file-icon">
                        {["MP4", "MOV", "MKV"].includes(ext) ? "▶" : "≡"}
                      </span>
                      <div className="source-info">
                        <b>{name}</b>
                        <small>
                          {type} ·{" "}
                          {isCore
                            ? "Core · locked governing source"
                            : isVideo
                              ? isApplied ? "Video reference · applied" : "Video reference · pending"
                              : isIndexed
                                ? isApplied ? "Indexed · applied to project" : "Indexed · pending"
                                : "Needs indexing · add the file again"}
                        </small>
                      </div>
                      <span
                        className={
                          isApplied ? "source-check" : "source-pending"
                        }
                      >
                        {isCore ? "● Core" : isApplied ? isIndexed || isVideo ? "✓ Applied" : "Re-index" : "Pending"}
                      </span>
                      <button
                        type="button"
                        className="remove-source"
                        onClick={() => removeSource(name)}
                        aria-label={isCore ? `${name} is the locked core source` : `Remove ${name}`}
                        disabled={isCore}
                        title={isCore ? "Core production system cannot be removed" : "Remove source"}
                      >
                        {isCore ? "Core" : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="knowledge-note">
                <span>◉</span> Applied references guide the editorial context
                and tone. They do not replace the scene transcript.
              </div>
            </section>
            <section
              className={
                processed
                  ? "panel transcript-review validated"
                  : "panel transcript-review"
              }
              aria-label="Transcript review"
            >
              <div className="panel-heading compact">
                <div>
                  <div className="eyebrow">STAGE 03 · TRANSCRIPT REVIEW</div>
                  <h3>Read the scene before writing</h3>
                  <p>
                    {processed
                      ? "The transcript has returned with validated timecodes. Review the facts, rhythm and emotional beats before generating narration."
                      : "This is the handoff point. A real validated transcript must exist before editorial writing begins."}
                  </p>
                </div>
                <span
                  className={
                    processed ? "stage-badge" : "stage-badge muted-badge"
                  }
                >
                  {processed ? "VALIDATED" : "WAITING"}
                </span>
              </div>
              <div className="transcript-gate">
                <span>{processed ? "✓" : "03"}</span>
                <div>
                  <b>
                    {processed
                      ? "Source material is ready for editorial judgement"
                      : "Voice-over is intentionally not active yet"}
                  </b>
                  <small>
                    {processed
                      ? "Use the transcript below as the factual source. The next stage is Voice-over."
                      : "Upload and transcribe the scene first. DANA AI will never write narration from an unverified or empty source."}
                  </small>
                </div>
              </div>
              {processed ? (
                <>
                  <pre className="transcript-text">{transcriptText}</pre>
                  <div className="knowledge-note">
                    <span>{visualEvidenceText ? "◉" : "○"}</span>
                    <div>
                      <b>Visual Evidence Pass · {visualEvidenceText ? "AVAILABLE" : "UNAVAILABLE"}</b>
                      <p>
                        {visualEvidenceText
                          ? "A separate timestamped visual evidence log is active for editorial authorship. It is never merged into or exported as the authentic transcript."
                          : "Visual evidence unavailable. DANA will use the authentic transcript only and must not invent visual details."}
                      </p>
                    </div>
                  </div>
                  {visualEvidenceText ? (
                    <details>
                      <summary>View timestamped visual evidence</summary>
                      <pre className="transcript-text">{visualEvidenceText}</pre>
                    </details>
                  ) : null}
                  <div className="document-actions">
                    <button type="button" className="export-btn" onClick={saveTimecodeDocument}>
                      Save timecode document
                    </button>
                    <button type="button" className="export-btn" onClick={() => void exportDocx()}>
                      Download timecode DOCX
                    </button>
                    <button type="button" className="export-btn" onClick={chooseTranscriptImport}>
                      Replace / import transcript
                    </button>
                  </div>
                </>
              ) : (
                <div className="transcript-placeholder transcript-import-placeholder">
                  <b>Already have the transcript?</b>
                  <span>Import a previously downloaded DANA transcript and continue directly to voice-over. TXT, SRT, VTT and DOCX are supported.</span>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={chooseTranscriptImport}
                  >
                    Import existing transcript
                  </button>
                </div>
              )}
            </section>
            <section
              className={`panel voiceover-generator ${processed ? "voiceover-ready" : "voiceover-locked"}`}
              aria-label="Voice-over generator"
            >
              <div className="panel-heading compact">
                <div>
                  <div className="eyebrow">STAGE 04 · EDITORIAL VOICE</div>
                  <h3>Shape the story with voice-over</h3>
                  <p>
                    Activate this stage after transcript review. The script must
                    sharpen the scene—not explain what the audience can already
                    see.
                  </p>
                </div>
                <span
                  className={
                    voiceoverStatus === "generated" || processed
                      ? "stage-badge"
                      : "stage-badge muted-badge"
                  }
                >
                  {voiceoverLabel}
                </span>
              </div>
              <div className="voiceover-gate">
                <span>{processed ? "04" : "03"}</span>
                <div>
                  <b>
                    {processed
                      ? "Now you decide what the audience should feel"
                      : "Complete transcript review to unlock editorial writing"}
                  </b>
                  <small>
                    {processed
                      ? "Choose a tone, describe the editorial purpose, and generate a first draft. Every line remains subject to Dana’s approval."
                      : "Required sequence: upload → transcribe → review facts and beats → write voice-over."}
                  </small>
                </div>
              </div>
              <div className="voiceover-ratio-card" aria-label="Mandatory voice-over ratio">
                <div>
                  <b>Mandatory format ratio · 16.67%</b>
                  {goldenMasterMetrics ? (
                    <small>
                      <b>Golden Master Match: {goldenMasterMetrics.score}/100</b> · {Object.entries(goldenMasterMetrics.dimensions).map(([key, value]) => `${key} ${value}`).join(" · ")}
                      {goldenMasterMetrics.creativeFreshness ? ` · WOW Freshness ${goldenMasterMetrics.creativeFreshness.score}/${goldenMasterMetrics.creativeFreshness.threshold}` : ""}
                    </small>
                  ) : (
                    <small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release.</small>
                  )}
                  <small>
                    Calibrated against the three applied episode references: British original, Ainārs Ašaks and Ieva Janiševa. DANA AI monitors the 16.67% target and automatically corrects toward the 16.17%–17.17% standard, but it will not pad a scene with recap or obvious narration just to hit the number.
                  </small>
                </div>
                <strong>
                  {voiceoverMetrics
                    ? `${voiceoverMetrics.ratioPercent}% · ${voiceoverMetrics.words} words`
                    : effectiveRuntimeSeconds > 0
                      ? `Target ≈ ${Math.round((effectiveRuntimeSeconds / 6 / 60) * 130)} words`
                      : "Runtime required"}
                </strong>
              </div>
              <div className="voiceover-model-note" aria-label="Voice-over model">
                <span>✦</span>
                <div>
                  <b>GPT-5.6 Sol · active editorial model</b>
                  <small>Primary writer and precision-correction model. GPT-5.6 Terra is used only as the automatic fallback when Sol is unavailable.</small>
                </div>
              </div>
              <div className="voiceover-controls">
                <label>
                  Editorial brief
                  <textarea
                    value={voiceoverPrompt}
                    onChange={(e) => updateEditorialBrief(e.target.value)}
                    placeholder={
                      voiceoverTone === TAILORED_TONE
                        ? "Describe the desired narrator attitude, humour level, pace, emotional tone, character treatment, references, or specific instructions for this scene."
                        : undefined
                    }
                  />
                </label>
                <label>
                  Editorial tone
                  <select
                    value={voiceoverTone}
                    onChange={(e) => changeEditorialTone(e.target.value)}
                  >
                    <option value={DEFAULT_EDITORIAL_TONE}>{GOLDEN_MASTER_LABEL}</option>
                    <option>
                      Observational · sharp, warm and lightly humorous
                    </option>
                    <option>Dry irony · understated and precise</option>
                    <option>Warm human · intimate and empathetic</option>
                    <option>Rising tension · cinematic and controlled</option>
                    <option>Fast bridge · concise and energetic</option>
                    <option>Classic · British original</option>
                    <option>{TAILORED_TONE}</option>
                  </select>
                </label>
              </div>
              <div className="voiceover-actions">
                <button
                  className="primary-btn"
                  onClick={() => void generateVoiceover()}
                  disabled={!processed || voiceoverStatus === "generating"}
                >
                  {voiceoverStatus === "generating"
                    ? "Writing the first draft…"
                    : voiceoverTone === "Lepers Standard · premium observational comedy"
                      ? "Generate Lepers Golden Master package"
                      : "Write voice-over draft"}
                </button>
                <button
                  className="ghost-btn"
                  onClick={saveVoiceover}
                  disabled={!voiceoverDraft}
                >
                  Save final voice-over document
                </button>
                <button
                  className="ghost-btn"
                  onClick={() => void exportVoiceoverDocx()}
                  disabled={!voiceoverDraft}
                >
                  Download formatted final DOCX
                </button>
              </div>
              {voiceoverMessage && (
                <p
                  className={
                    voiceoverStatus === "failed"
                      ? "error-message"
                      : "success-message"
                  }
                >
                  {voiceoverMessage}
                </p>
              )}
              {voiceoverDraft && (
                <div className="voiceover-draft">
                  <div className="draft-heading">
                    <b>Editorial draft</b>
                    <span>Review before approval</span>
                  </div>
                  <pre>{voiceoverDraft}</pre>
                </div>
              )}{" "}
              {voiceovers.length > 0 && (
                <div className="saved-voiceovers">
                  <b>Saved scripts on this device</b>
                  {voiceovers
                    .filter(
                      (item) =>
                        !voiceoverSearch ||
                        `${item.title} ${item.text}`
                          .toLocaleLowerCase()
                          .includes(voiceoverSearch.toLocaleLowerCase()),
                    )
                    .slice(0, 5)
                    .map((item) => (
                      <div className="saved-document-row" key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceoverDraft(item.text);
                            setVoiceoverStatus("generated");
                          }}
                        >
                          {item.title} · {item.updated} · {item.status}
                        </button>
                        <button
                          type="button"
                          className="delete-document"
                          onClick={() => deleteVoiceover(item.id)}
                          aria-label={`Delete final voice-over document ${item.title}`}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
          <aside className="right-column">
            <section className="panel run-panel">
              <div className="eyebrow">WORKSPACE STATUS</div>
              <div className="run-orb">
                <div className="orb-core">AI</div>
              </div>
              <h3>
                {processing
                  ? "Splitting and transcribing"
                  : processed
                    ? "Transcription complete"
                    : generatedSegments.length
                      ? "Segments prepared"
                      : preferredTool
                        ? "Gemini selected"
                        : "Ready to process"}
              </h3>
              <p>
                {processing
                  ? processingMessage ||
                    "Preparing the automatic segment workflow…"
                  : generatedSegments.length && !processed
                    ? "Segments were prepared and are being submitted in order."
                    : preferredTool
                      ? "Start runs the secure direct upload, Gemini transcription, offset correction, merge and validation workflow."
                      : "Upload a video to begin. The app will not claim transcription completion until a real validated transcript is returned."}
              </p>
              <button
                className="primary-btn full"
                onClick={() => void startProcessing()}
                disabled={processing}
              >
                {processing
                  ? "Processing…"
                  : uploaded
                    ? "Start transcription"
                    : "Choose a video"}{" "}
                <span>→</span>
              </button>
              {(processing ||
                processingStage === "complete" ||
                processingStage === "failed") && (
                <div
                  className={`live-progress ${processingStage}`}
                  aria-live="polite"
                >
                  <div className="progress-heading">
                    <b>
                      {processingStage === "complete"
                        ? "Complete"
                        : processingStage === "failed"
                          ? "Stopped"
                          : `Live progress · ${processingPercent}%`}
                    </b>
                    <span>{formatElapsed(processingElapsed)}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${processingPercent}%` }}
                    />
                  </div>
                  <div className="progress-stage">
                    <span>{processingDetail || "Working…"}</span>
                    <span className="heartbeat" aria-label="Activity indicator">
                      ●
                    </span>
                  </div>
                  <div className="progress-steps">
                    <span className={processingPercent >= 3 ? "done" : ""}>
                      Inspect
                    </span>
                    <span className={processingPercent >= 40 ? "done" : ""}>
                      Split
                    </span>
                    <span className={processingPercent >= 40 ? "done" : ""}>
                      Upload
                    </span>
                    <span className={processingPercent >= 65 ? "done" : ""}>
                      Transcribe
                    </span>
                    <span className={processingPercent >= 90 ? "done" : ""}>
                      Merge
                    </span>
                  </div>
                  {processingStage === "failed" && (
                    <button
                      type="button"
                      className="progress-retry"
                      onClick={() => void startProcessing()}
                    >
                      Retry transcription <span>↻</span>
                    </button>
                  )}
                </div>
              )}
            </section>
            <section className="panel tools-panel">
              <div className="panel-heading compact">
                <div>
                  <div className="eyebrow">EXTENSIONS</div>
                  <h3>Tools & integrations</h3>
                </div>
                <div className="tool-actions">
                  <button
                    className="refresh-btn"
                    onClick={() => void refreshStatus()}
                    disabled={refreshing}
                  >
                    {refreshing ? "Checking…" : "↻ Refresh"}
                  </button>
                  <button
                    className="plus-btn"
                    onClick={() => setShowSettings(true)}
                  >
                    ＋
                  </button>
                </div>
              </div>
              <div
                className={
                  preferredTool === "Gemini 3.6 Flash"
                    ? "tool-row preferred-tool"
                    : "tool-row"
                }
              >
                <span className="tool-logo gemini">✦</span>
                <div>
                  <b>Gemini 3.6 Flash</b>
                    <small>Primary video transcription · Latvian timecodes</small>
                </div>
                <span className="connected">
                  {geminiStatus === "Connected"
                    ? "✓ Connected"
                    : "Not connected"}
                </span>
              </div>
              <div className="tool-row">
                <span className="tool-logo lossless">F</span>
                <div>
                  <b>Native FFmpeg processor</b>
                  <small>
                    Server-side stream-copy splitting · 3-second overlap
                  </small>
                </div>
                <span className={nativeFfmpeg ? "connected" : "not-connected"}>
                  {nativeFfmpeg ? "✓ Connected" : "Not configured"}
                </span>
              </div>
              <div className="tool-row">
                <span className="tool-logo openai">✦</span>
                <div>
                  <b>OpenAI</b>
                  <small>Alternative transcription · analysis · writing</small>
                </div>
                <span className="connected">
                  {openAIStatus === "Connected"
                    ? "✓ Connected"
                    : "Not configured"}
                </span>
              </div>
              <div className="tool-row">
                <span className="tool-logo docs">W</span>
                <div>
                  <b>Document export</b>
                  <small>DOCX · PDF · SRT · TXT</small>
                </div>
                <span className="connected">✓ Working</span>
              </div>
              <button
                className="manage-link"
                onClick={() => setShowSettings(true)}
              >
                Manage tools and API keys <span>→</span>
              </button>
            </section>
          </aside>
        </div>
        {showSettings && (
          <div className="settings-drawer">
            <div className="drawer-head">
              <div>
                <div className="eyebrow">SYSTEM CONFIGURATION</div>
                <h2>Tools & API keys</h2>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            <p className="drawer-intro">
              Add, remove or change the services used by the production
              pipeline. Keys are stored in secure HTTP-only cookies for up to 180 days on this device and are never displayed after saving.
            </p>
            <div className="setting-card">
              <span className="tool-logo gemini">✦</span>
              <div>
                <b>Gemini 3.6 Flash</b>
                <small>
                  Preferred engine for authentic Latvian transcription
                </small>
              </div>
              <span className="key-state">● {geminiStatus}</span>
              <button
                type="button"
                className="small-btn"
                onClick={openGeminiEditor}
              >
                Edit
              </button>
            </div>
            {showGeminiEditor && (
              <div className="api-editor">
                <b>Google Gemini API key</b>
                <small>
                  Paste the key from Google AI Studio. Save automatically tests
                  the live connection.
                </small>
                <input
                  aria-label="Google Gemini API key"
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza…"
                />
                <div className="api-actions">
                  <button
                    type="button"
                    className="small-btn"
                    onClick={saveGeminiKey}
                  >
                    Save & connect
                  </button>
                  <button
                    type="button"
                    className="small-btn"
                    onClick={testGeminiConnection}
                  >
                    Test again
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowGeminiEditor(false)}
                  >
                    Close
                  </button>
                </div>
                {geminiMessage && (
                  <p className="api-message">{geminiMessage}</p>
                )}
              </div>
            )}
            <div className="setting-card">
              <span className="tool-logo lossless">10′</span>
              <div>
                <b>LosslessCut fallback</b>
                <small>
                  Optional desktop splitter for long episodes. Add its segments
                  here as multiple files.
                </small>
              </div>
              <span className="key-state muted">● Optional</span>
              <a
                className="small-btn"
                href="https://github.com/mifi/lossless-cut/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                Get LosslessCut
              </a>
            </div>
            <div className="setting-card">
              <span className="tool-logo openai">✦</span>
              <div>
                <b>OpenAI API</b>
                <small>
                  Alternative transcription, analysis and editorial generation
                </small>
              </div>
              <span className="key-state">● {openAIStatus}</span>
              <button
                type="button"
                className="small-btn"
                onClick={openOpenAIEditor}
              >
                Edit
              </button>
            </div>
            {showOpenAIEditor && (
              <div className="api-editor">
                <b>OpenAI API key</b>
                <small>
                  Paste the key from platform.openai.com. Save automatically
                  tests the live connection.
                </small>
                <input
                  aria-label="OpenAI API key"
                  type="password"
                  value={openAIKey}
                  onChange={(e) => setOpenAIKey(e.target.value)}
                  placeholder="sk-…"
                />
                <div className="api-actions">
                  <button
                    type="button"
                    className="small-btn"
                    onClick={saveOpenAIKey}
                  >
                    Save & connect
                  </button>
                  <button
                    type="button"
                    className="small-btn"
                    onClick={testOpenAIConnection}
                  >
                    Test again
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowOpenAIEditor(false)}
                  >
                    Close
                  </button>
                </div>
                {openAIMessage && (
                  <p className="api-message">{openAIMessage}</p>
                )}
              </div>
            )}
            <div className="setting-card">
              <span className="tool-logo docs">W</span>
              <div>
                <b>Document generator</b>
                <small>DOCX, PDF and subtitle exports</small>
              </div>
              <span className="key-state">● Working</span>
            </div>
            <div className="setting-card">
              <span className="tool-logo retrieval">↗</span>
              <div>
                <b>Knowledge retrieval</b>
                <small>
                  Applied sources supplied to transcription, analysis and
                  voice-over
                </small>
              </div>
              <span className="key-state muted">● Session active</span>
            </div>
            <div className="setting-card chunk-setting">
              <div>
                <b>Recommended segment length</b>
                <small>
                  Use this when splitting long episodes in LosslessCut
                </small>
              </div>
              <select
                value={chunkLength}
                onChange={(e) => setChunkLength(e.target.value)}
              >
                <option value="8">8 minutes</option>
                <option value="10">10 minutes</option>
                <option value="12">12 minutes</option>
                <option value="15">15 minutes</option>
              </select>
            </div>
            <button
              type="button"
              className="outline-btn"
              disabled
              title="Gemini, native FFmpeg and OpenAI are the supported production integrations in this version."
            >
              Supported integrations are already configured
            </button>
          </div>
        )}
        <section className="panel export-panel">
          <div className="panel-heading compact">
            <div>
              <div className="eyebrow">PRODUCTION PACKAGE</div>
              <h3>Export documents</h3>
              <p>
                Download the current workspace package. Real transcript text
                will be included automatically once transcription is returned.
              </p>
            </div>
            <span className="library-count">Ready</span>
          </div>
          <div className="export-actions">
            <button className="export-btn" onClick={() => void exportDocx()}>
              Timecode DOCX
            </button>
            <button className="export-btn" onClick={saveTimecodeDocument}>
              Save timecode
            </button>
            <button className="export-btn" onClick={() => void exportPdf()}>
              PDF
            </button>
            <button className="export-btn" onClick={() => exportText("srt")}>
              SRT
            </button>
            <button className="export-btn" onClick={() => exportText("txt")}>
              TXT
            </button>
          </div>
          {exportMessage && <p className="export-message">✓ {exportMessage}</p>}
        </section>
        <section className="panel document-library-page">
          <div className="panel-heading compact">
            <div>
              <div className="eyebrow">TIMECODE DOCUMENTS</div>
              <h3>Saved timecode documents</h3>
              <p>Reopen or delete saved transcript documents from this device.</p>
            </div>
            <span className="library-count">{timecodeDocuments.length} saved</span>
          </div>
          {timecodeDocuments.length > 0 ? (
            <div className="saved-documents">
              {timecodeDocuments.map((item) => (
                <div className="saved-document-row" key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptResults([{ fileName: item.title, transcript: item.text, model: "Saved document", timecodes: true }]);
                      setProcessed(true);
                      setExportMessage(`Loaded timecode document: ${item.title}`);
                    }}
                  >
                    {item.title} · {item.updated}
                  </button>
                  <button
                    type="button"
                    className="delete-document"
                    onClick={() => deleteTimecodeDocument(item.id)}
                    aria-label={`Delete timecode document ${item.title}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-library compact-empty">
              <div className="empty-icon">▤</div>
              <p>No timecode documents saved yet.</p>
            </div>
          )}
        </section>
        <section className="panel voiceover-library-page">
          <div className="panel-heading compact">
            <div>
              <div className="eyebrow">INTERNAL PRODUCTION LIBRARY</div>
              <h3>Voice-over library</h3>
              <p>Saved final voice-over documents can be reopened or deleted here.</p>
            </div>
            <span className="library-count">
              {voiceovers.length} saved scripts
            </span>
          </div>
          <div className="library-toolbar">
            <input
              value={voiceoverSearch}
              onChange={(e) => setVoiceoverSearch(e.target.value)}
              placeholder="Search scripts, projects or scenes…"
            />
            <span>Device-local production archive</span>
          </div>
          {voiceovers.length === 0 && (
            <div className="empty-library">
              <div className="empty-icon">▤</div>
              <h3>No final voice-overs saved yet</h3>
              <p>Save a generated final voice-over document to make it appear here.</p>
            </div>
          )}
          {voiceovers.length > 0 && (
            <div className="saved-documents">
              {voiceovers.map((item) => (
                <div className="saved-document-row" key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceoverDraft(item.text);
                      setVoiceoverStatus("generated");
                      setVoiceoverMessage(`Loaded final voice-over document: ${item.title}`);
                    }}
                  >
                    {item.title} · {item.updated} · {item.status}
                  </button>
                  <button
                    type="button"
                    className="delete-document"
                    onClick={() => deleteVoiceover(item.id)}
                    aria-label={`Delete final voice-over document ${item.title}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
      <nav className="mobile-bottom-nav" aria-label="Mobile workspace navigation">
        {[["Workspace","◈","Home"],["Projects","▣","Project"],["Knowledge base","◫","Library"],["Voice-over library","▤","Voice"],["Exports","↗","Export"]].map(([item,icon,label]) => (
          <button type="button" key={item} className={active === item ? "active" : ""} onClick={() => navigateTo(item)}><span>{icon}</span><small>{label}</small></button>
        ))}
      </nav>
    </main>
  );
}
