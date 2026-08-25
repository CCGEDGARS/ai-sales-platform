import { learningApiFetch } from "./learning-data-api";
import type {
  LearningAuthority,
  LearningChunk,
  LearningContentKind,
  LearningProfile,
  LearningSource,
  LearningStatus,
} from "./learning-types";

type SourceRow = {
  id: string;
  source_fingerprint: string;
  fingerprint_algorithm: string;
  original_filename: string;
  source_type: "document" | "video";
  extension: string;
  mime_type: string;
  size_bytes: number | string;
  authority: LearningAuthority;
  active: boolean;
  status: LearningStatus;
  version: number;
  uploaded_at: string;
  learned_at: string | null;
  model_provenance: Record<string, unknown> | null;
};

export type RegisterLearningSourceInput = {
  sourceFingerprint: string;
  fingerprintAlgorithm?: string;
  originalFilename: string;
  sourceType: "document" | "video";
  extension: string;
  mimeType?: string;
  sizeBytes?: number;
  authority?: LearningAuthority;
};

function rowToSource(row: SourceRow): LearningSource {
  return {
    id: row.id,
    sourceFingerprint: row.source_fingerprint,
    fingerprintAlgorithm: row.fingerprint_algorithm,
    originalFilename: row.original_filename,
    sourceType: row.source_type,
    extension: row.extension,
    mimeType: row.mime_type || "",
    sizeBytes: Number(row.size_bytes) || 0,
    authority: row.authority,
    active: row.active,
    status: row.status,
    version: Number(row.version) || 1,
    uploadedAt: row.uploaded_at,
    learnedAt: row.learned_at,
    modelProvenance: row.model_provenance || {},
  };
}

async function rowsFor<T>(
  request: Request,
  tableQuery: string,
  init: RequestInit = {},
) {
  const rows = await learningApiFetch<T[]>(request, tableQuery, init);
  return Array.isArray(rows) ? rows : [];
}

export async function listLearningSources(request: Request) {
  const rows = await rowsFor<SourceRow>(
    request,
    "learning_sources?select=*&order=uploaded_at.desc",
  );
  return rows.map(rowToSource);
}

export async function getLearningSource(request: Request, id: string) {
  const rows = await rowsFor<SourceRow>(
    request,
    `learning_sources?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] ? rowToSource(rows[0]) : null;
}

export async function registerLearningSource(
  request: Request,
  input: RegisterLearningSourceInput,
) {
  const duplicateRows = await rowsFor<SourceRow>(
    request,
    `learning_sources?source_fingerprint=eq.${encodeURIComponent(input.sourceFingerprint)}&select=*&limit=1`,
  );
  if (duplicateRows[0]) {
    return { source: rowToSource(duplicateRows[0]), duplicate: true };
  }

  const sameName = await rowsFor<SourceRow>(
    request,
    `learning_sources?original_filename=eq.${encodeURIComponent(input.originalFilename)}&select=version&order=version.desc&limit=1`,
  );
  const nextVersion = sameName[0] ? Number(sameName[0].version || 1) + 1 : 1;
  const authority: LearningAuthority = input.authority || "supporting";
  const payload = {
    source_fingerprint: input.sourceFingerprint,
    fingerprint_algorithm: input.fingerprintAlgorithm || "sha256",
    original_filename: input.originalFilename,
    source_type: input.sourceType,
    extension: input.extension.toLowerCase(),
    mime_type: input.mimeType || "",
    size_bytes: input.sizeBytes || 0,
    authority,
    active: true,
    status: "uploading",
    version: nextVersion,
    model_provenance: {},
  };
  const created = await rowsFor<SourceRow>(request, "learning_sources", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!created[0]) throw new Error("DANA learning source could not be registered.");
  const source = rowToSource(created[0]);
  await recordLearningEvent(request, source.id, "uploading", "success", "Source registered for workspace-wide learning.");
  return { source, duplicate: false };
}

export async function updateLearningSource(
  request: Request,
  id: string,
  updates: Partial<{
    active: boolean;
    authority: LearningAuthority;
    status: LearningStatus;
    learnedAt: string | null;
    modelProvenance: Record<string, unknown>;
  }>,
) {
  const payload: Record<string, unknown> = {};
  if (typeof updates.active === "boolean") payload.active = updates.active;
  if (updates.authority) payload.authority = updates.authority;
  if (updates.status) payload.status = updates.status;
  if ("learnedAt" in updates) payload.learned_at = updates.learnedAt;
  if (updates.modelProvenance) payload.model_provenance = updates.modelProvenance;
  const rows = await rowsFor<SourceRow>(
    request,
    `learning_sources?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return rows[0] ? rowToSource(rows[0]) : null;
}

export async function deleteLearningSource(request: Request, id: string) {
  await learningApiFetch(
    request,
    `learning_sources?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function saveLearningSourceContent(
  request: Request,
  sourceId: string,
  input: {
    content: string;
    contentKind: LearningContentKind;
    language?: string;
    durationSeconds?: number | null;
  },
) {
  const existing = await rowsFor<{ source_id: string }>(
    request,
    `learning_source_content?source_id=eq.${encodeURIComponent(sourceId)}&select=source_id&limit=1`,
  );
  const payload = {
    source_id: sourceId,
    content: input.content,
    content_kind: input.contentKind,
    language: input.language || "lv",
    duration_seconds: input.durationSeconds ?? null,
    updated_at: new Date().toISOString(),
  };
  if (existing[0]) {
    return rowsFor<Record<string, unknown>>(
      request,
      `learning_source_content?source_id=eq.${encodeURIComponent(sourceId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  }
  return rowsFor<Record<string, unknown>>(request, "learning_source_content", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLearningSourceContent(request: Request, sourceId: string) {
  const rows = await rowsFor<{
    source_id: string;
    content: string;
    content_kind: LearningContentKind;
    language: string;
    duration_seconds: number | null;
  }>(
    request,
    `learning_source_content?source_id=eq.${encodeURIComponent(sourceId)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function saveLearningProfile(
  request: Request,
  sourceId: string,
  profile: LearningProfile,
) {
  const existing = await rowsFor<{ source_id: string }>(
    request,
    `learning_profiles?source_id=eq.${encodeURIComponent(sourceId)}&select=source_id&limit=1`,
  );
  const payload = {
    source_id: sourceId,
    profile,
    coverage_score: profile.verification.coverageScore,
    completeness_score: profile.verification.completenessScore,
    confidence: profile.verification.confidence,
    verification_notes: profile.verification.notes,
    conflicting_rules: profile.verification.conflictingRules,
    verified: profile.verification.verified,
    updated_at: new Date().toISOString(),
  };
  if (existing[0]) {
    return rowsFor<Record<string, unknown>>(
      request,
      `learning_profiles?source_id=eq.${encodeURIComponent(sourceId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  }
  return rowsFor<Record<string, unknown>>(request, "learning_profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLearningProfile(request: Request, sourceId: string) {
  const rows = await rowsFor<{ profile: LearningProfile; verified: boolean }>(
    request,
    `learning_profiles?source_id=eq.${encodeURIComponent(sourceId)}&select=profile,verified&limit=1`,
  );
  return rows[0] || null;
}

export async function replaceLearningChunks(
  request: Request,
  sourceId: string,
  chunks: LearningChunk[],
) {
  await learningApiFetch(
    request,
    `learning_chunks?source_id=eq.${encodeURIComponent(sourceId)}`,
    { method: "DELETE" },
  );
  if (!chunks.length) return [];
  return rowsFor<Record<string, unknown>>(request, "learning_chunks", {
    method: "POST",
    body: JSON.stringify(
      chunks.map((chunk) => ({
        source_id: sourceId,
        category: chunk.category,
        tags: chunk.tags,
        authority: chunk.authority,
        content: chunk.content,
      })),
    ),
  });
}

export async function recordLearningEvent(
  request: Request,
  sourceId: string,
  stage: string,
  status: string,
  message: string,
) {
  return rowsFor<Record<string, unknown>>(request, "learning_events", {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId, stage, status, message }),
  });
}
