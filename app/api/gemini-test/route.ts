import { NextResponse } from "next/server";\nimport { getStoredKey, storeKey } from "../../lib/credentials";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const submittedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";\n    const apiKey = submittedKey || await getStoredKey("gemini");
    const model = typeof body.model === "string" && body.model ? body.model : "gemini-3.6-flash";
    if (!apiKey) return NextResponse.json({ ok: false, message: "No API key was provided." }, { status: 400 });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with exactly: GEMINI CONNECTION SUCCESSFUL" }] }] }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, message: data?.error?.message || `Gemini returned HTTP ${response.status}.`, model, actionable: "The API key is reachable, but this model is not available for the current key or endpoint." }, { status: 502 });
    const result = NextResponse.json({ ok: true, configured: true, model, response: data?.candidates?.[0]?.content?.parts?.[0]?.text || "Connection accepted." });\n    if (submittedKey) storeKey(result, "gemini", submittedKey);\n    return result;
  } catch { return NextResponse.json({ ok: false, message: "The connection test could not reach Google Gemini." }, { status: 502 }); }
}
