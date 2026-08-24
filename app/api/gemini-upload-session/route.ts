import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const MAX_VIDEO_BYTES = 2_000_000_000;

export async function POST(request: Request) {
  try {
    const apiKey = await getStoredKey("gemini");
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "Gemini API key is missing. Save and connect Gemini first." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body?.fileSize || 0);
    const mimeType =
      typeof body?.mimeType === "string" && body.mimeType.startsWith("video/")
        ? body.mimeType
        : "video/mp4";

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ ok: false, message: "Valid video metadata is required." }, { status: 400 });
    }
    if (fileSize > MAX_VIDEO_BYTES) {
      return NextResponse.json({ ok: false, message: "This source file is larger than the supported 2 GB upload limit." }, { status: 413 });
    }

    const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileSize),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: fileName } }),
      cache: "no-store",
    });

    const data = await start.json().catch(() => ({}));
    if (!start.ok) {
      return NextResponse.json(
        { ok: false, message: data?.error?.message || `Gemini upload session could not start (HTTP ${start.status}).` },
        { status: 502 },
      );
    }

    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      return NextResponse.json({ ok: false, message: "Gemini did not return a resumable upload URL." }, { status: 502 });
    }

    const result = NextResponse.json({ ok: true, uploadUrl });
    result.headers.set("Cache-Control", "no-store, max-age=0");
    return result;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "The Gemini upload session could not be created." },
      { status: 502 },
    );
  }
}
