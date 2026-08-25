import { NextResponse } from "next/server";
import { LearningStorageError } from "../../../lib/learning-data-api";
import {
  deleteLearningSource,
  getLearningProfile,
  getLearningSource,
  getLearningSourceContent,
  updateLearningSource,
} from "../../../lib/learning-repository";
import type { LearningAuthority, LearningStatus } from "../../../lib/learning-types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  const status = error instanceof LearningStorageError ? error.status : 500;
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "DANA learning source operation failed." },
    { status },
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const source = await getLearningSource(request, id);
    if (!source) return NextResponse.json({ ok: false, message: "Learning source not found." }, { status: 404 });
    const [profile, content] = await Promise.all([
      getLearningProfile(request, id),
      getLearningSourceContent(request, id),
    ]);
    return NextResponse.json({ ok: true, source, profile: profile?.profile || null, verified: profile?.verified === true, content });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<{
      active: boolean;
      authority: LearningAuthority;
      status: LearningStatus;
      learnedAt: string | null;
      modelProvenance: Record<string, unknown>;
    }>;
    const source = await updateLearningSource(request, id, body);
    if (!source) return NextResponse.json({ ok: false, message: "Learning source not found." }, { status: 404 });
    return NextResponse.json({ ok: true, source });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteLearningSource(request, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
