from pathlib import Path
import re

route_path = Path("app/api/generate-voiceover/route.ts")
page_path = Path("app/page.tsx")
route = route_path.read_text()
page = page_path.read_text()

# Tone lookup is reused by both the first draft and every correction pass.
if "function toneProfileFor" not in route:
    anchor = "};\n\ntype OpenAIOutputItem"
    insert = '''};\n\nfunction toneProfileFor(tone: string) {\n  return TONE_PROFILES[tone] || TONE_PROFILES[DEFAULT_TONE];\n}\n\ntype OpenAIOutputItem'''
    if anchor not in route:
        raise SystemExit("tone profile anchor not found")
    route = route.replace(anchor, insert, 1)

# Replace ratio metrics and add a structural quality gate for genuine VO cues.
ratio_pattern = re.compile(r"function ratioMetrics\(text: string, finalRuntimeSeconds: number\) \{[\s\S]*?\n\}\n\nfunction responseText")
ratio_replacement = '''function ratioMetrics(text: string, finalRuntimeSeconds: number) {\n  const words = spokenWordCount(text);\n  const spokenSeconds = (words / VOICEOVER_WPM) * 60;\n  const ratio = finalRuntimeSeconds > 0 ? spokenSeconds / finalRuntimeSeconds : 0;\n  const lowerRatio = VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE;\n  const upperRatio = VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE;\n  const standardStatus =\n    finalRuntimeSeconds <= 0\n      ? "runtime-missing"\n      : ratio > upperRatio\n        ? "over-limit"\n        : ratio < lowerRatio\n          ? "under-standard"\n          : "within-standard";\n  return {\n    words,\n    spokenSeconds: Math.round(spokenSeconds),\n    ratio,\n    ratioPercent: Number((ratio * 100).toFixed(2)),\n    targetPercent: Number((VOICEOVER_RATIO_TARGET * 100).toFixed(2)),\n    lowerPercent: Number((lowerRatio * 100).toFixed(2)),\n    upperPercent: Number((upperRatio * 100).toFixed(2)),\n    passes: standardStatus === "within-standard",\n    standardStatus,\n    overLimit: standardStatus === "over-limit",\n  };\n}\n\nfunction voiceoverQualityMetrics(text: string) {\n  const lines = String(text || "")\n    .split(/\\r?\\n/)\n    .map((line) => line.trim())\n    .filter(Boolean);\n  const cuePattern = /^\\[(\\d{1,2}):(\\d{2}):(\\d{2})\\]\\s+VO:\\s+(.+)$/i;\n  const cueLines = lines.filter((line) => cuePattern.test(line));\n  const nonCueLines = lines.filter((line) => !cuePattern.test(line));\n  const cueWordCounts = cueLines.map((line) =>\n    spokenWordCount(line.replace(/^\\[\\d{1,2}:\\d{2}:\\d{2}\\]\\s+VO:\\s*/i, "")),\n  );\n  const oversizedCues = cueWordCounts.filter((count) => count > 55).length;\n  const cueCount = cueLines.length;\n  const formatPasses = cueCount > 0 && nonCueLines.length === 0 && oversizedCues === 0;\n  return {\n    cueCount,\n    nonCueLines: nonCueLines.length,\n    oversizedCues,\n    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,\n    formatPasses,\n  };\n}\n\nfunction responseText'''
route, count = ratio_pattern.subn(ratio_replacement, route, count=1)
if count != 1:
    raise SystemExit(f"ratio block replacement failed: {count}")

# Stronger editorial method: narrator interventions, not chronological transcript recap.
prompts_pattern = re.compile(r"function prompts\(body: VoiceoverInput, finalRuntimeSeconds: number\) \{[\s\S]*?\n\}\n\nfunction metadataFor")
prompts_replacement = '''function prompts(body: VoiceoverInput, finalRuntimeSeconds: number) {\n  const selectedTone = String(body.tone || DEFAULT_TONE);\n  const toneProfile = toneProfileFor(selectedTone);\n  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);\n  const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer for Gandrīz ideālas vakariņas. Write fluent, natural, broadcast-ready Latvian. Your task is SELECTIVE NARRATION, not transcript summarisation. Every line must add editorial value that the viewer cannot already get directly from picture or dialogue. Never invent facts. Never imitate wording from references. Protect participant dignity.\\n\\nSELECTED TONE: ${selectedTone}\\n${toneProfile}\\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;\n  const user = `Create the final Latvian TV voice-over for this scene.\\n\\nEDITORIAL METHOD — FOLLOW IN THIS ORDER:\\n1. Read the transcript only as source evidence. Do not recap the scene.\\n2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation.\\n3. Do not list participant biographies, paraphrase audible dialogue, explain obvious actions, or narrate information the audience already understands.\\n4. Leave silence where narration adds nothing. The narrator is selective, not continuous.\\n5. Format EVERY intervention on one line exactly as: [HH:MM:SS] VO: <one or two broadcast-ready sentences>. No headings, no prose paragraphs, no commentary outside VO cues.\\n6. Keep each cue concise — normally 8-45 spoken words and never more than 55.\\n7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.\\n\\nVOICE-OVER AMOUNT STANDARD:\\nFinal runtime: ${Math.round(finalRuntimeSeconds)} seconds.\\nTarget ≈ ${targetWords} spoken words. Preferred standard band: ${lowerWords}-${upperWords} words (16.17%-17.17% of runtime at 130 Latvian words/minute). Aim to fit this standard by choosing enough legitimate editorial beats. Never exceed ${upperWords} spoken words. If the source does not contain enough legitimate beats, return a shorter selective script rather than padding with recap, biography, dialogue paraphrase or obvious action.\\n\\nEditorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}\\n\\nApplied reference calibration: ${RATIO_REFERENCE_SOURCES.join(", ")}.\\nApplied production context:\\n${body.context || "No reference manifest supplied."}\\n\\nSOURCE TRANSCRIPT:\\n${body.transcript}`;\n  return { selectedTone, system, user, targetWords, lowerWords, upperWords };\n}\n\nfunction metadataFor'''
route, count = prompts_pattern.subn(prompts_replacement, route, count=1)
if count != 1:
    raise SystemExit(f"prompts replacement failed: {count}")

# Allow correction jobs to retain the original source context via previous_response_id.
if "previousResponseId?: string;" not in route:
    route = route.replace(
        '''  metadata: Record<string, string>;\n}) {''',
        '''  metadata: Record<string, string>;\n  previousResponseId?: string;\n}) {''',
        1,
    )
    route = route.replace(
        '''  metadata,\n}: {''',
        '''  metadata,\n  previousResponseId,\n}: {''',
        1,
    )
    route = route.replace(
        '''      metadata,\n      input: [''',
        '''      metadata,\n      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),\n      input: [''',
        1,
    )

# Legacy compatibility response also reports quality, so an old open page never labels transcript prose as proper VO.
legacy_anchor = '''      const metrics = ratioMetrics(text, finalRuntimeSeconds);\n      return NextResponse.json({\n        ok: true,\n        status: "completed",\n        model: legacy.data.model || LEGACY_VOICEOVER_MODEL,\n        text,\n        metrics,\n        ratioWarning: !metrics.passes,\n        tone: selectedTone,\n        requestId,\n      });'''
legacy_replacement = '''      const metrics = ratioMetrics(text, finalRuntimeSeconds);\n      const quality = voiceoverQualityMetrics(text);\n      if (!quality.formatPasses) {\n        return NextResponse.json(\n          {\n            ok: false,\n            message: `DANA AI rejected the draft because it was not formatted as selective TV voice-over cues. Refresh the app and regenerate with the current editorial engine. Reference: ${requestId}`,\n            requestId,\n          },\n          { status: 502 },\n        );\n      }\n      return NextResponse.json({\n        ok: true,\n        status: "completed",\n        model: legacy.data.model || LEGACY_VOICEOVER_MODEL,\n        text,\n        metrics,\n        quality,\n        ratioWarning: !metrics.passes,\n        tone: selectedTone,\n        requestId,\n      });'''
if legacy_anchor in route:
    route = route.replace(legacy_anchor, legacy_replacement, 1)

# Replace the old word-count-only correction with a real editorial quality + ratio correction gate.
correction_pattern = re.compile(r'''    const metrics = ratioMetrics\(text, finalRuntimeSeconds\);\n    const correctionAttempt = Number\(metadata\.dana_correction_attempt \|\| 0\);\n    const phase = metadata\.dana_phase \|\| "initial";\n\n    if \(!metrics\.passes && correctionAttempt < MAX_BACKGROUND_CORRECTIONS\) \{[\s\S]*?\n    \}\n\n    return NextResponse\.json\(\{\n      ok: true,''')
correction_replacement = '''    const metrics = ratioMetrics(text, finalRuntimeSeconds);\n    const quality = voiceoverQualityMetrics(text);\n    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);\n    const phase = metadata.dana_phase || "initial";\n    const correctionTone = metadata.dana_tone || DEFAULT_TONE;\n    const correctionToneProfile = toneProfileFor(correctionTone);\n    const needsCorrection =\n      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard";\n\n    if (needsCorrection && correctionAttempt < MAX_BACKGROUND_CORRECTIONS) {\n      const lowerWords = Number(metadata.dana_lower_words || 0);\n      const upperWords = Number(metadata.dana_upper_words || 0);\n      const targetWords = Number(metadata.dana_target_words || 0);\n      const ratioInstruction = metrics.overLimit\n        ? `The draft is above the format ceiling. Remove the weakest narrator interventions until the spoken total is no more than ${upperWords} words, preferably near ${targetWords}.`\n        : metrics.standardStatus === "under-standard"\n          ? `The draft is below the preferred ${lowerWords}-${upperWords} word band. Using the ORIGINAL SOURCE TRANSCRIPT from the previous response context, add only additional legitimate narrator interventions where the narrator contributes new editorial value. If there are no more legitimate beats, keep the script shorter rather than padding it.`\n          : `Keep the spoken amount inside the ${lowerWords}-${upperWords} word standard while fixing the voice-over structure.`;\n      const correctionSystem = `You are DANA AI's final Latvian television voice-over editor. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} The selected tone must remain clearly recognisable after revision.`;\n      const correctionUser = `Rewrite the complete draft as genuine TV voice-over. ${ratioInstruction}\\nEvery output line must use exactly: [HH:MM:SS] VO: <one or two concise sentences>. Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio. Do not include headings or explanatory prose. Keep each cue under 55 spoken words.\\n\\nCURRENT DRAFT (${metrics.words} spoken words; ${quality.cueCount} valid VO cues):\\n${text}`;\n      const correction = await createBackgroundResponse({\n        apiKey,\n        model: FALLBACK_VOICEOVER_MODEL,\n        system: correctionSystem,\n        user: correctionUser,\n        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "correction", correctionAttempt + 1),\n        previousResponseId: responseId,\n      });\n      if (correction.response.ok && correction.data.id) {\n        return NextResponse.json({\n          ok: true,\n          status: correction.data.status || "queued",\n          responseId: correction.data.id,\n          phase: "correction",\n          correctionAttempt: correctionAttempt + 1,\n          model: correction.data.model || FALLBACK_VOICEOVER_MODEL,\n          tone: correctionTone,\n          requestId,\n        });\n      }\n    }\n\n    if (!quality.formatPasses) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message: `DANA AI rejected the generated text because it still resembled transcript/summary prose instead of selective TV voice-over. Reference: ${requestId}`,\n          requestId,\n        },\n        { status: 502 },\n      );\n    }\n    if (metrics.overLimit) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message: `DANA AI rejected the draft because voice-over exceeds the 17.17% format ceiling. Reference: ${requestId}`,\n          requestId,\n        },\n        { status: 502 },\n      );\n    }\n\n    return NextResponse.json({\n      ok: true,'''
route, count = correction_pattern.subn(correction_replacement, route, count=1)
if count != 1:
    raise SystemExit(f"correction replacement failed: {count}")

# Add final quality/tone fields to the background result.
final_anchor = '''      text,\n      metrics,\n      ratioWarning: !metrics.passes,\n      requestId,'''
final_replacement = '''      text,\n      metrics,\n      quality,\n      ratioWarning: !metrics.passes,\n      tone: correctionTone,\n      requestId,'''
if final_anchor not in route:
    raise SystemExit("final response anchor not found")
route = route.replace(final_anchor, final_replacement, 1)

# UI explains the standard accurately and shows both tone and cue quality on success.
old_success = '''        setVoiceoverMessage(\n          result.ratioWarning\n            ? `Voice-over generated with ${result.model}. Editorial draft is ready; ratio is ${result.metrics?.ratioPercent ?? "—"}% and needs a final timing review.`\n            : `Generated successfully with ${result.model}. Ratio gate passed: ${result.metrics?.ratioPercent ?? "—"}% of runtime. Review before saving.`,\n        );'''
new_success = '''        const ratioStatus = String(result.metrics?.standardStatus || "");\n        const toneApplied = String(result.tone || voiceoverTone);\n        const cueCount = Number(result.quality?.cueCount || 0);\n        setVoiceoverMessage(\n          ratioStatus === "within-standard"\n            ? `Selective voice-over generated with ${result.model}. Tone: ${toneApplied} · ${cueCount} VO cues · ${result.metrics?.ratioPercent ?? "—"}% of runtime — inside the 16.17%-17.17% standard.`\n            : `Selective voice-over generated with ${result.model}. Tone: ${toneApplied} · ${cueCount} VO cues · ${result.metrics?.ratioPercent ?? "—"}% of runtime. The script is below the preferred standard because DANA AI did not add recap or filler merely to increase narration. Review whether more narrator beats are editorially justified.`,\n        );'''
if old_success not in page:
    raise SystemExit("success message anchor not found")
page = page.replace(old_success, new_success, 1)

page = page.replace(
    '''            ? "Voice-over draft is ready and DANA AI is automatically correcting the mandatory narration ratio…"''',
    '''            ? "DANA AI is checking selective VO structure, the selected editorial tone and the narration-ratio standard…"''',
    1,
)
page = page.replace(
    '''                    Calibrated against the three applied episode references: British original, Ainārs Ašaks and Ieva Janiševa. DANA AI estimates spoken duration at 130 Latvian words per minute and rejects drafts outside 16.17%–17.17%.''',
    '''                    Calibrated against the three applied episode references: British original, Ainārs Ašaks and Ieva Janiševa. DANA AI monitors the 16.67% target and automatically corrects toward the 16.17%–17.17% standard, but it will not pad a scene with recap or obvious narration just to hit the number.''',
    1,
)
page = page.replace(
    '''                  <b>GPT-5.6 Sol · durable background generation</b>\n                  <small>Frontier editorial generation runs as a durable OpenAI background job. GPT-5.6 Terra is the automatic fallback and ratio-correction model.</small>''',
    '''                  <b>GPT-5.6 Sol · active editorial model</b>\n                  <small>Primary selective voice-over writer. GPT-5.6 Terra is the automatic fallback and final quality/ratio correction model.</small>''',
    1,
)

route_path.write_text(route)
page_path.write_text(page)
print("Selective, tone-aware, ratio-monitored voice-over repair applied")
