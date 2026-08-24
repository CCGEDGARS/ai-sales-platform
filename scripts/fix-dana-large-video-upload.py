from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "app/page.tsx"
TESTS = ROOT / "tests/rendered-html.test.mjs"
UPLOAD_ROUTE = ROOT / "app/api/gemini-upload-session/route.ts"
STATUS_ROUTE = ROOT / "app/api/gemini-file-status/route.ts"
TRANSCRIBE_ROUTE = ROOT / "app/api/transcribe-uploaded/route.ts"

TEST_MARKER = 'test("large videos bypass the Vercel payload limit without exposing the saved Gemini key"'

TEST_BLOCK = r'''

test("large videos bypass the Vercel payload limit without exposing the saved Gemini key", () => {
  assert.match(page, /VERCEL_NATIVE_PROXY_LIMIT/);
  assert.match(page, /fetch\("\/api\/gemini-upload-session"/);
  assert.match(page, /fetch\("\/api\/gemini-file-status"/);
  assert.match(page, /fetch\("\/api\/transcribe-uploaded"/);
  assert.match(page, /nativeProxySafe =\s*nativeFfmpeg\s*&&\s*videoFiles\.length === 1/);
  assert.equal(fs.existsSync("app/api/gemini-upload-session/route.ts"), true);
  assert.equal(fs.existsSync("app/api/gemini-file-status/route.ts"), true);
  assert.equal(fs.existsSync("app/api/transcribe-uploaded/route.ts"), true);
  const uploadSession = fs.readFileSync("app/api/gemini-upload-session/route.ts", "utf8");
  const fileStatus = fs.readFileSync("app/api/gemini-file-status/route.ts", "utf8");
  const uploadedTranscription = fs.readFileSync("app/api/transcribe-uploaded/route.ts", "utf8");
  assert.match(uploadSession, /getStoredKey\("gemini"\)/);
  assert.match(fileStatus, /getStoredKey\("gemini"\)/);
  assert.match(uploadedTranscription, /getStoredKey\("gemini"\)/);
  const secureDirectFunction = page.match(/const transcribeVideoDirectly = async \([\s\S]*?\n  \};/)?.[0] || "";
  assert.doesNotMatch(secureDirectFunction, /x-goog-api-key/);
});
'''

UPLOAD_ROUTE_TEXT = r'''import { NextResponse } from "next/server";
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
'''

STATUS_ROUTE_TEXT = r'''import { NextResponse } from "next/server";
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
'''

TRANSCRIBE_ROUTE_TEXT = r'''import { NextResponse } from "next/server";
import { getStoredKey } from "../../lib/credentials";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";
const FILE_NAME = /^files\/[A-Za-z0-9_-]+$/;

function isModelAvailabilityError(status: number, data: unknown) {
  const detail = JSON.stringify(data || "").toLocaleLowerCase();
  return status === 404 || (detail.includes("model") && (
    detail.includes("not found") ||
    detail.includes("not supported") ||
    detail.includes("does not exist") ||
    detail.includes("unavailable")
  ));
}

async function generate(uri: string, mimeType: string, prompt: string, apiKey: string, model: string) {
  const response = await fetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ file_data: { mime_type: mimeType, file_uri: uri } }, { text: prompt }] }],
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function POST(request: Request) {
  try {
    const apiKey = await getStoredKey("gemini");
    if (!apiKey) return NextResponse.json({ ok: false, message: "Gemini API key is missing." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const uploaded = body?.uploadedFile || {};
    const name = typeof uploaded?.name === "string" ? uploaded.name.trim() : "";
    const uri = typeof uploaded?.uri === "string" ? uploaded.uri.trim() : "";
    const mimeType = typeof uploaded?.mimeType === "string" && uploaded.mimeType.startsWith("video/") ? uploaded.mimeType : "video/mp4";
    const originalFile = typeof body?.originalFile === "string" ? body.originalFile.trim() : "video";
    const referenceManifest = typeof body?.referenceManifest === "string" ? body.referenceManifest : "";
    let model = typeof body?.model === "string" && body.model ? body.model : DEFAULT_MODEL;

    if (!FILE_NAME.test(name) || !uri.startsWith(`${GEMINI_BASE}/`)) {
      return NextResponse.json({ ok: false, message: "Invalid uploaded Gemini file metadata." }, { status: 400 });
    }

    const prompt = `You are producing an authentic Latvian television transcript for the original file “${originalFile}”. Transcribe this video word-for-word in fluent Latvian without polishing, inventing, summarising, or omitting speech. Identify speakers when possible. Put a timestamp relative to the beginning of the video in [HH:MM:SS] format at the beginning of every new phrase, speaker change, or significant pause. Preserve interruptions, laughter, repetitions, and unclear audio as [neskaidrs]. Return only the timecoded transcript. Never fabricate a word.\n\nThe following applied references are active in this project. They are editorial guardrails only for later analysis; they must not change, polish, replace or hallucinate anything in this factual transcript:\n${referenceManifest}`;

    let { response, data } = await generate(uri, mimeType, prompt, apiKey, model);
    if (!response.ok && model !== FALLBACK_MODEL && isModelAvailabilityError(response.status, data)) {
      model = FALLBACK_MODEL;
      ({ response, data } = await generate(uri, mimeType, prompt, apiKey, model));
    }
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: data?.error?.message || `Gemini transcription failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }

    const transcript = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();
    if (!transcript) return NextResponse.json({ ok: false, message: "Gemini returned no transcript." }, { status: 502 });
    if (!/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/.test(transcript)) {
      return NextResponse.json({ ok: false, message: "Gemini returned text without usable timecodes." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, fileName: originalFile, transcript, model, timecodes: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "The uploaded video could not be transcribed." },
      { status: 502 },
    );
  }
}
'''

NEW_UPLOAD_FUNCTION = r'''  const uploadVideoDirectlyToGemini = async (file: File) => {
    const sessionResponse = await fetch("/api/gemini-upload-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
      }),
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session?.ok || !session?.uploadUrl) {
      throw new Error(session?.message || `Gemini upload session could not start (HTTP ${sessionResponse.status}).`);
    }

    const uploaded = await fetch(session.uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": file.type || "video/mp4",
      },
      body: file,
    });
    const uploadedData = await uploaded.json().catch(() => ({}));
    if (!uploaded.ok || !uploadedData?.file?.uri) {
      throw new Error(uploadedData?.error?.message || `Gemini rejected ${file.name} (HTTP ${uploaded.status}).`);
    }
    return {
      name: uploadedData.file.name as string,
      uri: uploadedData.file.uri as string,
      mimeType: uploadedData.file.mimeType || file.type || "video/mp4",
    };
  };
'''

NEW_WAIT_FUNCTION = r'''  const waitForGeminiVideo = async (
    name: string,
    _apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch("/api/gemini-file-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Gemini could not inspect the uploaded video (HTTP ${response.status}).`);
      }
      const state = typeof data?.state === "string" ? data.state : "PROCESSING";
      if (state === "ACTIVE") return;
      if (state === "FAILED") throw new Error(data?.error || "Gemini failed while preparing the uploaded video.");
      onUpdate(`Gemini is preparing ${data?.displayName || "the video"}…`, Math.min(62, 43 + Math.floor(attempt / 3)));
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
    }
    throw new Error("Gemini is still preparing the video after 15 minutes. The request was stopped safely.");
  };
'''

NEW_TRANSCRIBE_FUNCTION = r'''  const transcribeVideoDirectly = async (
    file: File,
    apiKey: string,
    onUpdate: (detail: string, percent: number) => void,
  ): Promise<TranscriptResult> => {
    onUpdate(`Uploading ${file.name} directly to Gemini…`, 40);
    const uploaded = await uploadVideoDirectlyToGemini(file);
    await waitForGeminiVideo(uploaded.name, apiKey, onUpdate);
    onUpdate("Gemini is transcribing the video…", 70);
    const response = await fetch("/api/transcribe-uploaded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadedFile: uploaded,
        originalFile: file.name,
        model: GEMINI_DIRECT_MODEL,
        referenceManifest: buildReferenceBrief(appliedSources),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || `Gemini transcription failed (HTTP ${response.status}).`);
    }
    onUpdate("Transcript returned and timecodes validated.", 90);
    return {
      fileName: data.fileName || file.name,
      transcript: data.transcript,
      model: data.model || GEMINI_DIRECT_MODEL,
      timecodes: data.timecodes === true,
    };
  };
'''

OLD_GUARD = '''    if (!nativeFfmpeg && !geminiKey.trim()) {
      setShowSettings(true);
      setShowGeminiEditor(true);
      setGeminiMessage(
        "The native FFmpeg worker is offline. Re-enter the Gemini API key to use the direct browser fallback securely for this run.",
      );
      return;
    }
'''


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start = text.find(start_marker)
    if start < 0:
      raise RuntimeError(f"Start marker not found: {start_marker}")
    end = text.find(end_marker, start)
    if end < 0:
      raise RuntimeError(f"End marker not found: {end_marker}")
    return text[:start] + replacement + text[end:]


def add_tests() -> None:
    tests = TESTS.read_text()
    if TEST_MARKER not in tests:
        TESTS.write_text(tests.rstrip() + TEST_BLOCK + "\n")


def apply_fix() -> None:
    page = PAGE.read_text()

    if "const VERCEL_NATIVE_PROXY_LIMIT" not in page:
        page = page.replace(
            'const GEMINI_DIRECT_MODEL = "gemini-3.6-flash";\nconst GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";\n',
            'const GEMINI_DIRECT_MODEL = "gemini-3.6-flash";\nconst VERCEL_NATIVE_PROXY_LIMIT = 3_800_000;\n',
        )

    page = replace_between(
        page,
        "  const uploadVideoDirectlyToGemini = async",
        "\n\n  const waitForGeminiVideo = async",
        NEW_UPLOAD_FUNCTION.rstrip(),
    )
    page = replace_between(
        page,
        "  const waitForGeminiVideo = async",
        "\n\n  const transcribeVideoDirectly = async",
        NEW_WAIT_FUNCTION.rstrip(),
    )
    page = replace_between(
        page,
        "  const transcribeVideoDirectly = async",
        "\n  const chooseFile = () =>",
        NEW_TRANSCRIBE_FUNCTION.rstrip(),
    )

    page = page.replace(OLD_GUARD, "")

    start_marker = "  const startProcessing = async () => {"
    start = page.find(start_marker)
    if start < 0:
        raise RuntimeError("startProcessing was not found")
    end = page.find("\n  const ", start + len(start_marker))
    if end < 0:
        raise RuntimeError("Could not locate the end of startProcessing")
    block = page[start:end]
    block = block.replace("nativeFfmpeg", "nativeProxySafe")
    declaration_anchor = '    setPreferredTool("Gemini 3.6 Flash");'
    if "const nativeProxySafe =" not in block:
        block = block.replace(
            declaration_anchor,
            '    const totalVideoBytes = videoFiles.reduce((total, file) => total + file.size, 0);\n'
            '    const nativeProxySafe =\n'
            '      nativeFfmpeg && videoFiles.length === 1 && totalVideoBytes <= VERCEL_NATIVE_PROXY_LIMIT;\n'
            + declaration_anchor,
        )
    page = page[:start] + block + page[end:]

    page = page.replace(
        "Start runs the complete automatic split, Gemini transcription, offset correction, merge and validation workflow.",
        "Start runs the secure direct upload, Gemini transcription, offset correction, merge and validation workflow.",
    )
    page = page.replace(
        "Native processor is preparing segments, then Gemini will transcribe and merge them.",
        "Secure upload is sending the video directly to Gemini, then the system will transcribe, offset, merge and validate it.",
    )

    PAGE.write_text(page)
    UPLOAD_ROUTE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_ROUTE.parent.mkdir(parents=True, exist_ok=True)
    TRANSCRIBE_ROUTE.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROUTE.write_text(UPLOAD_ROUTE_TEXT)
    STATUS_ROUTE.write_text(STATUS_ROUTE_TEXT)
    TRANSCRIBE_ROUTE.write_text(TRANSCRIBE_ROUTE_TEXT)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tests-only", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    add_tests()
    if args.apply:
        apply_fix()
    elif not args.tests_only:
        raise SystemExit("Choose --tests-only or --apply")


if __name__ == "__main__":
    main()
