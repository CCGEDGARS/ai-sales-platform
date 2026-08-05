import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.FFMPEG_WORKER_URL?.replace(/\/$/, "");
  if (!url) return NextResponse.json({ ok: true, nativeFfmpeg: false, mode: "short-video-only" });
  try {
    const response = await fetch(`${url}/health`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const healthy = response.ok && data?.ok === true && data?.ffmpeg === true && data?.ffprobe === true;
    return NextResponse.json({ ok: healthy, nativeFfmpeg: healthy, mode: healthy ? "native-ffmpeg" : "short-video-only", worker: data?.version || null });
  } catch {
    return NextResponse.json({ ok: true, nativeFfmpeg: false, mode: "short-video-only" });
  }
}
