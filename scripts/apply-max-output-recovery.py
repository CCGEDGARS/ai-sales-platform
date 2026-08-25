from pathlib import Path

path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()

text = text.replace(
    'const MAX_BACKGROUND_CORRECTIONS = 5;\n',
    'const MAX_BACKGROUND_CORRECTIONS = 5;\nconst BACKGROUND_MAX_OUTPUT_TOKENS = 64_000;\nconst MAX_OUTPUT_RECOVERY_TOKENS = 96_000;\nconst MAX_OUTPUT_RECOVERIES = 2;\n',
    1,
)

text = text.replace(
    'function metadataFor(finalRuntimeSeconds: number, tone: string, phase: string, correctionAttempt: number) {',
    'function metadataFor(finalRuntimeSeconds: number, tone: string, phase: string, correctionAttempt: number, outputRecoveryAttempt = 0) {',
    1,
)
text = text.replace(
    '    dana_correction_attempt: String(correctionAttempt),\n    dana_runtime_seconds:',
    '    dana_correction_attempt: String(correctionAttempt),\n    dana_output_recovery_attempt: String(outputRecoveryAttempt),\n    dana_runtime_seconds:',
    1,
)

old = '''  metadata,\n  previousResponseId,\n}: {\n  apiKey: string;\n  model: string;\n  system: string;\n  user: string;\n  metadata: Record<string, string>;\n  previousResponseId?: string;\n}) {'''
new = '''  metadata,\n  previousResponseId,\n  maxOutputTokens = BACKGROUND_MAX_OUTPUT_TOKENS,\n}: {\n  apiKey: string;\n  model: string;\n  system: string;\n  user: string;\n  metadata: Record<string, string>;\n  previousResponseId?: string;\n  maxOutputTokens?: number;\n}) {'''
if old not in text:
    raise SystemExit("createBackgroundResponse signature anchor not found")
text = text.replace(old, new, 1)
text = text.replace('      max_output_tokens: 24_000,', '      max_output_tokens: maxOutputTokens,', 1)

old = '''  metadata,\n  previousResponseId,\n}: {\n  apiKey: string;\n  system: string;\n  user: string;\n  metadata: Record<string, string>;\n  previousResponseId: string;\n}) {'''
new = '''  metadata,\n  previousResponseId,\n  maxOutputTokens = BACKGROUND_MAX_OUTPUT_TOKENS,\n}: {\n  apiKey: string;\n  system: string;\n  user: string;\n  metadata: Record<string, string>;\n  previousResponseId: string;\n  maxOutputTokens?: number;\n}) {'''
if old not in text:
    raise SystemExit("createCorrectionResponse signature anchor not found")
text = text.replace(old, new, 1)
text = text.replace(
    '''    metadata,\n    previousResponseId,\n  });''',
    '''    metadata,\n    previousResponseId,\n    maxOutputTokens,\n  });''',
    1,
)
text = text.replace(
    '''      metadata,\n      previousResponseId,\n    });''',
    '''      metadata,\n      previousResponseId,\n      maxOutputTokens,\n    });''',
    1,
)

old = '''    if (data.status === "queued" || data.status === "in_progress") {\n      return NextResponse.json({ ok: true, status: data.status, responseId, phase: data.metadata?.dana_phase || "initial", model: data.model, requestId });\n    }\n    if (data.status !== "completed") {\n      return NextResponse.json(\n        { ok: false, message: `${providerError(data, `OpenAI voice-over job ended with status ${data.status || "unknown"}.`)} Reference: ${requestId}`, requestId },\n        { status: 502 },\n      );\n    }\n\n    const text = responseText(data);\n    if (!text) {\n      return NextResponse.json({ ok: false, message: `OpenAI completed the job without usable voice-over text. Reference: ${requestId}`, requestId }, { status: 502 });\n    }\n\n    const metadata = data.metadata || {};\n    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);\n    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);\n    const phase = metadata.dana_phase || "initial";\n    const correctionTone = metadata.dana_tone || DEFAULT_TONE;\n    const correctionToneProfile = toneProfileFor(correctionTone);'''
new = '''    const metadata = data.metadata || {};\n    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);\n    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);\n    const outputRecoveryAttempt = Number(metadata.dana_output_recovery_attempt || 0);\n    const phase = metadata.dana_phase || "initial";\n    const correctionTone = metadata.dana_tone || DEFAULT_TONE;\n    const correctionToneProfile = toneProfileFor(correctionTone);\n\n    if (data.status === "queued" || data.status === "in_progress") {\n      return NextResponse.json({ ok: true, status: data.status, responseId, phase, model: data.model, requestId });\n    }\n\n    if (data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens" && outputRecoveryAttempt < MAX_OUTPUT_RECOVERIES) {\n      const lepersRecovery = isLepersTone(correctionTone);\n      const recoverySystem = lepersRecovery\n        ? `You are DANA AI's final Latvian executive story editor, fifth diner and creative executive producer. The previous response reached its output-token ceiling before the complete package was delivered. Regenerate the COMPLETE Lepers Golden Master package from the beginning using the original source context. Preserve verified facts, participant dignity, exact package architecture, Fifth Dinner Guest POV, Second Story, Creative Room / WOW, FORMAT SPICE and Golden Master requirements. Do not continue a truncated fragment. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`\n        : `You are DANA AI's final Latvian television voice-over editor, fifth diner and creative executive producer. The previous response reached its output-token ceiling. Regenerate the COMPLETE deliverable from the beginning using the original source context; do not continue a truncated fragment. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES}`;\n      const recoveryUser = lepersRecovery\n        ? `OUTPUT EXPANSION RECOVERY ${outputRecoveryAttempt + 1}/${MAX_OUTPUT_RECOVERIES}: Produce the entire nine-part Lepers Golden Master package from the beginning. The previous draft was incomplete only because the token ceiling was reached. Keep the strongest source-grounded creative decisions, but return one complete self-contained package. Do not omit late sections, do not stop after VO MASTER, and do not merely continue from the cutoff.`\n        : `OUTPUT EXPANSION RECOVERY ${outputRecoveryAttempt + 1}/${MAX_OUTPUT_RECOVERIES}: Return the complete final deliverable from the beginning. The previous response was truncated by the output-token ceiling; do not continue from the cutoff.`;\n      const recovery = await createCorrectionResponse({\n        apiKey,\n        system: recoverySystem,\n        user: recoveryUser,\n        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "output-expansion", correctionAttempt, outputRecoveryAttempt + 1),\n        previousResponseId: responseId,\n        maxOutputTokens: MAX_OUTPUT_RECOVERY_TOKENS,\n      });\n      if (recovery.response.ok && recovery.data.id) {\n        return NextResponse.json({\n          ok: true,\n          status: recovery.data.status || "queued",\n          responseId: recovery.data.id,\n          phase: "output-expansion",\n          outputRecoveryAttempt: outputRecoveryAttempt + 1,\n          model: recovery.data.model || recovery.model,\n          tone: correctionTone,\n          requestId,\n        });\n      }\n    }\n\n    if (data.status !== "completed") {\n      const statusMessage = data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens"\n        ? "DANA AI could not complete the full package within the expanded output budget. Please regenerate; the source and editorial settings remain intact."\n        : providerError(data, `OpenAI voice-over job ended with status ${data.status || "unknown"}.`);\n      return NextResponse.json(\n        { ok: false, message: `${statusMessage} Reference: ${requestId}`, requestId },\n        { status: 502 },\n      );\n    }\n\n    const text = responseText(data);\n    if (!text) {\n      return NextResponse.json({ ok: false, message: `OpenAI completed the job without usable voice-over text. Reference: ${requestId}`, requestId }, { status: 502 });\n    }'''
if old not in text:
    raise SystemExit("GET status block anchor not found")
text = text.replace(old, new, 1)

path.write_text(text)
