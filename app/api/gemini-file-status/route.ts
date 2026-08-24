import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const FILE_NAME = /^files\/[A-Za-z0-9_-]+$/;

export async function POST(request: Request) {
  try {
    const apiKey = await getStoredKey("gemini");
    if (!apiKey) return NextResponse.json({ ok: false, message: "Gemini API key is missing." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!FILE_NAME.test(name)) return NextResponse.json({ ok: false, message: "Invalid Gemini file identifier." }, { status: 400 });

    const response = await fetch(`${GEMINI_BASE}/v1beta/${name}`, {
      headers: { "x-goog-api-key": apiKey },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: data?.error?.message || `Gemini file status failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }
    const file = data?.file || data;
    return NextResponse.json({
      ok: true,
      state: typeof file?.state === "string" ? file.state : "PROCESSING",
      displayName: file?.displayName || null,
      error: file?.error?.message || null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Gemini file status could not be checked." },
      { status: 502 },
    );
  }
}
