import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "dana-ai-production-studio" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
