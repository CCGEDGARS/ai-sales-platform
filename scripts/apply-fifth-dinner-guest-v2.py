from pathlib import Path
import re

ROUTE = Path("app/api/generate-voiceover/route.ts")
LEPERS = Path("app/lib/lepers-standard.ts")

route = ROUTE.read_text()
lepers = LEPERS.read_text()

new_rules = r'''const FIFTH_DINER_EDITORIAL_RULES = `
PIEKTĀ VAKARIŅOTĀJA PRINCIPS — MANDATORY CHANNEL RULE
- The narrator is the invisible fifth dinner guest: present throughout the story, with a point of view and a recognisable editorial personality.
- The narrator adds a second layer of entertainment and interpretation by articulating what the viewer is likely thinking, but with wit, intelligence and restraint.
- The narrator uses internal dialogue when useful: react mentally to claims, promises, awkward pauses and reversals instead of merely explaining them.
- Actively hunt for details the participants miss or do not verbalise: facial expressions, silence, glances, hesitation, strange objects, timing mistakes, forgotten ingredients, inconsistencies, accidental double meanings, background reactions and confident claims followed by reality.
- The narrator may tease, gently pull someone's leg, sharpen a contradiction, provoke with a question or say the socially obvious thing the room leaves unsaid.
- Register memorable claims, predictions and boasts and look for 2–4 running jokes or callbacks per episode when the source supports them. Set up a promise now and pay it off later.
- The narrator may articulate hidden emotional dynamics such as nerves, pride, scepticism, relief or social politeness hiding disagreement, but uncertain interpretation must be framed as interpretation rather than fact.
- The narrator is not merely an observer and must not collapse into empty reactions such as “hmm…”, “jā…”, “traki…”, “nu gan…” or similar filler.
- Every VO cue must contain an editorial proposition: opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, emotional punctuation or a non-obvious detail.
- Do not manufacture jokes continuously. Humour should come from truth + observation + timing; prefer specific observation → slight exaggeration → punchline/reaction.
- Humour targets the situation, contradiction, timing, absurdity or behaviour, never a person's dignity. No brutal insults, humiliation or contempt.
- Protect strong natural dialogue, laughter, emotional silence and reaction shots. Sometimes the best fifth-diner move is a setup followed by silence.
- GOLDEN TEST 1: If deleting a VO line loses nothing entertaining, emotional, revealing or narratively useful, delete it.
- GOLDEN TEST 2: If a generic documentary narrator could have said the line, rewrite it. Generic descriptive VO is not acceptable Fifth Dinner Guest narration.
- The selected tone changes HOW this fifth diner speaks; it never removes the fifth diner's active point of view or added-value function.
`.trim();'''

route, count = re.subn(
    r'const FIFTH_DINER_EDITORIAL_RULES = `.*?`\.trim\(\);',
    new_rules,
    route,
    count=1,
    flags=re.S,
)
assert count == 1, f"Expected to replace fifth-diner rules once, replaced {count}"

observer_anchor = '''function isLowValueObserverCue(text: string) {
  const normalized = String(text || "")
    .replace(/^\\s*\\[\\d{1,2}:\\d{2}:\\d{2}\\]\\s+VO:\\s*/i, "")
    .toLocaleLowerCase("lv-LV")
    .replace(/[.…!?;,:'"“”‘’()\\-–—]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
  if (!normalized) return true;
  const emptyObserverReactions = new Set([
    "hmm",
    "hm",
    "jā",
    "nu jā",
    "traki",
    "nu gan",
    "oho",
    "ak vai",
    "interesanti",
    "nu ko",
  ]);
  return emptyObserverReactions.has(normalized);
}
'''
assert observer_anchor in route, "Could not find isLowValueObserverCue anchor"

generic_detector = observer_anchor + r'''
function isGenericDescriptiveCue(text: string) {
  const normalized = String(text || "")
    .replace(/^\s*\[\d{1,2}:\d{2}:\d{2}\]\s+VO:\s*/i, "")
    .toLocaleLowerCase("lv-LV")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;

  const hasEditorialSignal =
    /\b(bet|tomēr|toties|tikai|šķiet|izskatās|laikam|acīmredzot|protams|ironiski|par laimi|par nelaimi|atcerēsimies|jautājums|vai tiešām|cik ilgi|interesanti,|teorētiski|praktiski|tikmēr|pagaidām)\b/i.test(normalized) ||
    /[?!]/.test(normalized);
  if (hasEditorialSignal) return false;

  const genericActionLead = /^(?:tagad\s+)?(?:saimnieks|saimniece|rihards|viņš|viņa|viesi|dalībnieki)\s+(?:turpina|gatavo|liek|dodas|ierodas|sāk|pasniedz|ņem|atgriežas|gaida|klāj|ēd|runā|stāsta|izvēlas)\b/i;
  const genericSceneLead = /^(?:tagad|tikmēr)\s+(?:notiek|sākas|turpinās|redzam|seko)\b/i;
  return genericActionLead.test(normalized) || genericSceneLead.test(normalized);
}
'''
route = route.replace(observer_anchor, generic_detector, 1)

old_voice_metrics = '''  const lowValueObserverCues = cueLines.filter((line) => isLowValueObserverCue(line)).length;
  const fifthDinerPasses = cueCount > 0 && lowValueObserverCues === 0;
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
    fifthDinerPasses,
    maxCueWords: cueWordCounts.length ? Math.max(...cueWordCounts) : 0,
    formatPasses,
  };'''
new_voice_metrics = '''  const lowValueObserverCues = cueLines.filter((line) => isLowValueObserverCue(line)).length;
  const genericDescriptiveCues = cueLines.filter((line) => isGenericDescriptiveCue(line)).length;
  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
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
assert old_voice_metrics in route, "Could not find voiceoverQualityMetrics block"
route = route.replace(old_voice_metrics, new_voice_metrics, 1)

old_lepers_metrics = '''  const lowValueObserverCues = masterCueTexts.filter((cue) => isLowValueObserverCue(cue)).length;
  const fifthDinerPasses = cueCount > 0 && lowValueObserverCues === 0;
  return {
    cueCount,
    nonCueLines: 0,
    oversizedCues: 0,
    lowValueObserverCues,
    fifthDinerPasses,
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
new_lepers_metrics = '''  const lowValueObserverCues = masterCueTexts.filter((cue) => isLowValueObserverCue(cue)).length;
  const genericDescriptiveCues = masterCueTexts.filter((cue) => isGenericDescriptiveCue(cue)).length;
  const editorialValuePasses = cueCount > 0 && lowValueObserverCues === 0 && genericDescriptiveCues === 0;
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
assert old_lepers_metrics in route, "Could not find lepersPackageQualityMetrics block"
route = route.replace(old_lepers_metrics, new_lepers_metrics, 1)

route = route.replace(
    '''2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback or comic escalation.''',
    '''2. Select only moments where a narrator intervention adds contrast, contradiction, reaction, awkwardness, anticipation, callback, comic escalation, internal dialogue or a detail the participants miss.''',
    1,
)
route = route.replace(
    '''8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”.''',
    '''8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Hunt for details the participants miss, use internal dialogue when natural, and preserve opportunities for running jokes or callbacks. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”. If a generic documentary narrator could say the line, rewrite it.''',
    1,
)

old_lepers_correction = '''Improve or trim only legitimate narrator beats; every GALA VO TEKSTS row must contain opinion, interpretation, contrast, anticipation, callback, comic framing or a viewer-perspective thought. Remove “hmm”, “jā”, “traki”, “nu gan” and similar empty observer reactions. Never pad with transcript recap.'''
new_lepers_correction = '''Improve or trim only legitimate narrator beats; every GALA VO TEKSTS row must contain opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, internal dialogue or a non-obvious detail. Replace generic descriptive VO with opinionated Fifth Dinner Guest narration. Hunt for details the participants miss and exploit running jokes/callbacks when supported. Remove “hmm”, “jā”, “traki”, “nu gan” and similar empty observer reactions. Never pad with transcript recap.'''
assert old_lepers_correction in route, "Could not find Lepers correction instruction"
route = route.replace(old_lepers_correction, new_lepers_correction, 1)

old_plain_correction = '''Every cue must contain opinion, interpretation, contrast, anticipation, callback, comic framing or a viewer-perspective thought; remove empty “hmm”, “jā”, “traki”, “nu gan” reactions. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio.'''
new_plain_correction = '''Every cue must contain opinion, interpretation, contrast, anticipation, callback, comic framing, viewer-perspective thought, internal dialogue or a non-obvious detail. Rewrite generic descriptive VO as active Fifth Dinner Guest narration; hunt for details the participants miss and exploit callbacks when the source supports them. Remove empty “hmm”, “jā”, “traki”, “nu gan” reactions. Never add recap, biography, dialogue paraphrase or obvious action merely to reach the ratio.'''
assert old_plain_correction in route, "Could not find plain correction instruction"
route = route.replace(old_plain_correction, new_plain_correction, 1)

old_dna = '''- Katram VO jānes redakcionāls apgalvojums: viedoklis, interpretācija, kontrasts, priekšnojauta, callback, komiskais rāmis vai skatītāja perspektīvas doma.
- Narrator attitude: warm, knowing, lightly ironic, intelligent and character-led; a smile in the voice rather than mockery.'''
new_dna = '''- Katram VO jānes redakcionāls apgalvojums: viedoklis, interpretācija, kontrasts, priekšnojauta, callback, komiskais rāmis, skatītāja perspektīvas doma, iekšējais dialogs vai neacīmredzama detaļa.
- VO aktīvi meklē detaļas, ko dalībnieki nepamana vai nepasaka: skatienus, klusumu, vilcināšanos, dīvainus priekšmetus, laika kļūdas, aizmirstas sastāvdaļas, pretrunas, dubultnozīmes, fona reakcijas un pārliecinošus solījumus, kuriem realitāte vēlāk iebilst.
- Ja avots to atbalsta, epizodē identificēt 2–4 running gag / callback iespējas un atgriezties pie iepriekšējiem solījumiem, prognozēm vai lielīgiem apgalvojumiem.
- Iekšējais dialogs ir atļauts un vēlams, ja tas dod skatītājam dzīvu līdzdomāšanas sajūtu, nevis atkārto redzamo.
- Zelta tests: ja generic documentary narrator varētu pateikt šo pašu frāzi, tā jāpārraksta. Ja frāzes izņemšana neko neatņem izklaidei, emocijai, raksturam vai dramaturģijai, tā jādzēš.
- Narrator attitude: warm, knowing, lightly ironic, intelligent and character-led; a smile in the voice rather than mockery.'''
assert old_dna in lepers, "Could not find Lepers editorial DNA anchor"
lepers = lepers.replace(old_dna, new_dna, 1)

ROUTE.write_text(route)
LEPERS.write_text(lepers)
print("Applied Fifth Dinner Guest v2 editorial enforcement.")
