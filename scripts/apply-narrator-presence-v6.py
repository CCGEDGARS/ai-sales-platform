from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# app/api/generate-voiceover/route.ts
# ---------------------------------------------------------------------------
route_path = "app/api/generate-voiceover/route.ts"
route = read(route_path)

route = replace_once(
    route,
    'import { LEPERS_GOLDEN_MASTER_FINGERPRINT, LEPERS_GOLDEN_MASTER_NAME, LEPERS_GOLDEN_MASTER_THRESHOLD, scoreLepersGoldenMaster } from "../../lib/lepers-golden-master";\n',
    'import { LEPERS_GOLDEN_MASTER_FINGERPRINT, LEPERS_GOLDEN_MASTER_NAME, LEPERS_GOLDEN_MASTER_THRESHOLD, scoreLepersGoldenMaster } from "../../lib/lepers-golden-master";\nimport { narratorPresenceMetrics } from "../../lib/narrator-presence";\n',
    "route narrator-presence import",
)

primary_rules = r'''const PRIMARY_NARRATOR_PRESENCE_RULES = `
PRIMARY VO BEHAVIOUR RULE — ACTIVE FIFTH DINNER GUEST
- This is the highest-priority narrator behaviour rule for Gandrīz ideālas vakariņas. It overrides generic documentary narration and remains active in every tone, rewrite, correction, shortening, fact-check and Golden Master pass.
- The narrator must feel CONVERSATIONALLY PRESENT in the room, not like a polished observer floating above the programme.
- Behave like an invisible fifth participant who reacts in real time: answer participant statements, challenge weak logic, question confidence, warn, agree, disagree, correct, tease, predict and occasionally directly address a participant as though they could hear the narrator.
- Direct participant-facing remarks are encouraged when natural: “Rihard… tiešām?”, “Linda vēl neko nav pateikusi. Seja gan.”, “Uzmanīgi, Horens.” Do not force names into every cue.
- Build an alliance with the viewer. The narrator is the viewer’s intelligent, slightly mischievous inner voice and may say the socially obvious thing the room leaves unsaid.
- Maintain recognisable narrator presence across the OPENING, MIDDLE and CLOSING development whenever legitimate VO opportunities exist. One isolated joke does not satisfy this rule.
- Keep a memory ledger: participant promises, boasts, labels, predictions, contradictions and unusual habits may become callbacks or running jokes later. When the source gives a setup, remember it.
- Character labels and running jokes must grow from participant behaviour and verified material, never from invented traits.
- Prefer conversational rhythm over over-written prose. A short reactive intervention can be stronger than a polished explanatory sentence.
- The narrator may argue with the logic of a statement or situation, but never with a participant’s dignity.
- Presence does NOT mean more VO. Preserve selective narration and the 16.67% format target. Improve distribution, attitude and interaction rather than padding runtime.
- FINAL PRESENCE TEST: across the scene, can the audience recognise one intelligent fifth guest who has been listening, remembering and reacting? If not, rewrite before release.
`.trim();

'''
route = replace_once(
    route,
    "const FIFTH_DINER_EDITORIAL_RULES = `\n",
    primary_rules + "const FIFTH_DINER_EDITORIAL_RULES = `\n",
    "route primary narrator rules",
)

old_quality = '''  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const fifthDinerPasses = editorialValuePasses;
  const requiresEditorialCorrection = !editorialValuePasses;
  const formatPasses =
    cueCount > 0 &&
    nonCueLines.length === 0 &&
    oversizedCues === 0 &&
    editorialValuePasses;
  return {
    cueCount,
    nonCueLines: nonCueLines.length,
    oversizedCues,
    lowValueObserverCues,
    genericDescriptiveCues,
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,
    formatPasses,
  };'''
new_quality = '''  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const narratorPresence = narratorPresenceMetrics(cueLines);
  const fifthDinerPasses = editorialValuePasses && narratorPresence.passes;
  const requiresEditorialCorrection = !fifthDinerPasses;
  const formatPasses =
    cueCount > 0 &&
    nonCueLines.length === 0 &&
    oversizedCues === 0 &&
    fifthDinerPasses;
  return {
    cueCount,
    nonCueLines: nonCueLines.length,
    oversizedCues,
    lowValueObserverCues,
    genericDescriptiveCues,
    narratorPresence, // includes presenceCoverage, conversationalCues and memoryCallbackCues
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,
    formatPasses,
  };'''
route = replace_once(route, old_quality, new_quality, "route selective VO quality gate")

old_lepers_quality = '''  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const fifthDinerPasses = editorialValuePasses;
  const requiresEditorialCorrection = !editorialValuePasses;
  return {
    cueCount,
    nonCueLines: 0,
    oversizedCues: 0,
    lowValueObserverCues,
    genericDescriptiveCues,
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
    maxCueWords: 0,
    missingSections,
    tableHeaderPasses,
    formatPasses:
      missingSections.length === 0 &&
      tableHeaderPasses &&
      cueCount >= 4 &&
      spoken.length > 0 &&
      editorialValuePasses,
  };'''
new_lepers_quality = '''  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
  const narratorPresence = narratorPresenceMetrics(masterCueTexts);
  const fifthDinerPasses = editorialValuePasses && narratorPresence.passes;
  const requiresEditorialCorrection = !fifthDinerPasses;
  return {
    cueCount,
    nonCueLines: 0,
    oversizedCues: 0,
    lowValueObserverCues,
    genericDescriptiveCues,
    narratorPresence, // includes presenceCoverage, conversationalCues and memoryCallbackCues
    editorialValuePasses,
    fifthDinerPasses,
    requiresEditorialCorrection,
    maxCueWords: 0,
    missingSections,
    tableHeaderPasses,
    formatPasses:
      missingSections.length === 0 &&
      tableHeaderPasses &&
      cueCount >= 4 &&
      spoken.length > 0 &&
      fifthDinerPasses,
  };'''
route = replace_once(route, old_lepers_quality, new_lepers_quality, "route Lepers VO quality gate")

# Inject the primary presence doctrine into every generation/correction/recovery system prompt.
needle = "${FIFTH_DINER_EDITORIAL_RULES}"
if route.count(needle) < 4:
    raise RuntimeError(f"route prompt injection: expected several fifth-diner prompt insertions, found {route.count(needle)}")
route = route.replace(needle, "${PRIMARY_NARRATOR_PRESENCE_RULES} ${FIFTH_DINER_EDITORIAL_RULES}")

route = replace_once(
    route,
    '8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Hunt for details the participants miss, use internal dialogue when natural, and preserve opportunities for running jokes or callbacks. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”. If a generic documentary narrator could say the line, rewrite it.',
    '8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. The narrator must be conversationally present across the scene: directly react to participant statements, question or challenge logic when justified, occasionally address participants, and remember earlier claims for callbacks. One isolated joke is not enough. Hunt for details the participants miss, use internal dialogue when natural, and preserve opportunities for running jokes or callbacks. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”. If a generic documentary narrator could say the line, rewrite it.',
    "route generation method narrator presence",
)

route = replace_once(
    route,
    '          message: `DANA AI rejected the generated output because it did not satisfy the selected editorial format contract. Reference: ${requestId}`,' ,
    '          message: `DANA AI rejected the generated output because it did not satisfy the selected editorial format / narrator-presence contract${quality.narratorPresence ? ` (Narrator Presence ${quality.narratorPresence.score}/${quality.narratorPresence.threshold})` : ""}. Reference: ${requestId}`,' ,
    "route final narrator-presence rejection message",
)

write(route_path, route)

# ---------------------------------------------------------------------------
# app/lib/lepers-standard.ts
# ---------------------------------------------------------------------------
standard_path = "app/lib/lepers-standard.ts"
standard = read(standard_path)
standard = replace_once(
    standard,
    "EDITORIAL DNA\n- Piektā vakariņotāja princips ir obligāts:",
    """EDITORIAL DNA
- PRIMARY NARRATOR PRESENCE — OBLIGĀTS: piektais vakariņotājs nav tikai “asprātīgs VO”. Viņš ir sarunā klātesošs tēls visā epizodes attīstībā. Ja materiāls dod iespēju, VO tieši reaģē uz dalībnieka teikto, uzdod jautājumu, apstrīd loģiku, brīdina, piekrīt/nepiekrīt, pavelk uz zoba vai tieši uzrunāt dalībnieku. Viena laba ironiska frāze visā ainā nav pietiekama.
- VO veido aliansi ar skatītāju: tas ir skatītāja inteliģentais iekšējais komentārs, kurš pamana to, ko istabā nepasaka skaļi.
- Klātbūtnei jābūt atpazīstamai sākumā, vidū un noslēguma attīstībā, ja tur ir leģitīmi VO logi. Klātbūtne nenozīmē lielāku VO apjomu; 16.67% princips paliek spēkā.
- VO uztur atmiņu: solījumi, lielīgi apgalvojumi, prognozes, pretrunas, raksturīgi paradumi un agrāki joki ir potenciāli setup/callback materiāli. Ja avots dod setup, vēlāk pārbaudīt, vai realitāte dod payoff.
- Priekšroka sarunvalodīgai, reaktīvai frāzei, ja tā ir stiprāka par nopulētu skaidrojošu teikumu.
- Gala tests: vai skatītājs visā ainā var atpazīt vienu un to pašu inteliģento piekto viesi, kurš klausās, atceras un reaģē? Ja nē, VO jāpārraksta.
- Piektā vakariņotāja princips ir obligāts:""",
    "Lepers standard primary narrator presence doctrine",
)
standard = replace_once(
    standard,
    "Every row must also satisfy the fifth-diner rule: it carries a point of view or added editorial layer, rather than a passive reaction. When relevant, the VO must also advance, challenge or pay off the OTRĀ STĀSTA LĪNIJA.",
    "Every row must also satisfy the fifth-diner rule: it carries a point of view or added editorial layer, rather than a passive reaction. Across the section as a whole, narrator behaviour must pass the separate Narrator Presence gate: conversational reactions, questions, challenges and participant-facing remarks must be distributed through the scene rather than concentrated in one isolated joke, and earlier claims should be remembered/called back when the source supports it. When relevant, the VO must also advance, challenge or pay off the OTRĀ STĀSTA LĪNIJA.",
    "Lepers standard VO master narrator presence gate",
)
write(standard_path, standard)

# ---------------------------------------------------------------------------
# app/lib/lepers-golden-master.ts
# ---------------------------------------------------------------------------
golden_path = "app/lib/lepers-golden-master.ts"
golden = read(golden_path)
golden = replace_once(
    golden,
    'import { LEPERS_REQUIRED_SECTIONS } from "./lepers-standard";\n',
    'import { LEPERS_REQUIRED_SECTIONS } from "./lepers-standard";\nimport { narratorPresenceMetrics, NARRATOR_PRESENCE_THRESHOLD, type NarratorPresenceMetrics } from "./narrator-presence";\n',
    "Golden Master narrator presence import",
)
golden = replace_once(
    golden,
    "  deficiencies: string[];\n};",
    "  narratorPresence: NarratorPresenceMetrics;\n  deficiencies: string[];\n};",
    "Golden Master narrator presence output type",
)
golden = replace_once(
    golden,
    "  const cues = voCells(source);\n  const voWords = words(cues.join(\" \"));",
    "  const cues = voCells(source);\n  const narratorPresence = narratorPresenceMetrics(cues);\n  const voWords = words(cues.join(\" \"));",
    "Golden Master narrator presence metric",
)
golden = replace_once(
    golden,
    '  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");',
    '  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");\n  if (!narratorPresence.passes) deficiencies.push(`Narrator Presence ${narratorPresence.score}/${NARRATOR_PRESENCE_THRESHOLD}: ${narratorPresence.deficiencies.join(" ")}`);',
    "Golden Master narrator presence deficiency",
)
golden = replace_once(
    golden,
    "    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes && creativeFreshness.passes,",
    "    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes && creativeFreshness.passes && narratorPresence.passes,",
    "Golden Master narrator presence release gate",
)
golden = replace_once(
    golden,
    "    creativeFreshness,\n    deficiencies,",
    "    creativeFreshness,\n    narratorPresence,\n    deficiencies,",
    "Golden Master narrator presence return",
)
write(golden_path, golden)

# ---------------------------------------------------------------------------
# app/page.tsx
# ---------------------------------------------------------------------------
page_path = "app/page.tsx"
page = read(page_path)
page = replace_once(
    page,
    "  deficiencies: string[];\n};\ntype TranscriptResult",
    """  narratorPresence?: {
    score: number;
    threshold: number;
    passes: boolean;
    activePovCues: number;
    conversationalCues: number;
    memoryCallbackCues: number;
    presenceCoverage: number;
    deficiencies: string[];
  };
  deficiencies: string[];
};
type TranscriptResult""",
    "page narrator presence metrics type",
)
old_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive: do not submit the first reasonable idea. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE—bold callbacks, visual/editing games, provocations, metaphors and hooks that make the show richer than the raw footage. Fifth Dinner Guest VO must surprise, not reflect. Never invent reality or humiliate participants; keep VO selective near 16.67%.';"
new_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive. The Fifth Dinner Guest must be conversationally present across the scene: directly react to participant statements, question or challenge logic when justified, occasionally address participants, remember earlier claims and build callbacks. One isolated joke is not enough. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE. Never invent reality or humiliate participants; keep VO selective near 16.67%.';"
page = replace_once(page, old_brief, new_brief, "page default Lepers editorial brief")
page = replace_once(
    page,
    'const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-25-wow-creative-room-v5";',
    'const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-31-active-fifth-diner-v6";',
    "page editorial brief schema version",
)
page = replace_once(
    page,
    '{goldenMasterMetrics.creativeFreshness ? ` · WOW Freshness ${goldenMasterMetrics.creativeFreshness.score}/${goldenMasterMetrics.creativeFreshness.threshold}` : ""}',
    '{goldenMasterMetrics.creativeFreshness ? ` · WOW Freshness ${goldenMasterMetrics.creativeFreshness.score}/${goldenMasterMetrics.creativeFreshness.threshold}` : ""}\n                      {goldenMasterMetrics.narratorPresence ? ` · Narrator Presence ${goldenMasterMetrics.narratorPresence.score}/${goldenMasterMetrics.narratorPresence.threshold}` : ""}',
    "page narrator presence score display",
)
page = replace_once(
    page,
    '<small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release.</small>',
    '<small>Golden Master Match: Lepers packages are automatically measured against the locked 10/10 benchmark and revised until they reach at least 95/100 before release. Narrator Presence is a separate mandatory gate and must reach 80/100.</small>',
    "page narrator presence release copy",
)
write(page_path, page)

# ---------------------------------------------------------------------------
# tests/default-editorial-brief.test.mjs
# ---------------------------------------------------------------------------
default_test_path = "tests/default-editorial-brief.test.mjs"
default_test = read(default_test_path)
default_test = regex_once(
    default_test,
    r'const expectedBrief = ".*?";',
    'const expectedBrief = "Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive. The Fifth Dinner Guest must be conversationally present across the scene: directly react to participant statements, question or challenge logic when justified, occasionally address participants, remember earlier claims and build callbacks. One isolated joke is not enough. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE. Never invent reality or humiliate participants; keep VO selective near 16.67%.";',
    "default brief test expected text",
)
default_test = replace_once(
    default_test,
    'assert.match(page, /2026-08-25-wow-creative-room-v5/);',
    'assert.match(page, /2026-08-31-active-fifth-diner-v6/);',
    "default brief test schema version",
)
default_test = replace_once(
    default_test,
    '  assert.match(page, /Fifth Dinner Guest/i);',
    '  assert.match(page, /Fifth Dinner Guest/i);\n  assert.match(page, /conversationally present/i);\n  assert.match(page, /directly react/i);',
    "default brief test narrator presence assertions",
)
write(default_test_path, default_test)

print("Narrator Presence v6 patch applied successfully.")
