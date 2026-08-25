import type { LearningAuthority, LearningProfile, LearningSource } from "./learning-types";

export type LearningProgress = {
  phase: string;
  label: string;
  message?: string;
};

export const LEARNING_STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  extracting: "Extracting / Transcribing",
  transcribing: "Extracting / Transcribing",
  analyzing: "Analyzing",
  "extracting-learning": "Extracting learning",
  verifying: "Verifying",
  learned: "Learned ✓",
  "needs-attention": "Needs attention",
};

export const RETRY_AVAILABLE_LABEL = "Retry available";

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function fingerprintSourceFile(file: File) {
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
  let material: Uint8Array;
  let algorithm = "sha256";
  if (isVideo && file.size > 4 * 1024 * 1024) {
    const sampleSize = 2 * 1024 * 1024;
    const [first, last] = await Promise.all([
      file.slice(0, sampleSize).arrayBuffer(),
      file.slice(Math.max(0, file.size - sampleSize), file.size).arrayBuffer(),
    ]);
    const metadata = new TextEncoder().encode(`${file.name}\n${file.size}\n${file.lastModified}\n`);
    material = new Uint8Array(metadata.byteLength + first.byteLength + last.byteLength);
    material.set(metadata, 0);
    material.set(new Uint8Array(first), metadata.byteLength);
    material.set(new Uint8Array(last), metadata.byteLength + first.byteLength);
    algorithm = "sha256-sampled-v1";
  } else {
    material = new Uint8Array(await file.arrayBuffer());
  }
  const digest = await window.crypto.subtle.digest("SHA-256", material);
  return { fingerprint: hex(digest), algorithm };
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || `DANA learning request failed (HTTP ${response.status}).`);
  }
  return data;
}

export async function fetchLearningSources(): Promise<LearningSource[]> {
  const data = await jsonFetch("/api/learning-sources");
  return Array.isArray(data.sources) ? data.sources : [];
}

export async function registerSourceForLearning(
  file: File,
  sourceType: "document" | "video",
  authority: LearningAuthority = "supporting",
) {
  const { fingerprint, algorithm } = await fingerprintSourceFile(file);
  return jsonFetch("/api/learning-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceFingerprint: fingerprint,
      fingerprintAlgorithm: algorithm,
      originalFilename: file.name,
      sourceType,
      extension: file.name.split(".").pop() || (sourceType === "video" ? "video" : "file"),
      mimeType: file.type || "",
      sizeBytes: file.size,
      authority,
    }),
  }) as Promise<{ ok: true; source: LearningSource; duplicate: boolean }>;
}

export async function startSourceLearning(
  input: {
    sourceId: string;
    content?: string;
    contentKind?: "document-text" | "video-transcript";
    durationSeconds?: number | null;
  },
  onProgress?: (progress: LearningProgress) => void,
) {
  onProgress?.({ phase: "analyzing", label: "Analyzing" });
  const start = await jsonFetch("/api/learn-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let responseId = String(start.responseId || "");
  if (!responseId) throw new Error("DANA learning did not return a background job ID.");
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1200 : 2500));
    const data = await jsonFetch(
      `/api/learn-source?sourceId=${encodeURIComponent(input.sourceId)}&responseId=${encodeURIComponent(responseId)}`,
    );
    responseId = String(data.responseId || responseId);
    const phase = String(data.phase || data.status || "analyzing");
    const label = LEARNING_STATUS_LABELS[phase] || (phase === "queued" || phase === "in_progress" ? "Analyzing" : phase);
    onProgress?.({ phase, label, message: data.message });
    if (data.status === "learned") return data as { source: LearningSource; profile: LearningProfile; status: "learned" };
    if (data.status === "needs-attention") {
      throw new Error(data.message || "Source truth is saved, but the learning profile needs attention.");
    }
  }
  throw new Error("DANA learning is still processing after 15 minutes. Source truth remains saved and can be retried without re-uploading.");
}

export async function fetchLearningSourceDetail(id: string) {
  return jsonFetch(`/api/learning-sources/${encodeURIComponent(id)}`) as Promise<{
    source: LearningSource;
    profile: LearningProfile | null;
    verified: boolean;
    content?: { content_kind?: string; duration_seconds?: number | null } | null;
  }>;
}

export async function patchLearningSource(
  id: string,
  updates: Partial<{ active: boolean; authority: LearningAuthority }>,
) {
  return jsonFetch(`/api/learning-sources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function removeLearningSource(id: string) {
  return jsonFetch(`/api/learning-sources/${encodeURIComponent(id)}`, { method: "DELETE" });
}
