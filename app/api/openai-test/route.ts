import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) return NextResponse.json({ ok: false, message: "No API key was provided." }, { status: 400 });
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, message: data?.error?.message || `OpenAI returned HTTP ${response.status}.` }, { status: 502 });
    return NextResponse.json({ ok: true, model: "OpenAI API" });
  } catch {
    return NextResponse.json({ ok: false, message: "The connection test could not reach OpenAI." }, { status: 502 });
  }
}
