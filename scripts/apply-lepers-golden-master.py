from pathlib import Path

route_path = Path("app/api/generate-voiceover/route.ts")
route = route_path.read_text()

imp = 'import { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";\n'
new_imp = imp + 'import { LEPERS_GOLDEN_MASTER_FINGERPRINT, LEPERS_GOLDEN_MASTER_NAME, LEPERS_GOLDEN_MASTER_THRESHOLD, scoreLepersGoldenMaster } from "../../lib/lepers-golden-master";\n'
if 'lepers-golden-master' not in route:
    route = route.replace(imp, new_imp, 1)
route = route.replace('const MAX_BACKGROUND_CORRECTIONS = 2;', 'const MAX_BACKGROUND_CORRECTIONS = 3;', 1)
contract_anchor = '''${GLOBAL_SCENE_DIRECTIVE_RULES}

${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
contract_repl = '''${GLOBAL_SCENE_DIRECTIVE_RULES}

GOLDEN MASTER CONFORMANCE — LOCKED BENCHMARK
${LEPERS_GOLDEN_MASTER_NAME}. Variation is allowed in content, never in production standard. Match the reference fingerprint before returning the package: 16-page analytical depth, seven-act dramaturgical logic when source length supports it, five teaser beats, 30s + 15s promo, four social hooks, fifth-diner humour, concise cue rhythm, decisive editor-facing recommendations, exact tables and the locked VO ratio. Minimum conformance score: ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100.
Fingerprint: ${JSON.stringify(LEPERS_GOLDEN_MASTER_FINGERPRINT)}

${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
if 'Fingerprint: ${JSON.stringify(LEPERS_GOLDEN_MASTER_FINGERPRINT)}' not in route:
    route = route.replace(contract_anchor, contract_repl, 1)
legacy_anchor = '''      const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, selectedTone);
      const quality = qualityMetricsForOutput(text, selectedTone);
'''
if 'const goldenMaster = isLepersTone(selectedTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;' not in route:
    route = route.replace(legacy_anchor, legacy_anchor + '      const goldenMaster = isLepersTone(selectedTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;\n', 1)
if '        goldenMaster,\n        ratioWarning' not in route:
    route = route.replace('        quality,\n        ratioWarning: !metrics.passes,\n', '        quality,\n        goldenMaster,\n        ratioWarning: !metrics.passes,\n', 1)
get_anchor = '''    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);
    const quality = qualityMetricsForOutput(text, correctionTone);
    const needsCorrection =
      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard";'''
get_repl = '''    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);
    const quality = qualityMetricsForOutput(text, correctionTone);
    const goldenMaster = isLepersTone(correctionTone) ? scoreLepersGoldenMaster(text, finalRuntimeSeconds) : null;
    const needsCorrection =
      !quality.formatPasses || metrics.overLimit || metrics.standardStatus === "under-standard" || Boolean(goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD);'''
if 'Boolean(goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD)' not in route:
    route = route.replace(get_anchor, get_repl, 1)
old = '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'
new = '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} GOLDEN MASTER CONFORMANCE: preserve the original GLOBAL SCENE DIRECTIVE from previous response context and revise the complete package until the deterministic Golden Master score reaches at least ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'
if 'deterministic Golden Master score reaches at least' not in route:
    route = route.replace(old, new, 1)
if 'current score ${goldenMaster?.score ?? 0}/100' not in route:
    corr_phrase = 'Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth.'
    route = route.replace(corr_phrase, corr_phrase + ' GOLDEN MASTER CONFORMANCE: current score ${goldenMaster?.score ?? 0}/100. Fix these measurable deficiencies without changing verified facts or losing the original Editorial brief: ${(goldenMaster?.deficiencies || []).join(" ")}', 1)
reject_anchor = '''    if (metrics.overLimit) {
      return NextResponse.json('''
reject_repl = '''    if (goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD) {
      return NextResponse.json(
        {
          ok: false,
          message: `DANA AI rejected the Lepers package because Golden Master conformance remained ${goldenMaster.score}/100 after automatic revision; minimum is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. Reference: ${requestId}`,
          goldenMaster,
          requestId,
        },
        { status: 502 },
      );
    }
    if (metrics.overLimit) {
      return NextResponse.json('''
if 'Golden Master conformance remained' not in route:
    route = route.replace(reject_anchor, reject_repl, 1)
if '      goldenMaster,\n      ratioWarning' not in route:
    route = route.replace('      quality,\n      ratioWarning: !metrics.passes,\n', '      quality,\n      goldenMaster,\n      ratioWarning: !metrics.passes,\n', 1)
route_path.write_text(route)

page_path = Path("app/page.tsx")
page = page_path.read_text()
if 'type GoldenMasterMetrics' not in page:
    anchor = '''type VoiceoverMetrics = {
  words: number;
  spokenSeconds: number;
  ratioPercent: number;
  targetPercent: number;
  lowerPercent: number;
  upperPercent: number;
  passes: boolean;
};
'''
    addition = anchor + '''type GoldenMasterMetrics = {
  score: number;
  threshold: number;
  passes: boolean;
  dimensions: Record<string, number>;
  deficiencies: string[];
};
'''
    page = page.replace(anchor, addition, 1)
if 'const GOLDEN_MASTER_LABEL' not in page:
    page = page.replace('const DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";\n', 'const DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";\nconst GOLDEN_MASTER_LABEL = "Lepers Golden Master · locked 10/10 benchmark";\n', 1)
if 'const [goldenMasterMetrics, setGoldenMasterMetrics]' not in page:
    page = page.replace('  const [voiceoverMetrics, setVoiceoverMetrics] = useState<VoiceoverMetrics | null>(null);\n', '  const [voiceoverMetrics, setVoiceoverMetrics] = useState<VoiceoverMetrics | null>(null);\n  const [goldenMasterMetrics, setGoldenMasterMetrics] = useState<GoldenMasterMetrics | null>(null);\n', 1)
if 'setGoldenMasterMetrics(result.goldenMaster' not in page:
    page = page.replace('        setVoiceoverMetrics(result.metrics || null);\n', '        setVoiceoverMetrics(result.metrics || null);\n        setGoldenMasterMetrics(result.goldenMaster || null);\n', 1)
page = page.replace('Generate Lepers production package', 'Generate Lepers Golden Master package')
page = page.replace('<option>{DEFAULT_EDITORIAL_TONE}</option>', '<option value={DEFAULT_EDITORIAL_TONE}>{GOLDEN_MASTER_LABEL}</option>')
old_static = '<b>Mandatory format ratio · 16.67%</b><small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release.</small>'
new_dynamic = '''<b>Mandatory format ratio · 16.67%</b>
                  {goldenMasterMetrics ? (
                    <small>
                      <b>Golden Master Match: {goldenMasterMetrics.score}/100</b> · {Object.entries(goldenMasterMetrics.dimensions).map(([key, value]) => `${key} ${value}`).join(" · ")}
                    </small>
                  ) : (
                    <small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release.</small>
                  )}'''
if old_static in page:
    page = page.replace(old_static, new_dynamic, 1)
elif 'Golden Master Match:' not in page:
    page = page.replace('<b>Mandatory format ratio · 16.67%</b>', new_dynamic, 1)
page_path.write_text(page)
print('Golden Master integration applied')
