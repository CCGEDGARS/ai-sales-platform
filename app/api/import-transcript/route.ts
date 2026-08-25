import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 30;

const MAX_FILE_BYTES = 4_000_000;
const SUPPORTED_EXTENSIONS = new Set([".txt", ".srt", ".vtt", ".docx"]);

type ParsedTranscript = {
  transcript: string;
  runtimeSeconds: number;
};

function extensionOf(name: string) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function hmsToSeconds(hours: string, minutes: string, seconds: string) {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function inferRuntimeFromTranscript(text: string) {
  const matches = Array.from(
    text.matchAll(/(?:^|\n)\s*\[?(\d{2}):(\d{2}):(\d{2})\]?/g),
  );
  if (!matches.length) return 0;
  const latest = matches.reduce((max, match) => {
    const seconds = hmsToSeconds(match[1], match[2], match[3]);
    return Math.max(max, seconds);
  }, 0);
  return latest + 2;
}

function cleanPlainTranscript(raw: string): ParsedTranscript {
  const text = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
  const lines = text.split("\n");
  const firstTimecode = lines.findIndex((line) =>
    /^\s*\[?\d{2}:\d{2}:\d{2}\]?/.test(line),
  );
  if (firstTimecode < 0) {
    throw new Error(
      "No HH:MM:SS timecodes were found. Import a DANA timecoded TXT/DOCX, SRT or VTT transcript.",
    );
  }
  const transcript = lines
    .slice(firstTimecode)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    transcript,
    runtimeSeconds: inferRuntimeFromTranscript(transcript),
  };
}

function cleanSubtitleTranscript(raw: string): ParsedTranscript {
  const text = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .trim();
  const blocks = text.split(/\n{2,}/);
  const output: string[] = [];
  let runtimeSeconds = 0;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timingIndex = lines.findIndex((line) =>
      /\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{1,3}/.test(
        line,
      ),
    );
    if (timingIndex < 0) continue;
    const timing = lines[timingIndex].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/,
    );
    if (!timing) continue;
    const start = `${timing[1]}:${timing[2]}:${timing[3]}`;
    const endSeconds =
      hmsToSeconds(timing[5], timing[6], timing[7]) +
      Number(`0.${String(timing[8]).padEnd(3, "0").slice(0, 3)}`);
    runtimeSeconds = Math.max(runtimeSeconds, Math.ceil(endSeconds));
    const cueText = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cueText) output.push(`[${start}] ${cueText}`);
  }

  if (!output.length) {
    throw new Error("No valid subtitle cues were found in the imported SRT/VTT file.");
  }
  return {
    transcript: output.join("\n"),
    runtimeSeconds: runtimeSeconds || inferRuntimeFromTranscript(output.join("\n")),
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Choose a transcript file to import." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          message: "Transcript import accepts files up to 4 MB.",
        },
        { status: 413 },
      );
    }

    const ext = extensionOf(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Supported transcript formats: TXT, SRT, VTT and DOCX.",
        },
        { status: 400 },
      );
    }

    let raw = "";
    if (ext === ".docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await mammoth.extractRawText({ buffer });
      raw = extracted.value || "";
    } else {
      raw = await file.text();
    }

    const parsed =
      ext === ".srt" || ext === ".vtt"
        ? cleanSubtitleTranscript(raw)
        : cleanPlainTranscript(raw);

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      transcript: parsed.transcript,
      runtimeSeconds: parsed.runtimeSeconds,
      timecodes: true,
      source: "imported-transcript",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Transcript import failed.",
      },
      { status: 400 },
    );
  }
}
