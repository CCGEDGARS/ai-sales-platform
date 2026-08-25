import { NextResponse } from "next/server";
import { LearningStorageError } from "../../lib/learning-data-api";
import {
  listLearningSources,
  registerLearningSource,
  type RegisterLearningSourceInput,
} from "../../lib/learning-repository";

export const runtime = "nodejs";
export const maxDuration = 60;

function failure(error: unknown) {
  const status = error instanceof LearningStorageError ? error.status : 500;
  return NextResponse.json(
    {
      ok: false,
      message: error instanceof Error ? error.message : "DANA learning storage failed.",
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const sources = await listLearningSources(request);
    return NextResponse.json({ ok: true, sources });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RegisterLearningSourceInput>;
    if (!body.sourceFingerprint || !body.originalFilename || !body.sourceType || !body.extension) {
      return NextResponse.json(
        { ok: false, message: "Source fingerprint, filename, source type and extension are required." },
        { status: 400 },
      );
    }
    const result = await registerLearningSource(request, {
      sourceFingerprint: body.sourceFingerprint,
      fingerprintAlgorithm: body.fingerprintAlgorithm,
      originalFilename: body.originalFilename,
      sourceType: body.sourceType,
      extension: body.extension,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      authority: body.authority,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
