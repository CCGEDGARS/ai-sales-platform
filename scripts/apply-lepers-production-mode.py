from pathlib import Path
import re

PAGE = Path("app/page.tsx")
ROUTE = Path("app/api/generate-voiceover/route.ts")

page = PAGE.read_text()
route = ROUTE.read_text()

# ---------------- page.tsx: real source management + content persistence ----------------
page = page.replace(
    "const protectedSources = [",
    'const CORE_SOURCE_NAME = "DANA AI Master Production System";\n\nconst defaultSources = [',
    1,
)
page = page.replace("protectedSources", "defaultSources")

state_pattern = re.compile(
    r'  const \[librarySources, setLibrarySources\] = useState<Source\[\]>\(\(\) => \{[\s\S]*?\n  \}\);\n  const \[appliedSources, setAppliedSources\] = useState<string\[\]>\(\(\) => \{[\s\S]*?\n  \}\);\n',
    re.M,
)
state_replacement = '''  const [librarySources, setLibrarySources] = useState<Source[]>(() => {
    if (typeof window === "undefined") return defaultSources;
    try {
      const raw = window.localStorage.getItem("dana-ai-library-sources");
      if (!raw) return defaultSources;
      const saved = JSON.parse(raw) as Source[];
      const core = defaultSources.find((source) => source[1] === CORE_SOURCE_NAME)!;
      return [
        core,
        ...saved.filter(
          (item, index, all) =>
            item[1] !== CORE_SOURCE_NAME &&
            all.findIndex((candidate) => candidate[1] === item[1]) === index,
        ),
      ];
    } catch {
      return defaultSources;
    }
  });
  const [appliedSources, setAppliedSources] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultSources.map((source) => source[1]);
    try {
      const raw = window.localStorage.getItem("dana-ai-applied-sources");
      if (!raw) return defaultSources.map((source) => source[1]);
      const saved = JSON.parse(raw) as string[];
      return Array.from(new Set([CORE_SOURCE_NAME, ...saved]));
    } catch {
      return [CORE_SOURCE_NAME];
    }
  });
  const [referenceContents, setReferenceContents] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem("dana-ai-reference-contents") || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });
'''
page, count = state_pattern.subn(state_replacement, page, count=1)
if count != 1:
    raise SystemExit(f"Could not replace library/applied source state: {count}")

applied_effect = '''  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-applied-sources",
        JSON.stringify(appliedSources),
      );
    } catch {}
  }, [appliedSources]);
'''
reference_effect = '''  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-reference-contents",
        JSON.stringify(referenceContents),
      );
    } catch {}
  }, [referenceContents]);
'''
if reference_effect not in page:
    if applied_effect not in page:
        raise SystemExit("Could not locate applied source persistence effect")
    page = page.replace(applied_effect, applied_effect + reference_effect, 1)

on_sources_pattern = re.compile(
    r'  const onSources = \(files\?: FileList \| null\) => \{[\s\S]*?\n  \};\n  const applyAllSources = \(\) => \{',
    re.M,
)
on_sources_replacement = '''  const onSources = async (files?: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    setProjectMessage(`Indexing ${incoming.length} reference source${incoming.length === 1 ? "" : "s"}…`);
    const additions: Source[] = [];
    const indexedContents: Record<string, string> = {};
    const failures: string[] = [];
    for (const file of incoming) {
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/ingest-reference", { method: "POST", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(data?.message || `Could not index ${file.name} (HTTP ${response.status}).`);
        }
        const extension = String(data.extension || file.name.split(".").pop() || "FILE").toUpperCase();
        const type = data.kind === "video" ? "Video reference" : "Production reference";
        additions.push([type, file.name, data.indexed ? "Indexed knowledge source" : "Registered video reference", extension]);
        if (data.indexed && typeof data.content === "string" && data.content.trim()) {
          indexedContents[file.name] = data.content;
        }
      } catch (error) {
        failures.push(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: indexing failed`);
      }
    }
    if (additions.length) {
      setLibrarySources((current) => {
        const incomingNames = new Set(additions.map((source) => source[1]));
        return [...current.filter((source) => !incomingNames.has(source[1])), ...additions];
      });
      setReferenceContents((current) => ({ ...current, ...indexedContents }));
      setAppliedSources((current) => Array.from(new Set([...current, ...additions.map((source) => source[1]), CORE_SOURCE_NAME])));
    }
    setProjectMessage(
      [
        additions.length ? `${additions.length} source${additions.length === 1 ? "" : "s"} added and applied. ${Object.keys(indexedContents).length} document${Object.keys(indexedContents).length === 1 ? "" : "s"} indexed into real editorial context.` : "No sources were added.",
        failures.length ? `Failed: ${failures.join(" · ")}` : "",
      ].filter(Boolean).join(" "),
    );
    if (sourceInput.current) sourceInput.current.value = "";
  };
  const applyAllSources = () => {'''
page, count = on_sources_pattern.subn(on_sources_replacement, page, count=1)
if count != 1:
    raise SystemExit(f"Could not replace onSources: {count}")

page = page.replace(
    "Protected sources remain retained across updates.",
    "The DANA Master Production System remains the only locked core source.",
)

remove_pattern = re.compile(
    r'  const removeSource = \(name: string\) => \{[\s\S]*?\n  \};\n  // Retained as an explicit manual fallback',
    re.M,
)
remove_replacement = '''  const removeSource = (name: string) => {
    if (name === CORE_SOURCE_NAME) {
      setProjectMessage("The DANA AI Master Production System is the governing core and cannot be removed.");
      return;
    }
    const source = librarySources.find((item) => item[1] === name);
    if (!source) return;
    if (!window.confirm(`Remove “${name}” from the reference library?\\n\\nThis also removes it from the active project context.`)) return;
    setLibrarySources((current) => current.filter((item) => item[1] !== name));
    setAppliedSources((current) => current.filter((item) => item !== name));
    setReferenceContents((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setProjectMessage(`Removed ${name} from the library and active editorial context.`);
  };
  // Retained as an explicit manual fallback'''
page, count = remove_pattern.subn(remove_replacement, page, count=1)
if count != 1:
    raise SystemExit(f"Could not replace removeSource: {count}")

# Give the source rows real indexing state.
page = page.replace(
    '                  const isApplied = appliedSources.includes(name);\n                  return (',
    '                  const isApplied = appliedSources.includes(name);\n                  const isCore = name === CORE_SOURCE_NAME;\n                  const isVideo = ["MP4", "MOV", "MKV", "WEBM", "AVI", "M4V"].includes(ext);\n                  const isIndexed = Boolean(referenceContents[name]);\n                  return (',
    1,
)
old_small = '''                          {type} ·{" "}
                          {isApplied
                            ? "Active in current project"
                            : "Uploaded · not yet applied"}'''
new_small = '''                          {type} ·{" "}
                          {isCore
                            ? "Core · locked governing source"
                            : isVideo
                              ? isApplied ? "Video reference · applied" : "Video reference · pending"
                              : isIndexed
                                ? isApplied ? "Indexed · applied to project" : "Indexed · pending"
                                : "Needs indexing · add the file again"}'''
if old_small not in page:
    raise SystemExit("Could not locate source status text")
page = page.replace(old_small, new_small, 1)

page = page.replace(
    '{isApplied ? "✓ Applied" : "Pending"}',
    '{isCore ? "● Core" : isApplied ? isIndexed || isVideo ? "✓ Applied" : "Re-index" : "Pending"}',
    1,
)

old_button = '''                      <button
                        type="button"
                        className="remove-source"
                        onClick={() => removeSource(name)}
                        aria-label={`Remove ${name}`}
                      >
                        Remove
                      </button>'''
new_button = '''                      <button
                        type="button"
                        className="remove-source"
                        onClick={() => removeSource(name)}
                        aria-label={isCore ? `${name} is the locked core source` : `Remove ${name}`}
                        disabled={isCore}
                        title={isCore ? "Core production system cannot be removed" : "Remove source"}
                      >
                        {isCore ? "Core" : "Remove"}
                      </button>'''
if old_button not in page:
    raise SystemExit("Could not locate remove source button")
page = page.replace(old_button, new_button, 1)

payload_needle = '''          context: buildReferenceBrief(appliedSources),
          appliedSources,
          finalRuntimeSeconds: effectiveRuntimeSeconds,'''
payload_replacement = '''          context: buildReferenceBrief(appliedSources),
          appliedSources,
          referenceContents: Object.fromEntries(
            appliedSources
              .filter((name) => Boolean(referenceContents[name]))
              .map((name) => [name, referenceContents[name]]),
          ),
          finalRuntimeSeconds: effectiveRuntimeSeconds,'''
if payload_needle not in page:
    raise SystemExit("Could not locate voiceover request payload")
page = page.replace(payload_needle, payload_replacement, 1)

page = page.replace(
    ': "Write voice-over draft"',
    ': voiceoverTone === "Lepers Standard · premium observational comedy"\n                      ? "Generate Lepers production package"\n                      : "Write voice-over draft"',
    1,
)

# ---------------- generate-voiceover route: full package + VO-only ratio ----------------
route = route.replace(
    'import { getStoredKey } from "../../lib/credentials";\n',
    'import { getStoredKey } from "../../lib/credentials";\nimport { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";\n',
    1,
)
route = route.replace('const REQUIRED_REFERENCE_COUNT = 7;\n', '')
route = route.replace(
    '  finalRuntimeSeconds?: number;\n};',
    '  finalRuntimeSeconds?: number;\n  referenceContents?: Record<string, string>;\n};',
    1,
)

helper_anchor = '''function wordTargets(finalRuntimeSeconds: number) {
  return {
    targetWords: Math.round(((finalRuntimeSeconds * VOICEOVER_RATIO_TARGET) / 60) * VOICEOVER_WPM),
    lowerWords: Math.ceil(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET - VOICEOVER_RATIO_TOLERANCE)) / 60) * VOICEOVER_WPM,
    ),
    upperWords: Math.floor(
      ((finalRuntimeSeconds * (VOICEOVER_RATIO_TARGET + VOICEOVER_RATIO_TOLERANCE)) / 60) * VOICEOVER_WPM,
    ),
  };
}
'''
helpers = r'''
function isLepersTone(tone: string) {
  return tone === DEFAULT_TONE;
}

function extractVoiceoverMasterSection(text: string) {
  const source = String(text || "");
  const start = source.search(/(?:^|\n)#{0,3}\s*4\.\s*VO MASTER\b/i);
  if (start < 0) return "";
  const rest = source.slice(start);
  const next = rest.search(/\n#{0,3}\s*5\.\s*Teaseri/i);
  return next > 0 ? rest.slice(0, next) : rest;
}

function extractVoiceoverMasterText(text: string) {
  const section = extractVoiceoverMasterSection(text);
  if (!section) return "";
  return section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .map((cells) => cells[3] || "")
    .filter(
      (cell) =>
        cell &&
        !/GALA VO TEKSTS/i.test(cell) &&
        !/^:?-{3,}:?$/.test(cell.replace(/\s/g, "")),
    )
    .join("\n")
    .trim();
}

function lepersPackageQualityMetrics(text: string) {
  const missingSections = LEPERS_REQUIRED_SECTIONS.filter((heading) => !String(text || "").includes(heading));
  const section = extractVoiceoverMasterSection(text);
  const tableHeaderPasses = /\|\s*Laiks\s*\|\s*Funkcija\s*\|\s*GALA VO TEKSTS\s*\|\s*Izpildījums \/ montāža\s*\|/i.test(section);
  const spoken = extractVoiceoverMasterText(text);
  const cueCount = section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|\s*\d{1,2}:\d{2}(?::\d{2})?\s*\|/.test(line)).length;
  return {
    cueCount,
    nonCueLines: 0,
    oversizedCues: 0,
    maxCueWords: 0,
    missingSections,
    tableHeaderPasses,
    formatPasses: missingSections.length === 0 && tableHeaderPasses && cueCount >= 4 && spoken.length > 0,
  };
}

function qualityMetricsForOutput(text: string, tone: string) {
  return isLepersTone(tone) ? lepersPackageQualityMetrics(text) : voiceoverQualityMetrics(text);
}

function ratioMetricsForOutput(text: string, finalRuntimeSeconds: number, tone: string) {
  return isLepersTone(tone)
    ? ratioMetrics(extractVoiceoverMasterText(text), finalRuntimeSeconds)
    : ratioMetrics(text, finalRuntimeSeconds);
}

function referenceContentBlock(body: VoiceoverInput) {
  const contents = body.referenceContents || {};
  const applied = new Set(Array.isArray(body.appliedSources) ? body.appliedSources : []);
  let remaining = 140_000;
  const blocks: string[] = [];
  for (const [name, raw] of Object.entries(contents)) {
    if (!applied.has(name) || !String(raw || "").trim() || remaining <= 0) continue;
    const clean = String(raw).trim();
    const excerpt = clean.slice(0, Math.min(60_000, remaining));
    remaining -= excerpt.length;
    blocks.push(`REFERENCE: ${name}\n${excerpt}`);
  }
  return blocks.length ? blocks.join("\n\n---\n\n") : "No extracted reference document text was supplied in this run.";
}
'''
if helper_anchor not in route:
    raise SystemExit("Could not locate wordTargets helper")
route = route.replace(helper_anchor, helper_anchor + helpers, 1)

prompts_pattern = re.compile(r'function prompts\(body: VoiceoverInput, finalRuntimeSeconds: number\) \{[\s\S]*?\n\}\n\nfunction metadataFor', re.M)
prompts_replacement = r'''function prompts(body: VoiceoverInput, finalRuntimeSeconds: number) {
  const selectedTone = String(body.tone || DEFAULT_TONE);
  const toneProfile = toneProfileFor(selectedTone);
  const { targetWords, lowerWords, upperWords } = wordTargets(finalRuntimeSeconds);
  const references = referenceContentBlock(body);
  if (isLepersTone(selectedTone)) {
    const system = `You are DANA AI, a senior Latvian executive television producer, story editor and voice-over writer for Gandrīz ideālas vakariņas. The Rihards Lepers production-analysis reference is the canonical editorial benchmark for this mode. Write fluent, natural, production-ready Latvian. Never invent facts and never transfer factual details from a reference episode into the current episode.\n\nSELECTED TONE: ${selectedTone}\n${toneProfile}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;
    const user = `Create the COMPLETE Lepers Standard production package for the CURRENT transcript, not merely a voice-over list. Follow the canonical section order and tables exactly. Match the Rihards Lepers reference in depth, rhythm, character insight, intelligent humour, decisive edit recommendations, VO delivery notes, teasers, risk control and final producer judgement.\n\nVOICE-OVER AMOUNT CONTROL: final runtime ${Math.round(finalRuntimeSeconds)} seconds; target approximately ${targetWords} spoken VO words; preferred band ${lowerWords}-${upperWords}. Count ONLY the GALA VO TEKSTS column in section 4. Never count analysis, production notes, promos or other sections. Never exceed ${upperWords}; never pad with obvious action, biography or dialogue paraphrase simply to reach the target.\n\nEditorial request: ${body.prompt || "Use the Rihards Lepers production standard as the benchmark for this scene."}\n\nAPPLIED REFERENCE MANIFEST:\n${body.context || "No reference manifest supplied."}\n\nAPPLIED REFERENCE CONTENT:\n${references}\n\nCURRENT SOURCE TRANSCRIPT — THIS IS THE FACTUAL SOURCE OF TRUTH:\n${body.transcript}`;
    return { selectedTone, system, user, targetWords, lowerWords, upperWords };
  }

  const system = `You are DANA AI, a senior Latvian television story editor and voice-over writer for Gandrīz ideālas vakariņas. Write fluent, natural, broadcast-ready Latvian. Your task is SELECTIVE NARRATION, not transcript summarisation. Every line must add editorial value that the viewer cannot already get directly from picture or dialogue. Never invent facts. Never imitate wording from references. Protect participant dignity.\n\nSELECTED TONE: ${selectedTone}\n${toneProfile}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;
  const user = `Create the final Latvian TV voice-over for this scene.\n\nEDITORIAL METHOD — FOLLOW IN THIS ORDER:\n1. Read the transcript only as source evidence. Do not recap the scene.\n2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation.\n3. Do not list participant biographies, paraphrase audible dialogue, explain obvious actions, or narrate information the audience already understands.\n4. Leave silence where narration adds nothing. The narrator is selective, not continuous.\n5. Format EVERY intervention on one line exactly as: [HH:MM:SS] VO: <one or two broadcast-ready sentences>. No headings, no prose paragraphs, no commentary outside VO cues.\n6. Keep each cue concise — normally 8-45 spoken words and never more than 55.\n7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.\n\nVOICE-OVER AMOUNT STANDARD:\nFinal runtime: ${Math.round(finalRuntimeSeconds)} seconds.\nTarget ≈ ${targetWords} spoken words. Preferred standard band: ${lowerWords}-${upperWords} words (16.17%-17.17% of runtime at 130 Latvian words/minute). Aim to fit this standard by choosing enough legitimate editorial beats. Never exceed ${upperWords} spoken words. If the source does not contain enough legitimate beats, return a shorter selective script rather than padding with recap, biography, dialogue paraphrase or obvious action.\n\nEditorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}\n\nApplied reference calibration: ${RATIO_REFERENCE_SOURCES.join(", ")}.\nApplied production context:\n${body.context || "No reference manifest supplied."}\n\nAPPLIED REFERENCE CONTENT:\n${references}\n\nSOURCE TRANSCRIPT:\n${body.transcript}`;
  return { selectedTone, system, user, targetWords, lowerWords, upperWords };
}

function metadataFor'''
route, count = prompts_pattern.subn(prompts_replacement, route, count=1)
if count != 1:
    raise SystemExit(f"Could not replace prompts: {count}")

route = route.replace("      max_output_tokens: 12_000,", "      max_output_tokens: 24_000,", 1)

validation_pattern = re.compile(
    r'    const appliedSources = Array\.isArray\(body\.appliedSources\) \? body\.appliedSources : \[\];\n    if \(appliedSources\.length < REQUIRED_REFERENCE_COUNT\) \{[\s\S]*?\n    \}\n',
    re.M,
)
validation_replacement = '''    const appliedSources = Array.isArray(body.appliedSources) ? body.appliedSources : [];
    if (!appliedSources.includes("DANA AI Master Production System")) {
      return NextResponse.json(
        { ok: false, message: "The DANA AI Master Production System must remain applied as the governing editorial source.", requestId },
        { status: 400 },
      );
    }
'''
route, count = validation_pattern.subn(validation_replacement, route, count=1)
if count != 1:
    raise SystemExit(f"Could not replace required source validation: {count}")

# Legacy/synchronous metrics follow selected tone.
route = route.replace(
    '      const metrics = ratioMetrics(text, finalRuntimeSeconds);\n      const quality = voiceoverQualityMetrics(text);',
    '      const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, selectedTone);\n      const quality = qualityMetricsForOutput(text, selectedTone);',
    1,
)

# Background completion: tone must be known before metrics.
old_get_metrics = '''    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);
    const metrics = ratioMetrics(text, finalRuntimeSeconds);
    const quality = voiceoverQualityMetrics(text);
    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);
    const phase = metadata.dana_phase || "initial";
    const correctionTone = metadata.dana_tone || DEFAULT_TONE;
    const correctionToneProfile = toneProfileFor(correctionTone);'''
new_get_metrics = '''    const finalRuntimeSeconds = Number(metadata.dana_runtime_seconds || 0);
    const correctionAttempt = Number(metadata.dana_correction_attempt || 0);
    const phase = metadata.dana_phase || "initial";
    const correctionTone = metadata.dana_tone || DEFAULT_TONE;
    const correctionToneProfile = toneProfileFor(correctionTone);
    const metrics = ratioMetricsForOutput(text, finalRuntimeSeconds, correctionTone);
    const quality = qualityMetricsForOutput(text, correctionTone);'''
if old_get_metrics not in route:
    raise SystemExit("Could not locate GET metric block")
route = route.replace(old_get_metrics, new_get_metrics, 1)

old_correction = '''      const correctionSystem = `You are DANA AI's final Latvian television voice-over editor. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} The selected tone must remain clearly recognisable after revision.`;
      const correctionUser = `Rewrite the complete draft as genuine TV voice-over. ${ratioInstruction}\\nEvery output line must use exactly: [HH:MM:SS] VO: <one or two concise sentences>. Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio. Do not include headings or explanatory prose. Keep each cue under 55 spoken words.\\n\\nCURRENT DRAFT (${metrics.words} spoken words; ${quality.cueCount} valid VO cues):\\n${text}`;'''
new_correction = '''      const lepersCorrection = isLepersTone(correctionTone);
      const correctionSystem = lepersCorrection
        ? `You are DANA AI's final Latvian executive story editor. Preserve the COMPLETE Lepers Standard production package, its exact nine-part architecture, verified facts, decisive edit logic, warm lightly ironic mood and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`
        : `You are DANA AI's final Latvian television voice-over editor. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} The selected tone must remain clearly recognisable after revision.`;
      const correctionUser = lepersCorrection
        ? `Revise the COMPLETE production package without deleting or renaming any required section. ${ratioInstruction} The narration ratio counts ONLY words in the GALA VO TEKSTS column of section 4. Keep the Laiks / Funkcija / GALA VO TEKSTS / Izpildījums / montāža table. Improve or trim only legitimate narrator beats; never pad with transcript recap. Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth.\\n\\nCURRENT PACKAGE (${metrics.words} spoken VO words; ${quality.cueCount} VO rows):\\n${text}`
        : `Rewrite the complete draft as genuine TV voice-over. ${ratioInstruction}\\nEvery output line must use exactly: [HH:MM:SS] VO: <one or two concise sentences>. Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio. Do not include headings or explanatory prose. Keep each cue under 55 spoken words.\\n\\nCURRENT DRAFT (${metrics.words} spoken words; ${quality.cueCount} valid VO cues):\\n${text}`;'''
if old_correction not in route:
    raise SystemExit("Could not locate correction prompt block")
route = route.replace(old_correction, new_correction, 1)

route = route.replace(
    'message: `DANA AI rejected the generated text because it still resembled transcript/summary prose instead of selective TV voice-over. Reference: ${requestId}`,',
    'message: `DANA AI rejected the generated output because it did not satisfy the selected editorial format contract. Reference: ${requestId}`,',
    1,
)

PAGE.write_text(page)
ROUTE.write_text(route)
print("Applied DANA Lepers production mode and real reference ingestion wiring")
