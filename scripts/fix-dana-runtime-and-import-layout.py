from pathlib import Path

route_path = Path("app/api/generate-voiceover/route.ts")
page_path = Path("app/page.tsx")
css_path = Path("app/modules.css")

route = route_path.read_text()
page = page_path.read_text()
css = css_path.read_text()

# 1) Server-side safety net: recover final runtime from transcript timecodes when
# browser/session state does not contain a runtime value.
if "function inferRuntimeFromTranscript(text: string)" not in route:
    anchor = '''function wordTargets(finalRuntimeSeconds: number) {\n'''
    insert = '''function inferRuntimeFromTranscript(text: string) {\n  const matches = Array.from(\n    String(text || "").matchAll(/(?:^|\\n|\\s)\\[?(\\d{1,2}):(\\d{2}):(\\d{2})(?:[,.]\\d{1,3})?\\]?/g),\n  );\n  const latest = matches.reduce((max, match) => {\n    const hours = Number(match[1]);\n    const minutes = Number(match[2]);\n    const seconds = Number(match[3]);\n    if (minutes > 59 || seconds > 59) return max;\n    return Math.max(max, hours * 3600 + minutes * 60 + seconds);\n  }, 0);\n  return latest > 0 ? latest + 2 : 0;\n}\n\nfunction wordTargets(finalRuntimeSeconds: number) {\n'''
    if anchor not in route:
        raise SystemExit("Could not find wordTargets anchor in voice-over route")
    route = route.replace(anchor, insert, 1)

old_runtime = '''    const finalRuntimeSeconds = Number(body.finalRuntimeSeconds || 0);\n    if (!Number.isFinite(finalRuntimeSeconds) || finalRuntimeSeconds <= 0) {\n      return NextResponse.json(\n        { ok: false, message: "The final video runtime is required so the mandatory voice-over ratio can be enforced.", requestId },\n        { status: 400 },\n      );\n    }\n'''
new_runtime = '''    const providedRuntimeSeconds = Number(body.finalRuntimeSeconds || 0);\n    const inferredRuntimeSeconds = inferRuntimeFromTranscript(body.transcript || "");\n    const finalRuntimeSeconds =\n      Number.isFinite(providedRuntimeSeconds) && providedRuntimeSeconds > 0\n        ? providedRuntimeSeconds\n        : inferredRuntimeSeconds;\n    if (!Number.isFinite(finalRuntimeSeconds) || finalRuntimeSeconds <= 0) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "DANA AI could not determine the scene runtime. Import a timecoded transcript (HH:MM:SS) or transcribe the source video before generating voice-over.",\n          requestId,\n        },\n        { status: 400 },\n      );\n    }\n'''
if "const providedRuntimeSeconds" not in route:
    if old_runtime not in route:
        raise SystemExit("Could not find runtime validation block in voice-over route")
    route = route.replace(old_runtime, new_runtime, 1)

# 2) Client-side recovery: derive the same effective runtime from the active
# transcript so the ratio UI and request payload do not depend on stale state.
transcript_anchor = '''  const workflowStates = [\n'''
if "const effectiveRuntimeSeconds" not in page:
    insert = '''  const effectiveRuntimeSeconds =\n    finalRuntimeSeconds || inferRuntimeFromTranscript(transcriptText);\n  const workflowStates = [\n'''
    if transcript_anchor not in page:
        raise SystemExit("Could not find workflowStates anchor in page")
    page = page.replace(transcript_anchor, insert, 1)

page = page.replace(
    '''          finalRuntimeSeconds,\n''',
    '''          finalRuntimeSeconds: effectiveRuntimeSeconds,\n''',
    1,
)
page = page.replace(
    '''                    : finalRuntimeSeconds > 0\n                      ? `Target ≈ ${Math.round((finalRuntimeSeconds / 6 / 60) * 130)} words`\n''',
    '''                    : effectiveRuntimeSeconds > 0\n                      ? `Target ≈ ${Math.round((effectiveRuntimeSeconds / 6 / 60) * 130)} words`\n''',
    1,
)

# 3) Import card layout: stack text and CTA, increase whitespace and make the
# action button visually deliberate instead of sitting inside the sentence.
layout_css = '''\n.transcript-import-placeholder {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 16px;\n  padding: 32px;\n  min-height: 190px;\n}\n.transcript-import-placeholder b {\n  display: block;\n  font-size: 18px;\n  line-height: 1.3;\n  color: var(--ink);\n}\n.transcript-import-placeholder > span {\n  display: block;\n  max-width: 760px;\n  line-height: 1.6;\n  text-align: center;\n}\n.transcript-import-placeholder .primary-btn {\n  min-width: 280px;\n  margin-top: 4px;\n  padding: 14px 28px;\n  border-radius: 10px;\n}\n@media (max-width: 700px) {\n  .transcript-import-placeholder { padding: 24px 18px; gap: 14px; }\n  .transcript-import-placeholder .primary-btn { width: 100%; min-width: 0; }\n}\n'''
if ".transcript-import-placeholder {" not in css:
    css = css.rstrip() + "\n" + layout_css

route_path.write_text(route)
page_path.write_text(page)
css_path.write_text(css)
print("Patched voice-over runtime recovery and transcript import layout")
