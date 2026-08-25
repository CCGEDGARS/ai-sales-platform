import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_INDEXED_CHARACTERS = 250_000;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const TEXT_EXTENSIONS = new Set(["txt", "srt", "vtt", "md", "csv"]);

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function cleanText(value: string) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_INDEXED_CHARACTERS);
}

async function extractPdf(buffer: Buffer) {
  const pdfModule = await import("pdf-parse");
  const Module = pdfModule as unknown as {
    PDFParse?: new (options: { data: Uint8Array }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    };
    default?: ((data: Buffer) => Promise<{ text?: string }>) | unknown;
  };
  if (Module.PDFParse) {
    const parser = new Module.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return String(result?.text || "");
    } finally {
      await parser.destroy?.();
    }
  }
  if (typeof Module.default === "function") {
    const result = await (Module.default as (data: Buffer) => Promise<{ text?: string }>)(buffer);
    return String(result?.text || "");
  }
  throw new Error("The PDF parser is unavailable in this deployment.");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Choose a reference file first." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, message: `Reference documents are limited to ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB for indexing.` },
        { status: 413 },
      );
    }

    const extension = extensionOf(file.name);
    if (VIDEO_EXTENSIONS.has(extension) || file.type.startsWith("video/")) {
      return NextResponse.json({
        ok: true,
        fileName: file.name,
        extension: extension.toUpperCase() || "VIDEO",
        kind: "video",
        indexed: false,
        content: "",
        message: "Video reference registered. Video bytes are not stored in browser knowledge text.",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extracted = "";
    if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
      extracted = buffer.toString("utf8");
    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extracted = result.value || "";
    } else if (extension === "pdf" || file.type === "application/pdf") {
      extracted = await extractPdf(buffer);
    } else {
      return NextResponse.json(
        {
          ok: false,
          message: "This source type cannot be indexed yet. Use DOCX, PDF, TXT, SRT, VTT, MD, CSV or a supported video reference.",
        },
        { status: 415 },
      );
    }

    const content = cleanText(extracted);
    if (!content) {
      return NextResponse.json(
        { ok: false, message: "No readable text was extracted from this reference file." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      extension: extension.toUpperCase() || "FILE",
      kind: "document",
      indexed: true,
      content,
      characters: content.length,
      truncated: extracted.length > MAX_INDEXED_CHARACTERS,
      message: `Indexed ${content.length.toLocaleString("en-US")} characters from ${file.name}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Reference ingestion failed." },
      { status: 500 },
    );
  }
}
