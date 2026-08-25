from pathlib import Path

# 1) Generation / correction engine
route_path = Path("app/api/generate-voiceover/route.ts")
route = route_path.read_text()

if "const SECOND_STORY_EDITORIAL_RULES" not in route:
    anchor = '''const TONE_PROFILES: Record<string, string> = {'''
    doctrine = r'''const SECOND_STORY_EDITORIAL_RULES = `
SECOND STORY — MANDATORY EDITORIAL AUTHORSHIP RULE
- DANA is an editorial co-author, not a reflective commentator. Do not merely react to what the participants already said or what the picture already shows.
- For every significant scene, actively ask: “What else could this scene be about?” Then build one additional editorial storyline from verified reality.
- The Second Story may be a tension, game, contradiction or lens such as confidence versus the clock, control versus chaos, politeness versus true reaction, ambition versus reality, friendship versus scoring, or another source-grounded angle unique to the scene.
- DANA may create framing, metaphor, comic premise, hypothesis, prediction, provocative question, juxtaposition, narrative label, setup, escalation, payoff and running motif. This is editorial authorship, not factual invention.
- Ground the Second Story in observable or audible evidence. Use real claims, behaviour, timing, reactions, objects, silences or reversals as anchors, then create original language and an original editorial angle around them.
- Develop the strongest Second Story across setup → escalation → payoff/callback when the source supports it. Remember earlier claims and let later reality test them.
- Reflection-only VO is a failure mode. A line that merely says someone is nervous, surprised, cooking, waiting or losing confidence must be rewritten unless it adds a new authored angle.
- Invent the editorial idea around reality; never invent reality.
- Never invent events, quotations, motives, relationships, private thoughts, off-camera facts or causal claims that the source does not support. Uncertain emotional interpretation must remain clearly framed as interpretation.
- Be courageous, proactive, engaging and provocative while protecting participant dignity. The goal is an additional entertainment line that makes the episode richer than the raw material alone.
`.trim();

'''
    if anchor not in route:
        raise SystemExit("route tone profile anchor not found")
    route = route.replace(anchor, doctrine + anchor, 1)

# Inject doctrine into both generation system prompts.
route = route.replace(
    '${FIFTH_DINER_EDITORIAL_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}',
    '${FIFTH_DINER_EDITORIAL_RULES}\n\n${SECOND_STORY_EDITORIAL_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}',
)

# Explicit Lepers package instruction.
old = 'Create the COMPLETE Lepers Standard production package for the CURRENT transcript, not merely a voice-over list. Follow the canonical section order and tables exactly. Match the Rihards Lepers reference in depth, rhythm, character insight, intelligent humour, decisive edit recommendations, VO delivery notes, teasers, risk control and final producer judgement.'
new = old + '\n\nSECOND STORY REQUIREMENT: before writing, identify what else this scene can be about beyond the literal events. Create one bold additional editorial storyline from verified reality, label it OTRĀ STĀSTA LĪNIJA in section 1, develop it through setup → escalation → payoff/callback in section 2, and let it influence VO, edit choices, teasers and the final producer judgement. Do not merely reflect the existing dialogue or action.'
if old not in route:
    raise SystemExit("Lepers user prompt anchor not found")
route = route.replace(old, new, 1)

# Non-Lepers selective narration also gets proactive authorship.
old_step = '8. Act as the fifth dinner guest, not a neutral observer: every cue must carry a point of view or added editorial layer, often saying with wit what the viewer is likely thinking. Hunt for details the participants miss, use internal dialogue when natural, and preserve opportunities for running jokes or callbacks. Never use empty reaction VO such as “hmm…”, “jā…”, “traki…” or “nu gan…”. If a generic documentary narrator could say the line, rewrite it.'
new_step = old_step + '\n9. CREATE A SECOND STORY: do not stop at reflection. Identify an additional source-grounded angle or game in the scene and author original framing, metaphor, hypothesis, prediction, provocative question or callback around verified facts. Advance that additional line across multiple cues when the material supports it. Invent the editorial idea around reality; never invent reality.'
if old_step not in route:
    raise SystemExit("non-Lepers method anchor not found")
route = route.replace(old_step, new_step, 1)

# Repair map can identify the authorship failure directly.
repair_anchor = '''  if (d.humourAndPov < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.humourAndPov) {
    repairs.push("HUMOUR + POV: strengthen Fifth Dinner Guest opinion, contradiction, internal dialogue, viewer-thought questions and callbacks in legitimate VO beats; remove passive reactions and generic description.");
  }
'''
repair_new = repair_anchor + '''  if (!goldenMaster.secondStory?.passes) {
    repairs.push("SECOND STORY: create and explicitly label OTRĀ STĀSTA LĪNIJA from verified reality, then develop the same authored angle through OTRĀ STĀSTA ATTĪSTĪBA as setup → escalation → payoff/callback. Do not settle for reflection-only commentary; preserve strong existing dimensions while adding the missing editorial storyline.");
  }
'''
if repair_anchor not in route:
    raise SystemExit("repair map anchor not found")
route = route.replace(repair_anchor, repair_new, 1)

# Correction prompts must preserve/develop the Second Story.
route = route.replace(
    '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} GOLDEN MASTER CONFORMANCE:',
    '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} GOLDEN MASTER CONFORMANCE:',
)
route = route.replace(
    '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} The selected tone',
    '${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} The selected tone',
)

old_corr = 'Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth. GOLDEN MASTER CONFORMANCE:'
new_corr = 'Preserve the analysis, dramaturgy, edit decisions, promo, risks, sound notes, checklist and producer recommendation at Rihards Lepers reference depth. Preserve and develop the Second Story across the package: OTRĀ STĀSTA LĪNIJA must be a source-grounded authored premise, and OTRĀ STĀSTA ATTĪSTĪBA must carry it through setup → escalation → payoff/callback. GOLDEN MASTER CONFORMANCE:'
if old_corr not in route:
    raise SystemExit("correction user anchor not found")
route = route.replace(old_corr, new_corr, 1)

# Hard gate: a score alone is not enough if the Second Story is missing.
route = route.replace(
    'Boolean(goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD);',
    'Boolean(goldenMaster && (goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes));',
    1,
)
route = route.replace(
    'if (goldenMaster && goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD) {',
    'if (goldenMaster && (goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes)) {',
    1,
)
route = route.replace(
    'message: `DANA AI rejected the Lepers package because Golden Master conformance remained ${goldenMaster.score}/100 after automatic revision; minimum is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. Reference: ${requestId}`,',
    'message: `DANA AI rejected the Lepers package because ${!goldenMaster.secondStory?.passes ? "the required Second Story editorial line was still missing or underdeveloped" : `Golden Master conformance remained ${goldenMaster.score}/100`}; minimum quality is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. Reference: ${requestId}`,',
    1,
)

route_path.write_text(route)

# 2) Canonical Lepers package contract
standard_path = Path("app/lib/lepers-standard.ts")
standard = standard_path.read_text()

editorial_anchor = '- Piektā vakariņotāja princips ir obligāts: VO ir saturā klātesošs piektais vakariņotājs ar viedokli, nevis tikai novērotājs.\n'
second_story_dna = '''- DANA ir arī redakcionāls līdzautors: ar esošā materiāla atspoguļošanu vien nepietiek. No pārbaudītas realitātes jāizveido papildu OTRĀ STĀSTA LĪNIJA, kas piešķir ainai jaunu spēli, spriedzi vai interpretācijas leņķi.\n- Atļauts radīt oriģinālu framingu, metaforu, komisku premisu, hipotēzi, prognozi, provokatīvu jautājumu, pretstatījumu, naratīva nosaukumu un setup/payoff mehāniku. Aizliegts izgudrot notikumus, citātus, motīvus, attiecības vai faktus, ko avots neapstiprina.\n- Pamatlikums: invent the editorial idea around reality; never invent reality. Otrajam stāstam jābalstās tajā, ko var redzēt vai dzirdēt avotā, bet valodai un redakcionālajam leņķim jābūt DANA oriģinālam.\n- Katra nozīmīga aina jāpārbauda ar jautājumu: “Par ko vēl šī aina varētu būt?” Spēcīgāko atbildi attīstīt kā setup → escalation → payoff/callback, ja materiāls to ļauj.\n- Reflection-only VO nav pietiekams: vienkārša esošās darbības, emocijas vai dialoga interpretācija bez jauna redakcionāla leņķa ir jāpārraksta.\n'''
if second_story_dna.strip() not in standard:
    if editorial_anchor not in standard:
        raise SystemExit("standard editorial DNA anchor not found")
    standard = standard.replace(editorial_anchor, editorial_anchor + second_story_dna, 1)

old_section1 = '# 1. Izpildproducenta lēmums\nStart with a decisive EP verdict and the 2–4 strongest story lines to amplify. Then include: Kas strādā; Kas bremzē; Ieteicamais tempu labojums; VO tonis. Make clear production decisions rather than generic observations.'
new_section1 = '# 1. Izpildproducenta lēmums\nStart with a decisive EP verdict and the 2–4 strongest story lines to amplify. Then include: Kas strādā; Kas bremzē; Ieteicamais tempu labojums; VO tonis. Make clear production decisions rather than generic observations. Then add exactly one bold authored line labelled **OTRĀ STĀSTA LĪNIJA:**. It must name a fresh editorial premise created from verified reality in the CURRENT source, not merely restate the visible action or dialogue. Ground it in at least two observable/audible anchors and state the tension, game or lens it will add to the episode.'
if old_section1 not in standard:
    raise SystemExit("standard section 1 anchor not found")
standard = standard.replace(old_section1, new_section1, 1)

old_section2 = 'Build seven acts when the source contains enough material; if the source is shorter, preserve the same dramatic logic without inventing beats. Then add: Epizodes caurviju motīvs; Raksturu funkcijas montāžā.'
new_section2 = 'Build seven acts when the source contains enough material; if the source is shorter, preserve the same dramatic logic without inventing beats. Then add: Epizodes caurviju motīvs; Raksturu funkcijas montāžā. Then add exactly **OTRĀ STĀSTA ATTĪSTĪBA:** and map how the same Second Story moves through setup → escalation → payoff/callback, naming the verified beats that carry it. If the source cannot support a payoff, state that honestly and use the strongest available progression instead of inventing one.'
if old_section2 not in standard:
    raise SystemExit("standard section 2 anchor not found")
standard = standard.replace(old_section2, new_section2, 1)

old_vo = 'Every row must also satisfy the fifth-diner rule: it carries a point of view or added editorial layer, rather than a passive reaction.'
new_vo = old_vo + ' When relevant, the VO must also advance, challenge or pay off the OTRĀ STĀSTA LĪNIJA. Reflection-only commentary that merely restates an emotion or action is not sufficient.'
if old_vo not in standard:
    raise SystemExit("standard VO anchor not found")
standard = standard.replace(old_vo, new_vo, 1)

standard_path.write_text(standard)

# 3) Golden Master scorer / hard authorship metric
golden_path = Path("app/lib/lepers-golden-master.ts")
golden = golden_path.read_text()

old_type = '''export type LepersGoldenMasterScore = {
  name: string;
  score: number;
  threshold: number;
  passes: boolean;
  dimensions: GoldenMasterDimensions;
  deficiencies: string[];
};'''
new_type = '''export type LepersGoldenMasterScore = {
  name: string;
  score: number;
  threshold: number;
  passes: boolean;
  dimensions: GoldenMasterDimensions;
  secondStory: {
    present: boolean;
    developed: boolean;
    signals: number;
    passes: boolean;
  };
  deficiencies: string[];
};'''
if old_type not in golden:
    raise SystemExit("golden type anchor not found")
golden = golden.replace(old_type, new_type, 1)

helper_anchor = '''function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
'''
helper = r'''

function secondStoryMetrics(source: string) {
  const premise = source.match(/OTRĀ STĀSTA LĪNIJA\s*[:—-]\**\s*([^\n]{35,})/i);
  const development = source.match(/OTRĀ STĀSTA ATTĪSTĪBA\s*[:—-]\**\s*([^\n]{35,})/i);
  const authoredText = `${premise?.[1] || ""} ${development?.[1] || ""} ${voCells(source).join(" ")}`.toLocaleLowerCase("lv-LV");
  const signals = (authoredText.match(/\b(atcerēsimies|atgriežamies|solīj|prognoz|hipotēz|jautājum|pulksten|spēl|pretstat|metafor|iron|tikmēr|bet|tomēr|vs)\b/g) || []).length +
    (authoredText.match(/\?/g) || []).length;
  const present = Boolean(premise);
  const developed = Boolean(development);
  return { present, developed, signals, passes: present && developed };
}
'''
if 'function secondStoryMetrics' not in golden:
    if helper_anchor not in golden:
        raise SystemExit("golden clamp anchor not found")
    golden = golden.replace(helper_anchor, helper_anchor + helper, 1)

old_humour = '''  const joinedCues = cues.join(" ").toLocaleLowerCase("lv-LV");
  const emptyReaction = /(^|[.!?]\\s*)(hmm|hm|jā|nu jā|traki|nu gan|oho|interesanti)([.!?]|$)/i.test(joinedCues);
  const editorialSignals = (joinedCues.match(/\\b(bet|taču|izskatās|tiesa|vai|tomēr|pirms|acīmredzot|laikam|kamēr)\\b/g) || []).length;
  const questionSignals = (cues.join(" ").match(/\\?/g) || []).length;
  const humourAndPov = emptyReaction ? 0 : Math.round(weights.humourAndPov * clamp((editorialSignals + questionSignals * 2) / Math.max(6, cues.length), 0.65, 1));
  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");
'''
new_humour = '''  const joinedCues = cues.join(" ").toLocaleLowerCase("lv-LV");
  const emptyReaction = /(^|[.!?]\\s*)(hmm|hm|jā|nu jā|traki|nu gan|oho|interesanti)([.!?]|$)/i.test(joinedCues);
  const editorialSignals = (joinedCues.match(/\\b(bet|taču|izskatās|tiesa|vai|tomēr|pirms|acīmredzot|laikam|kamēr)\\b/g) || []).length;
  const questionSignals = (cues.join(" ").match(/\\?/g) || []).length;
  const secondStory = secondStoryMetrics(source);
  const authoredLayer = clamp((editorialSignals + questionSignals * 2 + secondStory.signals) / Math.max(6, cues.length), 0.65, 1);
  const authorshipMultiplier = secondStory.passes ? 1 : 0.45;
  const humourAndPov = emptyReaction ? 0 : Math.round(weights.humourAndPov * authoredLayer * authorshipMultiplier);
  if (!secondStory.passes) deficiencies.push("Create and develop OTRĀ STĀSTA LĪNIJA from verified reality. Reflection-only VO is not enough: add a distinct authored premise and carry it through OTRĀ STĀSTA ATTĪSTĪBA as setup, escalation and payoff/callback without inventing facts.");
  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");
'''
if old_humour not in golden:
    raise SystemExit("golden humour anchor not found")
golden = golden.replace(old_humour, new_humour, 1)

old_return = '''    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD,
    dimensions,
    deficiencies,
  };'''
new_return = '''    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes,
    dimensions,
    secondStory,
    deficiencies,
  };'''
if old_return not in golden:
    raise SystemExit("golden return anchor not found")
golden = golden.replace(old_return, new_return, 1)

golden_path.write_text(golden)

# 4) UI default brief / migration / model description
page_path = Path("app/page.tsx")
page = page_path.read_text()
old_brief = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest: warm, opinionated, lightly ironic and observant. Say what the viewer is thinking, notice details others miss, use internal dialogue, contradictions, provocation and callbacks when earned. Every VO must add story, humour, tension, character or emotion—never generic description or empty reactions. Protect strong dialogue and silence, never invent facts or humiliate participants, and keep VO selective near the 16.67% target without padding.'
new_brief = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect the footage—create a bold Second Story from verified reality using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.'
if old_brief not in page:
    raise SystemExit("page default brief anchor not found")
page = page.replace(old_brief, new_brief, 1)
page = page.replace('const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-25-fifth-diner-v2";', 'const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-25-second-story-v3";', 1)
page = page.replace('Primary selective voice-over writer. GPT-5.6 Terra is the automatic fallback and final quality/ratio correction model.', 'Primary writer and precision-correction model. GPT-5.6 Terra is used only as the automatic fallback when Sol is unavailable.', 1)
page_path.write_text(page)

# 5) Update old default-brief regression to the new canonical behavior
brief_test_path = Path("tests/default-editorial-brief.test.mjs")
brief_test = brief_test_path.read_text()
brief_test = brief_test.replace(
    'const expectedBrief = "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest: warm, opinionated, lightly ironic and observant. Say what the viewer is thinking, notice details others miss, use internal dialogue, contradictions, provocation and callbacks when earned. Every VO must add story, humour, tension, character or emotion—never generic description or empty reactions. Protect strong dialogue and silence, never invent facts or humiliate participants, and keep VO selective near the 16.67% target without padding.";',
    'const expectedBrief = "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect the footage—create a bold Second Story from verified reality using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.";',
    1,
)
brief_test = brief_test.replace('default Lepers editorial brief exposes the compact Fifth Dinner Guest doctrine', 'default Lepers editorial brief exposes the compact Fifth Dinner Guest + Second Story doctrine', 1)
brief_test = brief_test.replace('  assert.match(page, /internal dialogue/i);\n  assert.match(page, /details others miss/i);\n  assert.match(page, /provocation and callbacks/i);\n  assert.match(page, /never generic description or empty reactions/i);\n  assert.match(page, /16\\.67% target without padding/i);', '  assert.match(page, /editorial co-author/i);\n  assert.match(page, /Second Story/i);\n  assert.match(page, /verified reality/i);\n  assert.match(page, /metaphors, hypotheses, predictions, contradictions and callbacks/i);\n  assert.match(page, /never invent facts, motives or events/i);\n  assert.match(page, /selective near 16\\.67%/i);', 1)
brief_test_path.write_text(brief_test)
