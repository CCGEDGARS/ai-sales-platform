"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createFile as createMp4File } from "mp4box";
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
type TranscriptResult = {
  fileName: string;
  transcript: string;
  model: string;
  timecodes: boolean;
};
type SegmentPayload = {
  file: File;
  startSeconds: number;
  originalFile: string;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_DIRECT_MODEL = "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
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

const protectedSources = [
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
  const [librarySources, setLibrarySources] = useState<Source[]>(() => {
    if (typeof window === "undefined") return protectedSources;
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("dana-ai-library-sources") || "[]",
      ) as Source[];
      return [
        ...protectedSources,
        ...saved.filter(
          (item) => !protectedSources.some((base) => base[1] === item[1]),
        ),
      ];
    } catch {
      return protectedSources;
    }
  });
  const [appliedSources, setAppliedSources] = useState<string[]>(() => {
    if (typeof window === "undefined")
      return protectedSources.map((source) => source[1]);
    try {
      return Array.from(
        new Set([
          ...protectedSources.map((source) => source[1]),
          ...(JSON.parse(
            window.localStorage.getItem("dana-ai-applied-sources") || "[]",
          ) as string[]),
        ]),
      );
    } catch {
      return protectedSources.map((source) => source[1]);
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
  const [voiceoverPrompt, setVoiceoverPrompt] = useState(
    "Create a production-ready Latvian bridge for this scene. Match the Rihards Lepers reference in depth, rhythm, character insight and intelligent humour; build from contrast, reactions and awkwardness without describing obvious actions or inventing facts.",
  );
  const [voiceoverTone, setVoiceoverTone] = useState(
    "Lepers Standard · premium observational comedy",
  );
  const [voiceoverDraft, setVoiceoverDraft] = useState("");
  const [voiceoverStatus, setVoiceoverStatus] = useState<
    "idle" | "generating" | "generated" | "failed"
  >("idle");
  const [voiceoverMessage, setVoiceoverMessage] = useState("");
  const [voiceoverMetrics, setVoiceoverMetrics] = useState<VoiceoverMetrics | null>(null);
  const [projectMessage, setProjectMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const segmentInput = useRef<HTMLInputElement>(null);
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
    fetch("/api/engine-status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setNativeFfmpeg(Boolean(data?.nativeFfmpeg)))
      .catch(() => setNativeFfmpeg(false));
  }, []);
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
  const formatElapsed = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const uploadVideoDirectlyToGemini = async (file: File, apiKey: string) => {
    const bytes = await file.arrayBuffer();
    const start = await fetch(`${GEMINI_API_BASE}/upload/v1beta/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": file.type || "video/mp4",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: file.name } }),
    });
    const startData = await start.json().catch(() => ({}));
    if (!start.ok) {
      throw new Error(startData?.error?.message || `Gemini upload could not start (HTTP ${start.status}).`);
    }
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) throw new Error("Gemini did not return a resumable upload URL.");
    const uploaded = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": file.type || "video/mp4",
      },
      body: bytes,
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
    apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch(`${GEMINI_API_BASE}/v1beta/${name}`, {
        headers: { "x-goog-api-key": apiKey },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `Gemini could not inspect the uploaded video (HTTP ${response.status}).`);
      const file = data?.file || data;
      const state = typeof file?.state === "string" ? file.state : "PROCESSING";
      if (state === "ACTIVE") return;
      if (state === "FAILED") throw new Error(file?.error?.message || "Gemini failed while preparing the uploaded video.");
      onUpdate(`Gemini is preparing ${file?.displayName || "the video"}…`, Math.min(62, 43 + Math.floor(attempt / 3)));
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
    const uploaded = await uploadVideoDirectlyToGemini(file, apiKey);
    await waitForGeminiVideo(uploaded.name, apiKey, onUpdate);
    const prompt = `You are producing an authentic Latvian television transcript for the original file “${file.name}”. Transcribe this video word-for-word in fluent Latvian without polishing, inventing, summarising, or omitting speech. Identify speakers when possible. Put a timestamp relative to the beginning of the video in [HH:MM:SS] format at the beginning of every new phrase, speaker change, or significant pause. Preserve interruptions, laughter, repetitions, and unclear audio as [neskaidrs]. Return only the timecoded transcript. Never fabricate a word.

The following seven applied references are active in this project. They are editorial guardrails only for later analysis; they must not change, polish, replace or hallucinate anything in this factual transcript:
${buildReferenceBrief(appliedSources)}`;
    const requestGeneration = async (model: string) => {
      const response = await fetch(`${GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } }, { text: prompt }] }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };
    onUpdate("Gemini is transcribing the video…", 70);
    let model = GEMINI_DIRECT_MODEL;
    let { response, data } = await requestGeneration(model);
    const detailText = JSON.stringify(data || "").toLocaleLowerCase();
    const modelUnavailable = response.status === 404 || (detailText.includes("model") && (detailText.includes("not found") || detailText.includes("not supported") || detailText.includes("unavailable")));
    if (!response.ok && modelUnavailable) {
      model = GEMINI_FALLBACK_MODEL;
      onUpdate("Primary Gemini model unavailable; retrying with the compatible fallback…", 72);
      ({ response, data } = await requestGeneration(model));
    }
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini transcription failed (HTTP ${response.status}).`);
    }
    const transcript = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!transcript) throw new Error("Gemini returned no transcript. Try again or use a shorter source file.");
    if (!/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/.test(transcript)) {
      throw new Error("Gemini returned text without usable timecodes, so it was not accepted as an editor-ready transcript.");
    }
    onUpdate("Transcript returned and timecodes validated.", 90);
    return { fileName: file.name, transcript, model, timecodes: true };
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
  const onSources = (files?: FileList | null) => {
    if (!files?.length) return;
    const additions = Array.from(files).map((file) => {
      const extension = file.name.split(".").pop()?.toUpperCase() || "FILE";
      const type =
        extension === "MP4" || extension === "MOV" || extension === "MKV"
          ? "Video reference"
          : "Production reference";
      return [type, file.name, "Added to knowledge base", extension] as Source;
    });
    setLibrarySources((current) => {
      const merged = [...current, ...additions].filter(
        (source, index, all) =>
          all.findIndex((item) => item[1] === source[1]) === index,
      );
      return merged;
    });
    if (sourceInput.current) sourceInput.current.value = "";
  };
  const applyAllSources = () => {
    const names = librarySources.map((source) => source[1]);
    setAppliedSources(names);
    setProjectMessage(
      `${names.length} reference sources are now active in this device's project manifest. Protected sources remain retained across updates.`,
    );
  };
  const removeSource = (name: string) => {
    if (protectedSources.some((source) => source[1] === name)) {
      setProjectMessage(`Protected source retained: ${name}`);
      return;
    }
    const source = librarySources.find((item) => item[1] === name);
    if (!source) return;
    if (
      !window.confirm(
        `Remove “${name}” from the reference library?\n\nThis also removes it from the active project context.`,
      )
    )
      return;
    setLibrarySources((current) => current.filter((item) => item[1] !== name));
    setAppliedSources((current) => current.filter((item) => item !== name));
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
      for (let index = 0; index < videoFiles.length; index += 1) {
        const file = videoFiles[index];
        setProcessingStage(nativeFfmpeg ? "splitting" : "uploading");
        setProcessingMessage(
          nativeFfmpeg
            ? `Preparing ${file.name} with native FFmpeg…`
            : `Sending ${file.name} directly to Gemini without browser re-encoding…`,
        );
        setProcessingPercent(Math.max(8, Math.round(((index + 1) / videoFiles.length) * 35)));
        setProcessingDetail(
          nativeFfmpeg
            ? `File ${index + 1} of ${videoFiles.length} · native stream-copy path`
            : `File ${index + 1} of ${videoFiles.length} · direct video path${durations[index] > 15 * 60 ? " · long-video mode" : ""}`,
        );
        // Direct Gemini is deliberately the fallback. It avoids the old
        // MediaRecorder/MP4Box browser re-encoding trap and supports long
        // videos within Gemini's multimodal context limits.
        segments.push({ file, startSeconds: 0, originalFile: file.name });
      }
      setGeneratedSegments(segments.map((segment) => segment.file.name));
      setProcessingStage("uploading");
      setProcessingPercent(40);
      setProcessingDetail(
        nativeFfmpeg
          ? `${segments.length} source file${segments.length === 1 ? "" : "s"} ready · native processor`
          : `${segments.length} source file${segments.length === 1 ? "" : "s"} ready · direct Gemini mode`,
      );
      setProcessingMessage(
        nativeFfmpeg
          ? `Native FFmpeg prepared ${segments.length} source file${segments.length === 1 ? "" : "s"}. Transcribing with overlap and offset restoration…`
          : `Direct Gemini mode is processing ${segments.length} source file${segments.length === 1 ? "" : "s"} without slow browser splitting…`,
      );
      setTranscriptionMessage(
        nativeFfmpeg
          ? "Native processor is preparing segments, then Gemini will transcribe and merge them."
          : "The browser is uploading the source directly to Gemini so the hosted app cannot time out.",
      );
      let results: TranscriptResult[] = [];
      if (nativeFfmpeg) {
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
          directResults.push(directResult);
        }
        results = directResults;
      }
      setTranscriptResults(results);
      setProcessingStage("merging");
      setProcessingPercent(90);
      setProcessingDetail(
        nativeFfmpeg
          ? "Merging transcripts, restoring offsets and validating timecodes..."
          : "Validating the direct Gemini transcript and preparing it for editorial review...",
      );
      setProcessed(true);
      setProcessingStage("complete");
      setProcessingPercent(100);
      setProcessingDetail("Transcript returned and validated");
      setProcessingMessage(
        nativeFfmpeg
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
  const testOpenAIConnection = () => {
    if (!openAIKey.trim()) {
      setOpenAIMessage("Add an OpenAI API key first.");
      return;
    }
    void saveOpenAIKey();
  };
  const saveGeminiKey = async () => {
    if (!geminiKey.trim()) {
      setGeminiMessage("Paste a Gemini API key before saving.");
      return;
    }
    setGeminiStatus("Saving and testing…");
    setGeminiMessage(
      "Testing the live Gemini connection. The key is used only for this session and is not persisted by this app.",
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
  const testGeminiConnection = () => {
    if (!geminiKey.trim()) {
      setGeminiMessage("Add and save a Gemini API key first.");
      return;
    }
    void saveGeminiKey();
  };
  const refreshStatus = async () => {
    setRefreshing(true);
    setExportMessage("");
    if (geminiKey.trim()) await saveGeminiKey();
    else
      setGeminiMessage(
        "Status refreshed. Add a Gemini API key in Configure to test the live connection.",
      );
    window.setTimeout(() => setRefreshing(false), 450);
  };
  const generateVoiceover = async () => {
    if (!processed || !transcriptResults.length) {
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Generate is blocked until a real validated transcript exists.",
      );
      return;
    }
    if (!openAIKey.trim()) {
      setShowSettings(true);
      setShowOpenAIEditor(true);
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Connect OpenAI first. The voice-over generator uses the connected OpenAI API.",
      );
      return;
    }
    setVoiceoverStatus("generating");
    setVoiceoverMessage(
      "Generating from the validated transcript and applied production context…",
    );
    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openAIKey.trim(),
          transcript: transcriptText,
          prompt: voiceoverPrompt,
          tone: voiceoverTone,
          context: buildReferenceBrief(appliedSources),
          appliedSources,
          finalRuntimeSeconds,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Voice-over generation failed.");
      setVoiceoverDraft(result.text);
      setVoiceoverMetrics(result.metrics || null);
      setVoiceoverStatus("generated");
      setVoiceoverMessage(
        `Generated successfully with ${result.model}. Ratio gate passed: ${result.metrics?.ratioPercent ?? "—"}% of runtime. Review before saving.`,
      );
    } catch (error) {
      setVoiceoverStatus("failed");
      setVoiceoverMetrics(error && typeof error === "object" && "metrics" in error ? (error as { metrics?: VoiceoverMetrics }).metrics || null : null);
      setVoiceoverMessage(
        error instanceof Error
          ? error.message
          : "Voice-over generation failed.",
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
  const transcriptText =
    transcriptResults
      .map((result) => `## ${result.fileName}\n\n${result.transcript}`)
      .join("\n\n") ||
    transcriptionMessage ||
    "No transcript has been returned yet.";
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
    const body =
      kind === "srt"
        ? transcriptResults.length
          ? transcriptResults[0].transcript
              .split(/\r?\n/)
              .filter(Boolean)
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
                const end = next
                  ? Number(next[1]) * 3600 +
                    Number(next[2]) * 60 +
                    Number(next[3])
                  : start + 2;
                const eh = String(Math.floor(end / 3600)).padStart(2, "0");
                const em = String(Math.floor((end % 3600) / 60)).padStart(
                  2,
                  "0",
                );
                const es = String(end % 60).padStart(2, "0");
                return `${index + 1}\n${h}:${m}:${s},000 --> ${eh}:${em}:${es},000\n${text}\n`;
              })
              .join("\n")
          : ""
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
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: "DANA AI FINAL VOICE-OVER", bold: true, size: 28 })] }),
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 24 })] }),
          new Paragraph(`Tone: ${voiceoverTone}`),
          new Paragraph(`Exported: ${new Date().toLocaleString("lv-LV")}`),
          new Paragraph(voiceoverMetrics ? `Ratio: ${voiceoverMetrics.ratioPercent}% · ${voiceoverMetrics.words} words · ${voiceoverMetrics.spokenSeconds}s spoken` : "Ratio metrics unavailable."),
          new Paragraph(voiceoverDraft),
        ],
      }],
    });
    downloadBlob(await Packer.toBlob(doc), "dana-ai-final-voiceover.docx");
    setVoiceoverMessage("Final voice-over DOCX downloaded successfully.");
  };
  const exportPdf = async () => {
    if (!processed || !transcriptResults.length) {
      setExportMessage(
        "Export is blocked until a real validated transcript is returned.",
      );
      return;
    }
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = [
      "DANA AI PRODUCTION STUDIO",
      fileName || "GIV production workspace",
      `Exported: ${new Date().toLocaleString("lv-LV")}`,
      `Gemini status: ${geminiStatus}`,
      `Processing chunk: ${chunkLength} minutes`,
      uploaded
        ? processed
          ? "Transcript returned and ready for review."
          : "Video is queued for transcription."
        : "No video has been uploaded yet.",
      ...transcriptText.split("\n"),
    ];
    lines.forEach((line, index) =>
      page.drawText(line, {
        x: 48,
        y: 760 - index * 30,
        size: index === 0 ? 18 : 12,
        font,
        color: rgb(0.09, 0.16, 0.13),
      }),
    );
    const pdfBytes = await pdf.save();
    const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfArrayBuffer).set(pdfBytes);
    downloadBlob(
      new Blob([pdfArrayBuffer], { type: "application/pdf" }),
      "dana-ai-production-export.pdf",
    );
    setExportMessage("PDF downloaded successfully.");
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
          accept="video/*,.txt,.pdf,.doc,.docx,.srt,.vtt,.mp3,.wav"
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
                  >
                    ＋ Add source
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
              <div className="source-list">
                {librarySources.map(([type, name, , ext]) => {
                  const isApplied = appliedSources.includes(name);
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
                          {isApplied
                            ? "Active in current project"
                            : "Uploaded · not yet applied"}
                        </small>
                      </div>
                      <span
                        className={
                          isApplied ? "source-check" : "source-pending"
                        }
                      >
                        {isApplied ? "✓ Applied" : "Pending"}
                      </span>
                      <button
                        type="button"
                        className="remove-source"
                        onClick={() => removeSource(name)}
                        aria-label={`Remove ${name}`}
                      >
                        Remove
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
                  <div className="document-actions">
                    <button type="button" className="export-btn" onClick={saveTimecodeDocument}>
                      Save timecode document
                    </button>
                    <button type="button" className="export-btn" onClick={() => void exportDocx()}>
                      Download timecode DOCX
                    </button>
                  </div>
                </>
              ) : (
                <div className="transcript-placeholder">
                  The validated transcript will appear here after transcription.
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
                  <small>
                    Calibrated against the three applied episode references: British original, Ainārs Ašaks and Ieva Janiševa. DANA AI estimates spoken duration at 130 Latvian words per minute and rejects drafts outside 16.17%–17.17%.
                  </small>
                </div>
                <strong>
                  {voiceoverMetrics
                    ? `${voiceoverMetrics.ratioPercent}% · ${voiceoverMetrics.words} words`
                    : finalRuntimeSeconds > 0
                      ? `Target ≈ ${Math.round((finalRuntimeSeconds / 6 / 60) * 130)} words`
                      : "Runtime required"}
                </strong>
              </div>
              <div className="voiceover-model-note" aria-label="Voice-over model">
                <span>✦</span>
                <div>
                  <b>GPT-5.6 Sol · high reasoning</b>
                  <small>Frontier editorial generation model. A GPT-5.4 fallback is used only if the connected API cannot serve GPT-5.6 Sol.</small>
                </div>
              </div>
              <div className="voiceover-controls">
                <label>
                  What should this bridge do?
                  <textarea
                    value={voiceoverPrompt}
                    onChange={(e) => setVoiceoverPrompt(e.target.value)}
                  />
                </label>
                <label>
                  Editorial tone
                  <select
                    value={voiceoverTone}
                    onChange={(e) => setVoiceoverTone(e.target.value)}
                  >
                    <option>Lepers Standard · premium observational comedy</option>
                    <option>
                      Observational · sharp, warm and lightly humorous
                    </option>
                    <option>Dry irony · understated and precise</option>
                    <option>Warm human · intimate and empathetic</option>
                    <option>Rising tension · cinematic and controlled</option>
                    <option>Fast bridge · concise and energetic</option>
                    <option>Classic · British original</option>
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
                  Download final DOCX
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
                      ? "Start runs the complete automatic split, Gemini transcription, offset correction, merge and validation workflow."
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
              pipeline. Keys are never displayed after saving.
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
            <button type="button" className="outline-btn">
              ＋ Add another integration
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
            <span>Session-only prototype archive</span>
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
