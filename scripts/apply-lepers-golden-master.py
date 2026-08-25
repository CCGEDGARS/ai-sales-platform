from pathlib import Path

route_path = Path("app/api/generate-voiceover/route.ts")
route = route_path.read_text()

imp = 'import { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";\n'
new_imp = imp + 'import { LEPERS_GOLDEN_MASTER_FINGERPRINT, LEPERS_GOLDEN_MASTER_NAME, LEPERS_GOLDEN_MASTER_THRESHOLD, scoreLepersGoldenMaster } from "../../lib/lepers-golden-master";\n'
if 'lepers-golden-master' not in route:
    route = route.replace(imp, new_imp, 1)

route = route.replace('const MAX_BACKGROUND_CORRECTIONS = 2;', 'const MAX_BACKGROUND_CORRECTIONS = 3;', 1)

contract_anchor = '${GLOBAL_SCENE_DIRECTIVE_RULES}\\n\\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'
contract_repl = '${GLOBAL_SCENE_DIRECTIVE_RULES}\\n\\nGOLDEN MASTER CONFORMANCE — LOCKED BENCHMARK\\n${LEPERS_GOLDEN_MASTER_NAME}. Variation is allowed in content, never in production standard. Match the reference fingerprint before returning the package: 16-page analytical depth, seven-act dramaturgical logic when source length supports it, five teaser beats, 30s + 15s promo, four social hooks, fifth-diner humour, concise cue rhythm, decisive editor-facing recommendations, exact tables and the locked VO ratio. Minimum conformance score: ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100.\\nFingerprint: ${JSON.stringify(LEPERS_GOLDEN_MASTER_FINGERPRINT)}\\n\\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'
if 'Fingerprint: ${JSON.stringify(LEPERS_GOLDEN_MASTER_FINGERPRINT)}' not in route:
    if contract_anchor not in route:
        raise SystemExit('missing Lepers contract anchor')
    route = route.replace(contract_anchor, contract_repl, 1)

legacy_anchor = '      const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, selectedTone);\n      const quality = qualityMetricsForOutput(text, selectedTone);\n'
legacy_repl = legacy_anchor + '      const goldenMaster = isLepersTone(selectedTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;\n'
if 'const goldenMaster = isLepersTone(selectedTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;' not in route:
    route = route.replace(legacy_anchor, legacy_repl, 1)

legacy_return = '        quality,\n        ratioWarning: !metrics.passes,\n'
if 'goldenMaster,\n        ratioWarning' not in route:
    route = route.replace(legacy_return, '        quality,\n        goldenMaster,\n        ratioWarning: !metrics.passes,\n', 1)

get_anchor = '    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);\n    const quality = qualityMetricsForOutput(text, correctionTone);\n    const needsCorrection =\n      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard";'
get_repl = '    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);\n    const quality = qualityMetricsForOutput(text, correctionTone);\n    const goldenMaster = isLepersTone(correctionTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;\n    const needsCorrection =\n      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard" || Boolean(goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD);'
if 'Boolean(goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD)' not in route:
    if get_anchor not in route:
        raise SystemExit('missing GET metrics anchor')
    route = route.replace(get_anchor, get_repl, 1)

corr_system_old = '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'
corr_system_new = '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} GOLDEN MASTER CONFORMANCE: preserve the original GLOBAL SCENE DIRECTIVE from previous response context and revise the complete package until the deterministic Golden Master score reaches at least ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'
if 'deterministic Golden Master score reaches at least' not in route:
    route = route.replace(corr_system_old, corr_system_new, 1)

corr_user_anchor = 'Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth.\\n\\nCURRENT PACKAGE (${metrics.words} spoken VO words; ${quality.cueCount} VO rows):\\n${text}`'
corr_user_repl = 'Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth. GOLDEN MASTER CONFORMANCE: current score ${goldenMaster?.score ?? 0}/100. Fix these measurable deficiencies without changing verified facts or losing the original Editorial brief: ${(goldenMaster?.deficiencies || []).join(" ")}\\n\\nCURRENT PACKAGE (${metrics.words} spoken VO words; ${quality.cueCount} VO rows):\\n${text}`'
if 'current score ${goldenMaster?.score ?? 0}/100' not in route:
    if corr_user_anchor not in route:
        raise SystemExit('missing correction user anchor')
    route = route.replace(corr_user_anchor, corr_user_repl, 1)

reject_anchor = '    if (metrics.overLimit) {\n      return NextResponse.json('
reject_block = '''    if (goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message: `DANA AI rejected the Lepers package because Golden Master conformance remained ${goldenMaster.score}/100 after automatic revision; minimum is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. Reference: ${requestId}`,\n          goldenMaster,\n          requestId,\n        },\n        { status: 502 },\n      );\n    }\n    if (metrics.overLimit) {\n      return NextResponse.json('''
if 'Golden Master conformance remained' not in route:
    route = route.replace(reject_anchor, reject_block, 1)

final_return = '      quality,\n      ratioWarning: !metrics.passes,\n'
if route.count('goldenMaster,\n      ratioWarning') == 0:
    route = route.replace(final_return, '      quality,\n      goldenMaster,\n      ratioWarning: !metrics.passes,\n', 1)

route_path.write_text(route)

page_path = Path("app/page.tsx")
page = page_path.read_text()
if 'const GOLDEN_MASTER_LABEL' not in page:
    page = page.replace('const DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";\n', 'const DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";\nconst GOLDEN_MASTER_LABEL = "Lepers Golden Master · locked 10/10 benchmark";\n', 1)

# Keep the API value compatible, but surface the locked benchmark in the UI.
page = page.replace('Generate Lepers production package', 'Generate Lepers Golden Master package')
if 'Golden Master Match' not in page:
    needle = '<b>Mandatory format ratio · 16.67%</b>'
    replacement = '<b>Mandatory format ratio · 16.67%</b><small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release.</small>'
    if needle not in page:
        raise SystemExit('missing ratio UI anchor')
    page = page.replace(needle, replacement, 1)

# Render the selected Lepers option with the Golden Master label while retaining the old value.
page = page.replace('<option selected="">Lepers Standard · premium observational comedy</option>', '<option value={DEFAULT_EDITORIAL_TONE}>{GOLDEN_MASTER_LABEL}</option>')
page_path.write_text(page)
print('Golden Master integration applied')
