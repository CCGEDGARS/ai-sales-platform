const LEARNING_DATA_API_BASE =
  "https://ep-empty-cake-afyj282t.apirest.c-2.us-west-2.aws.neon.tech/neondb/rest/v1";

export const DANA_PRODUCTION_OIDC_SUBJECT =
  "owner:ccgedgars-projects:project:dana-studio:environment:production";

export class LearningStorageError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "LearningStorageError";
    this.status = status;
  }
}

export function requireVercelOidc(request: Request) {
  const token =
    request.headers.get("x-vercel-oidc-token") ||
    process.env.VERCEL_OIDC_TOKEN ||
    "";
  if (!token.trim()) {
    throw new LearningStorageError(
      "Vercel OIDC token is unavailable; persistent DANA learning storage is unavailable.",
      503,
    );
  }
  return token.trim();
}

export async function learningApiFetch<T = unknown>(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requireVercelOidc(request);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && /^(POST|PATCH|PUT)$/i.test(init.method)) {
    headers.set("Prefer", "return=representation");
  }

  const response = await fetch(
    `${LEARNING_DATA_API_BASE}/${path.replace(/^\/+/, "")}`,
    {
      ...init,
      headers,
      cache: "no-store",
    },
  );

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message || "")
        : typeof payload === "string"
          ? payload
          : "";
    throw new LearningStorageError(
      detail || `DANA learning storage returned HTTP ${response.status}.`,
      response.status,
    );
  }

  return payload as T;
}

export function learningDataApiBase() {
  return LEARNING_DATA_API_BASE;
}
