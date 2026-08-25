from pathlib import Path

ROUTE = Path("app/api/generate-voiceover/route.ts")
LEPERS = Path("app/lib/lepers-standard.ts")

route = ROUTE.read_text()
lepers = LEPERS.read_text()

# 1) Global fifth-diner editorial rule: every tone changes the manner, never the narrator's active POV.
anchor = '''const RATIO_REFERENCE_SOURCES = [\n  "Come Dine With Me.mp4",\n  "Ainārs Ašaks · 15.12.2011",\n  "Ieva Janiševa · Season 3",\n];\n'''
addition = '''const RATIO_REFERENCE_SOURCES = [\n  "Come Dine With Me.mp4",\n  "Ainārs Ašaks · 15.12.2011",\n  "Ieva Janiševa · Season 3",\n];\n\nconst FIFTH_DINER_EDITORIAL_RULES = `\nPIEKTĀ VAKARIŅOTĀJA PRINCIPS — MANDATORY CHANNEL RULE\n- The narrator is the piektā vakariņotāja: present in the content, with a point of view and a recognisable editorial personality.\n- The narrator adds a second layer by articulating what the viewer is likely thinking when watching the scene, but with wit, intelligence and restraint.\n- The narrator may tease, gently pull someone\'s leg, sharpen a contradiction or say the socially obvious thing the room leaves unsaid.\n- The narrator is not merely an observer and must not collapse into empty reactions such as “hmm…”, “jā…”, “traki…”, “nu gan…” or similar filler.\n- Every VO cue must contain an editorial proposition: opinion, interpretation, contrast, anticipation, callback, comic framing or a viewer-perspective thought.\n- Humour targets the situation, contradiction or behaviour, never a person\'s dignity. No brutal insults, humiliation or contempt.\n- The selected tone changes HOW this fifth diner speaks; it never removes the fifth diner\'s active point of view or added-value function.\n`.trim();\n'''
if "const FIFTH_DINER_EDITORIAL_RULES" not in route:
    if anchor not in route:
        raise SystemExit("Could not find ratio source anchor")
    route = route.replace(anchor, addition, 1)

# 2) Quality gate: empty observer reactions cannot pass even if formatting/ratio pass.
quality_anchor = '''function voiceoverQualityMetrics(text: string) {\n'''
quality_helper = '''function isLowValueObserverCue(text: string) {\n  const normalized = String(text || "")\n    .replace(/^\\s*\\[\\d{1,2}:\\d{2}:\\d{2}\\]\\s+VO:\\s*/i, "")\n    .toLocaleLowerCase("lv-LV")\n    .replace(/[.…!?;,:'"“”‘’()\\-–—]+/g, " ")\n    .replace(/\\s+/g, " ")\n    .trim();\n  if (!normalized) return true;\n  const emptyObserverReactions = new Set([\n    "hmm",\n    "hm",\n    "jā",\n    "nu jā",\n    "traki",\n    "nu gan",\n    "oho",\n    "ak vai",\n    "interesanti",\n    "nu ko",\n  ]);\n  return emptyObserverReactions.has(normalized);\n}\n\nfunction voiceoverQualityMetrics(text: string) {\n'''
if "function isLowValueObserverCue" not in route:
    if quality_anchor not in route:
        raise SystemExit("Could not find voiceover quality function")
    route = route.replace(quality_anchor, quality_helper, 1)

old_quality = '''  const oversizedCues = cueWordCounts.filter((count) => count > 55).length;\n  const cueCount = cueLines.length;\n  const formatPasses = cueCount > 0 && nonCueLines.length === 0 && oversizedCues === 0;\n  return {\n    cueCount,\n    nonCueLines: nonCueLines.length,\n    oversizedCues,\n    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,\n    formatPasses,\n  };\n}'''
new_quality = '''  const oversizedCues = cueWordCounts.filter((count) => count > 55).length;\n  const cueCount = cueLines.length;\n  const lowValueObserverCues = cueLines.filter((line) => isLowValueObserverCue(line)).length;\n  const fifthDinerPasses = cueCount > 0 && lowValueObserverCues === 0;\n  const formatPasses =\n    cueCount > 0 &&\n    nonCueLines.length === 0 &&\n    oversizedCues === 0 &&\n    fifthDinerPasses;\n  return {\n    cueCount,\n    nonCueLines: nonCueLines.length,\n    oversizedCues,\n    lowValueObserverCues,\n    fifthDinerPasses,\n    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,\n    formatPasses,\n  };\n}'''
if "lowValueObserverCues = cueLines.filter" not in route:
    if old_quality not in route:
        raise SystemExit("Could not patch standard voiceover quality metrics")
    route = route.replace(old_quality, new_quality, 1)

old_lepers_quality = '''  const spoken = extractVoiceoverMasterText(text);\n  const cueCount = section\n    .split(/\\r?\\n/)\n    .filter((line) => /^\\s*\\|\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*\\|/.test(line)).length;\n  return {\n    cueCount,\n    nonCueLines: 0,\n    oversizedCues: 0,\n    maxCueWords: 0,\n    missingSections,\n    tableHeaderPasses,\n    formatPasses: missingSections.length === 0 && tableHeaderPasses && cueCount >= 4 && spoken.length > 0,\n  };'''
new_lepers_quality = '''  const spoken = extractVoiceoverMasterText(text);\n  const masterCueTexts = spoken\n    .split(/\\r?\\n/)\n    .map((line) => line.trim())\n    .filter(Boolean);\n  const cueCount = section\n    .split(/\\r?\\n/)\n    .filter((line) => /^\\s*\\|\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*\\|/.test(line)).length;\n  const lowValueObserverCues = masterCueTexts.filter((cue) => isLowValueObserverCue(cue)).length;\n  const fifthDinerPasses = cueCount > 0 && lowValueObserverCues === 0;\n  return {\n    cueCount,\n    nonCueLines: 0,\n    oversizedCues: 0,\n    lowValueObserverCues,\n    fifthDinerPasses,\n    maxCueWords: 0,\n    missingSections,\n    tableHeaderPasses,\n    formatPasses:\n      missingSections.length === 0 &&\n      tableHeaderPasses &&\n      cueCount >= 4 &&\n      spoken.length > 0 &&\n      fifthDinerPasses,\n  };'''
if "masterCueTexts = spoken" not in route:
    if old_lepers_quality not in route:
        raise SystemExit("Could not patch Lepers quality metrics")
    route = route.replace(old_lepers_quality, new_lepers_quality, 1)

# 3) Generation prompts: apply the fifth-diner rule to Lepers and every other tone.
old_lepers_system = '''SELECTED TONE: ${selectedTone}\n${toneProfile}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
new_lepers_system = '''SELECTED TONE: ${selectedTone}\n${toneProfile}\n\n${FIFTH_DINER_EDITORIAL_RULES}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
if "${FIFTH_DINER_EDITORIAL_RULES}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}" not in route:
    if old_lepers_system not in route:
        raise SystemExit("Could not patch Lepers system prompt")
    route = route.replace(old_lepers_system, new_lepers_system, 1)

old_standard_system = '''SELECTED TONE: ${selectedTone}\n${toneProfile}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;'''
new_standard_system = '''SELECTED TONE: ${selectedTone}\n${toneProfile}\n\n${FIFTH_DINER_EDITORIAL_RULES}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;'''
if "${FIFTH_DINER_EDITORIAL_RULES}\nThe selected tone is mandatory" not in route:
    if old_standard_system not in route:
        raise SystemExit("Could not patch standard system prompt")
    route = route.replace(old_standard_system, new_standard_system, 1)

method_line = '''7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.\n'''
method_replacement = '''7. Match the SELECTED TONE exactly. Tone changes in the UI must produce a recognisably different editorial voice without changing verified facts.\n8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”.\n'''
if "8. Act as the fifth dinner guest" not in route:
    if method_line not in route:
        raise SystemExit("Could not patch editorial method")
    route = route.replace(method_line, method_replacement, 1)

# 4) Correction pass explicitly preserves active fifth-diner POV and fixes filler output.
old_correction_system_lepers = '''? `You are DANA AI's final Latvian executive story editor. Preserve the COMPLETE Lepers Standard production package, its exact nine-part architecture, verified facts, decisive edit logic, warm lightly ironic mood and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'''
new_correction_system_lepers = '''? `You are DANA AI's final Latvian executive story editor and fifth diner. Preserve the COMPLETE Lepers Standard production package, its exact nine-part architecture, verified facts, decisive edit logic, warm lightly ironic mood and participant dignity. Every VO cue must retain active fifth-diner opinion and added value; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`'''
if "final Latvian executive story editor and fifth diner" not in route:
    if old_correction_system_lepers not in route:
        raise SystemExit("Could not patch Lepers correction system")
    route = route.replace(old_correction_system_lepers, new_correction_system_lepers, 1)

old_correction_system_standard = ''': `You are DANA AI's final Latvian television voice-over editor. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} The selected tone must remain clearly recognisable after revision.`;'''
new_correction_system_standard = ''': `You are DANA AI's final Latvian television voice-over editor and fifth diner. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. Every cue must express an active point of view or added editorial layer; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} The selected tone must remain clearly recognisable after revision.`;'''
if "final Latvian television voice-over editor and fifth diner" not in route:
    if old_correction_system_standard not in route:
        raise SystemExit("Could not patch standard correction system")
    route = route.replace(old_correction_system_standard, new_correction_system_standard, 1)

old_lepers_correction_user = '''Improve or trim only legitimate narrator beats; never pad with transcript recap. Preserve the analysis'''
new_lepers_correction_user = '''Improve or trim only legitimate narrator beats; every GALA VO TEKSTS row must contain opinion, interpretation, contrast, anticipation, callback, comic framing or a viewer-perspective thought. Remove “hmm”, “jā”, “traki”, “nu gan” and similar empty observer reactions. Never pad with transcript recap. Preserve the analysis'''
if "every GALA VO TEKSTS row must contain opinion" not in route:
    if old_lepers_correction_user not in route:
        raise SystemExit("Could not patch Lepers correction user")
    route = route.replace(old_lepers_correction_user, new_lepers_correction_user, 1)

old_standard_correction_user = '''Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio.'''
new_standard_correction_user = '''Use only narrator interventions justified by contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation. Every cue must contain opinion, interpretation, contrast, anticipation, callback, comic framing or a viewer-perspective thought; remove empty “hmm”, “jā”, “traki”, “nu gan” reactions. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio.'''
if "Every cue must contain opinion, interpretation" not in route:
    if old_standard_correction_user not in route:
        raise SystemExit("Could not patch standard correction user")
    route = route.replace(old_standard_correction_user, new_standard_correction_user, 1)

# 5) Lepers canonical contract: encode the channel feedback as immutable editorial DNA.
lepers_anchor = '''EDITORIAL DNA\n- Narrator attitude: warm, knowing, lightly ironic, intelligent and character-led; a smile in the voice rather than mockery.\n'''
lepers_replacement = '''EDITORIAL DNA\n- Piektā vakariņotāja princips ir obligāts: VO ir saturā klātesošs piektais vakariņotājs ar viedokli, nevis tikai novērotājs.\n- Viņš piešķir notiekošajam papildu slāni un ar humoru bieži pasaka to, ko skatītājs, redzot notiekošo, pats nodomā.\n- Viņš drīkst iesmaidīt, pavilkt uz zoba, nosaukt pretrunu vai sociāli neērto patiesību, bet ne brutāli aplikt, pazemot vai aizvainot dalībnieku.\n- Tukšas novērotāja reakcijas “hmm…”, “jā…”, “traki…”, “nu gan…” nav pievienotā vērtība un nav pieļaujamas kā patstāvīgs VO.\n- Katram VO jānes redakcionāls apgalvojums: viedoklis, interpretācija, kontrasts, priekšnojauta, callback, komiskais rāmis vai skatītāja perspektīvas doma.\n- Narrator attitude: warm, knowing, lightly ironic, intelligent and character-led; a smile in the voice rather than mockery.\n'''
if "Piektā vakariņotāja princips ir obligāts" not in lepers:
    if lepers_anchor not in lepers:
        raise SystemExit("Could not patch Lepers editorial DNA")
    lepers = lepers.replace(lepers_anchor, lepers_replacement, 1)

vo_master_anchor = '''This table is the ONLY spoken master narration. Each row must be genuinely recordable Latvian VO, placed at a justified timecode. It may perform hooks, character framing, transitions, setup, irony, callbacks, recaps required by format, teasers and verified result bridges. It must not become a transcript summary.\n'''
vo_master_replacement = '''This table is the ONLY spoken master narration. Each row must be genuinely recordable Latvian VO, placed at a justified timecode. It may perform hooks, character framing, transitions, setup, irony, callbacks, recaps required by format, teasers and verified result bridges. It must not become a transcript summary. Every row must also satisfy the fifth-diner rule: it carries a point of view or added editorial layer, rather than a passive reaction.\n'''
if "Every row must also satisfy the fifth-diner rule" not in lepers:
    if vo_master_anchor not in lepers:
        raise SystemExit("Could not patch Lepers VO master rule")
    lepers = lepers.replace(vo_master_anchor, vo_master_replacement, 1)

ROUTE.write_text(route)
LEPERS.write_text(lepers)
print("Applied mandatory fifth-diner voice-over rule and quality gate")
