import { NextResponse } from "next/server";

const WORKER = (process.env.FFMPEG_WORKER_URL || "https://ffmpeg-worker-02na.onrender.com").replace(/\/$/, "");

export async function GET() {
  try {
    const healthResponse = await fetch(`${WORKER}/health`, { cache: "no-store" });
    const health = await healthResponse.json().catch(() => ({}));
    const preflight = await fetch(`${WORKER}/upload-proxy/diagnostic-token`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://dana-studio-jet.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-goog-upload-offset,x-goog-upload-command",
      },
      cache: "no-store",
    });
    const allowOrigin = preflight.headers.get("access-control-allow-origin");
    const allowMethods = preflight.headers.get("access-control-allow-methods");
    const allowHeaders = preflight.headers.get("access-control-allow-headers");
    const healthy =
      healthResponse.ok &&
      health?.ok === true &&
      preflight.ok &&
      allowOrigin === "https://dana-studio-jet.vercel.app" &&
      Boolean(allowMethods?.includes("POST"));
    return NextResponse.json({
      ok: healthy,
      worker: health?.version || null,
      cors: {
        status: preflight.status,
        allowOrigin,
        allowMethods,
        allowHeaders,
      },
    }, { status: healthy ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Upload proxy health check failed." },
      { status: 503 },
    );
  }
}
