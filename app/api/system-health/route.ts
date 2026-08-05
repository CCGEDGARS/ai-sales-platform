import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

type Signal = "healthy" | "warning" | "problem" | "unconfigured";

function classify(status: number, detail: string): { signal: Signal; message: string } {
  const lower = detail.toLowerCase();
  if (status === 401 || status === 403) return { signal: "problem", message: "Authentication failed. Replace the API key." };
  if (status === 429 || lower.includes("quota") || lower.includes("resource_exhausted")) return { signal: "problem", message: "Quota or rate limit reached. Check provider billing and limits." };
  if (status >= 500) return { signal: "problem", message: "Provider is currently returning a technical error." };
  return { signal: "problem", message: detail || `Provider returned HTTP ${status}.` };
}

async function geminiHealth() {
  const key = await getStoredKey("gemini");
  if (!key) return { configured: false, signal: "unconfigured" as Signal, message: "No saved key." };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { configured: true, ...classify(response.status, data?.error?.message || "Gemini health check failed.") };
    return { configured: true, signal: "healthy" as Signal, message: "API key valid and Gemini reachable.", budget: "Billing balance is not exposed by a normal Gemini API key; quota exhaustion is detected automatically." };
  } catch {
    return { configured: true, signal: "problem" as Signal, message: "Gemini is unreachable from DANA right now." };
  }
}

async function openAIHealth() {
  const key = await getStoredKey("openai");
  if (!key) return { configured: false, signal: "unconfigured" as Signal, message: "No saved key." };
  try {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { configured: true, ...classify(response.status, data?.error?.message || "OpenAI health check failed.") };
    return { configured: true, signal: "healthy" as Signal, message: "API key valid and OpenAI reachable.", budget: "A normal project API key does not expose organization billing balance; quota/authentication failures are detected automatically." };
  } catch {
    return { configured: true, signal: "problem" as Signal, message: "OpenAI is unreachable from DANA right now." };
  }
}

async function ffmpegHealth() {
  const worker = (process.env.FFMPEG_WORKER_URL || "https://ffmpeg-worker-02na.onrender.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${worker}/health`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const healthy = response.ok && data?.ok === true && data?.ffmpeg === true && data?.ffprobe === true;
    if (!healthy) return { configured: true, signal: "problem" as Signal, message: `FFmpeg worker returned HTTP ${response.status}.` };
    return { configured: true, signal: "healthy" as Signal, message: `Native processor online${data?.version ? ` · ${data.version}` : ""}.` };
  } catch {
    return { configured: true, signal: "problem" as Signal, message: "FFmpeg worker is unreachable." };
  }
}

export async function GET() {
  const [gemini, openai, ffmpeg] = await Promise.all([geminiHealth(), openAIHealth(), ffmpegHealth()]);
  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString(), gemini, openai, ffmpeg });
}
