import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      service: "dana-ai-production-studio",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "",
      ref: process.env.VERCEL_GIT_COMMIT_REF || "",
      provenance: "vercel-git",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
