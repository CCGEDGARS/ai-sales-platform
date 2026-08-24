import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const NATIVE_FFMPEG_WORKER = (process.env.FFMPEG_WORKER_URL || "https://ffmpeg-worker-02na.onrender.com").replace(/\/$/, "");
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

    const token = crypto.randomUUID();
    const authorize = await fetch(`${NATIVE_FFMPEG_WORKER}/upload-proxy/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        geminiApiKey: apiKey,
        fileName,
        fileSize,
        mimeType,
      }),
      cache: "no-store",
    });
    const authorizeData = await authorize.json().catch(() => ({}));
    if (!authorize.ok || !authorizeData?.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            authorizeData?.message ||
            `The native upload proxy could not start (HTTP ${authorize.status}).`,
        },
        { status: 502 },
      );
    }

    const uploadUrl = `${NATIVE_FFMPEG_WORKER}/upload-proxy/${encodeURIComponent(token)}`;
    const result = NextResponse.json({ ok: true, uploadUrl });
    result.headers.set("Cache-Control", "no-store, max-age=0");
    return result;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The secure upload proxy could not be created.",
      },
      { status: 502 },
    );
  }
}
