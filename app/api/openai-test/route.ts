import { NextResponse } from "next/server";\nimport { getStoredKey, storeKey } from "../../lib/credentials";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const submittedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";\n    const apiKey = submittedKey || await getStoredKey("openai");
    if (!apiKey) return NextResponse.json({ ok: false, message: "No API key was provided." }, { status: 400 });
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, message: data?.error?.message || `OpenAI returned HTTP ${response.status}.` }, { status: 502 });
    const result = NextResponse.json({ ok: true, configured: true, model: "OpenAI API" });\n    if (submittedKey) storeKey(result, "openai", submittedKey);\n    return result;
  } catch {
    return NextResponse.json({ ok: false, message: "The connection test could not reach OpenAI." }, { status: 502 });
  }
}
