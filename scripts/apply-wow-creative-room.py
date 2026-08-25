from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Patch anchor not found: {label}")
    return text.replace(old, new, 1)


# --- app/lib/lepers-standard.ts ---
path = Path("app/lib/lepers-standard.ts")
text = path.read_text()

old = '''- DANA ir arī redakcionāls līdzautors: ar esošā materiāla atspoguļošanu vien nepietiek. No pārbaudītas realitātes jāizveido papildu OTRĀ STĀSTA LĪNIJA, kas piešķir ainai jaunu spēli, spriedzi vai interpretācijas leņķi.\n'''
new = '''- DANA ir arī redakcionāls līdzautors: ar esošā materiāla atspoguļošanu vien nepietiek. No pārbaudītas realitātes jāizveido papildu OTRĀ STĀSTA LĪNIJA, kas piešķir ainai jaunu spēli, spriedzi vai interpretācijas leņķi.\n- WOW REŽĪMS ir obligāts: factually conservative, creatively aggressive. DANA nedrīkst iesniegt pirmo saprātīgo ideju. Vispirms jāizveido vairākas atšķirīgas redakcionālās iespējas, jāatmet paredzamās un tikai tad jāizvēlas svaigākais, aizstāvamais leņķis.\n- FORMAT SPICE ir obligāts: DANA piedāvā vismaz trīs avotā balstītus formāta uzlabojumus, piemēram, countdown, contradiction tracker, freeze-frame observation, split-screen salīdzinājumu, scorecard spēli, faux-serious audit, atkārtotu skaņas signālu, nodaļas nosaukumu, prediction meter, vizuālu motīvu vai citu oriģinālu mehāniku. Vismaz vienai idejai jāmaina tas, KĀ aina tiek pasniegta, nevis tikai jāpievieno vēl viens VO joks.\n'''
text = replace_once(text, old, new, "WOW editorial DNA")

old = '''# 1. Izpildproducenta lēmums\nStart with a decisive EP verdict and the 2–4 strongest story lines to amplify. Then include: Kas strādā; Kas bremzē; Ieteicamais tempu labojums; VO tonis. Make clear production decisions rather than generic observations. Then add exactly one bold authored line labelled **OTRĀ STĀSTA LĪNIJA:**. It must name a fresh editorial premise created from verified reality in the CURRENT source, not merely restate the visible action or dialogue. Ground it in at least two observable/audible anchors and state the tension, game or lens it will add to the episode.\n'''
new = '''# 1. Izpildproducenta lēmums\nStart with a decisive EP verdict and the 2–4 strongest story lines to amplify. Then include: Kas strādā; Kas bremzē; Ieteicamais tempu labojums; VO tonis. Make clear production decisions rather than generic observations.\n\nThen include a visible subsection titled **CREATIVE ROOM — WOW PASS**. This is mandatory proof that DANA did not settle for the first reasonable idea. Before finalising, generate at least five genuinely different source-grounded angles; show only the strongest three finalists plus the predictable ideas you deliberately rejected. Include these exact labels:\n- **OTRĀ STĀSTA KANDIDĀTI:** exactly 3 numbered finalist angles, each materially different and grounded in verified dialogue and/or visual evidence.\n- **NORAIDĪTIE PAREDZAMIE LEŅĶI:** at least 2 ideas that were safe, obvious, merely reflective or too generic, with one short reason each for rejecting them.\n- **FORMAT SPICE:** at least 3 numbered format-level devices. At least one must change how the scene is presented, not merely add VO. Use devices such as countdown, contradiction tracker, freeze-frame observation, split-screen comparison, faux-serious audit, scorecard, recurring sound cue, ironic chapter title, prediction meter, visual motif, audience question or an equally strong original device only when supported by the source.\n- **KO MĒS PIEVIENOJAM, KAS NAV JAU GATAVS MATERIĀLĀ:** one specific sentence naming the new editorial entertainment value created by the production team.\n- **DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA:** one bold but source-defensible idea worth testing in the edit.\n\nThen add exactly one bold authored line labelled **OTRĀ STĀSTA LĪNIJA:**. Select it from the Creative Room finalists. It must name a fresh editorial premise created from verified reality in the CURRENT source, not merely restate the visible action or dialogue. Ground it in at least two observable/audible anchors and state the tension, game or lens it will add to the episode.\n'''
text = replace_once(text, old, new, "Creative Room section 1")

old = '''QUALITY BAR\nThe result must read like a senior executive producer + story editor + VO writer has prepared an editor-ready document, not like an AI summary. Be specific, timecoded, decisive and useful in the edit suite. DANA AI must compare every finished Lepers package against the locked Golden Master and automatically revise any draft below the required conformance threshold before it is shown to the user.\n'''
new = '''QUALITY BAR\nThe result must read like a senior executive producer + story editor + VO writer has prepared an editor-ready document, not like an AI summary. Be specific, timecoded, decisive and useful in the edit suite. Technically correct but safe, predictable or merely reflective output is a failure. DANA AI must pass both the locked Golden Master conformance threshold and the separate Creative Freshness / WOW threshold before release. If the production team has not added a new entertainment line, format device, tension, game, surprise or authored perspective beyond what already exists in the raw material, rewrite the package.\n'''
text = replace_once(text, old, new, "WOW quality bar")
path.write_text(text)


# --- app/lib/lepers-golden-master.ts ---
path = Path("app/lib/lepers-golden-master.ts")
text = path.read_text()
text = replace_once(
    text,
    'export const LEPERS_GOLDEN_MASTER_THRESHOLD = 95;\n',
    'export const LEPERS_GOLDEN_MASTER_THRESHOLD = 95;\nexport const CREATIVE_FRESHNESS_THRESHOLD = 80;\n',
    "freshness threshold",
)

old = '''  secondStory: {\n    present: boolean;\n    developed: boolean;\n    signals: number;\n    passes: boolean;\n  };\n  deficiencies: string[];\n};'''
new = '''  secondStory: {\n    present: boolean;\n    developed: boolean;\n    signals: number;\n    passes: boolean;\n  };\n  creativeFreshness: {\n    score: number;\n    threshold: number;\n    passes: boolean;\n    dimensions: {\n      originalAngle: number;\n      entertainmentSurprise: number;\n      formatEnhancement: number;\n      provocationTension: number;\n      callbacksEngineering: number;\n      visualCreativity: number;\n    };\n    deficiencies: string[];\n  };\n  deficiencies: string[];\n};'''
text = replace_once(text, old, new, "creative freshness score type")

anchor = '''function secondStoryMetrics(source: string) {\n  const premise = source.match(/OTRĀ STĀSTA LĪNIJA\\s*[:—-]\\**\\s*([^\\n]{35,})/i);\n  const development = source.match(/OTRĀ STĀSTA ATTĪSTĪBA\\s*[:—-]\\**\\s*([^\\n]{35,})/i);\n  const authoredText = `${premise?.[1] || ""} ${development?.[1] || ""} ${voCells(source).join(" ")}`.toLocaleLowerCase("lv-LV");\n  const signals = (authoredText.match(/\\b(atcerēsimies|atgriežamies|solīj|prognoz|hipotēz|jautājum|pulksten|spēl|pretstat|metafor|iron|tikmēr|bet|tomēr|vs)\\b/g) || []).length +\n    (authoredText.match(/\\?/g) || []).length;\n  const present = Boolean(premise);\n  const developed = Boolean(development);\n  return { present, developed, signals, passes: present && developed };\n}\n'''
insert = anchor + '''\nfunction numberedCount(block: string) {\n  return (String(block || "").match(/(?:^|\\n)\\s*\\d+[.)]\\s+/g) || []).length;\n}\n\nfunction bulletCount(block: string) {\n  return (String(block || "").match(/(?:^|\\n)\\s*[-*•]\\s+/g) || []).length;\n}\n\nfunction creativeFreshnessMetrics(source: string) {\n  const room = section(source, /CREATIVE ROOM\\s*[—-]\\s*WOW PASS/i, /OTRĀ STĀSTA LĪNIJA/i);\n  const candidatesBlock = section(room, /OTRĀ STĀSTA KANDIDĀTI/i, /NORAIDĪTIE PAREDZAMIE LEŅĶI/i);\n  const rejectedBlock = section(room, /NORAIDĪTIE PAREDZAMIE LEŅĶI/i, /FORMAT SPICE/i);\n  const spiceBlock = section(room, /FORMAT SPICE/i, /KO MĒS PIEVIENOJAM/i);\n  const candidates = numberedCount(candidatesBlock);\n  const rejected = Math.max(numberedCount(rejectedBlock), bulletCount(rejectedBlock));\n  const spice = numberedCount(spiceBlock);\n  const addition = source.match(/KO MĒS PIEVIENOJAM, KAS NAV JAU GATAVS MATERIĀLĀ\\s*[:—-]\\**\\s*([^\\n]{35,})/i);\n  const boldIdea = source.match(/DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA\\s*[:—-]\\**\\s*([^\\n]{35,})/i);\n  const lower = room.toLocaleLowerCase("lv-LV");\n  const surpriseSignals = (lower.match(/\\b(negaid|pārsteig|absurd|iron|metafor|provok|spēl|twist|reversal|pretstat|hipotēz|prognoz)\\w*/g) || []).length;\n  const formatSignals = (lower.match(/countdown|freeze[- ]?frame|split[- ]?screen|scorecard|contradiction tracker|faux[- ]?serious|skaņas signāl|sound cue|chapter title|nodaļas nosauk|prediction meter|vizuāl\\w* motīv|audience question|skatītāja jautājum|grafik|taimer/gi) || []).length;\n  const tensionSignals = (lower.match(/\\b(spriedz|provok|jautājum|likm|risks|sacens|pretstat|konflikt|vs|kas notiks|cik ilgi|vai)\\w*/g) || []).length + (room.match(/\\?/g) || []).length;\n  const callbackSignals = (lower.match(/callback|running gag|setup|payoff|atcer|atgriež|solīj|prognoz/gi) || []).length;\n  const visualSignals = (spiceBlock.toLocaleLowerCase("lv-LV").match(/freeze|split|kadrs|grafik|vizuāl|skaņ|taimer|pulksten|montāž|reakcij|ekrān|titrs/gi) || []).length;\n\n  const originalAngle = clamp((candidates >= 3 ? 12 : candidates * 4) + (rejected >= 2 ? 5 : rejected * 2) + (addition ? 4 : 0) + (boldIdea ? 4 : 0), 0, 25);\n  const entertainmentSurprise = clamp((boldIdea ? 8 : 0) + Math.min(8, surpriseSignals * 2) + (rejected >= 2 ? 4 : rejected * 2), 0, 20);\n  const formatEnhancement = clamp((spice >= 3 ? 12 : spice * 4) + Math.min(8, formatSignals * 2), 0, 20);\n  const provocationTension = clamp(Math.min(15, tensionSignals * 3), 0, 15);\n  const callbacksEngineering = clamp(Math.min(10, callbackSignals * 3), 0, 10);\n  const visualCreativity = clamp(Math.min(10, visualSignals * 2), 0, 10);\n  const dimensions = { originalAngle, entertainmentSurprise, formatEnhancement, provocationTension, callbacksEngineering, visualCreativity };\n  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);\n  const structuralPass = Boolean(room) && candidates >= 3 && rejected >= 2 && spice >= 3 && Boolean(addition) && Boolean(boldIdea);\n  const deficiencies: string[] = [];\n  if (!room) deficiencies.push("Add the mandatory CREATIVE ROOM — WOW PASS before selecting the Second Story.");\n  if (candidates < 3) deficiencies.push("Show 3 materially different Second Story finalists after exploring broader alternatives.");\n  if (rejected < 2) deficiencies.push("Explicitly reject at least 2 predictable, safe or reflection-only angles.");\n  if (spice < 3) deficiencies.push("Add at least 3 FORMAT SPICE devices; at least one must change how the scene is presented, not merely add VO.");\n  if (!addition) deficiencies.push("State KO MĒS PIEVIENOJAM, KAS NAV JAU GATAVS MATERIĀLĀ with concrete new entertainment value.");\n  if (!boldIdea) deficiencies.push("State one DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA that is bold but source-defensible.");\n  if (formatEnhancement < 14) deficiencies.push("Increase format enhancement with concrete edit, graphic, sound, visual or recurring-game mechanics.");\n  if (entertainmentSurprise < 14) deficiencies.push("Increase surprise, comic premise, reversal, metaphor or unexpected editorial framing.");\n  return { score, threshold: CREATIVE_FRESHNESS_THRESHOLD, passes: structuralPass && score >= CREATIVE_FRESHNESS_THRESHOLD, dimensions, deficiencies };\n}\n'''
if "function creativeFreshnessMetrics" not in text:
    if anchor not in text:
        raise SystemExit("Patch anchor not found: creative freshness function")
    text = text.replace(anchor, insert, 1)

old = '''  const secondStory = secondStoryMetrics(source);\n  const authoredLayer = clamp((editorialSignals + questionSignals * 2 + secondStory.signals) / Math.max(6, cues.length), 0.65, 1);'''
new = '''  const secondStory = secondStoryMetrics(source);\n  const creativeFreshness = creativeFreshnessMetrics(source);\n  const authoredLayer = clamp((editorialSignals + questionSignals * 2 + secondStory.signals) / Math.max(6, cues.length), 0.65, 1);'''
text = replace_once(text, old, new, "compute creative freshness")

old = '''  if (!secondStory.passes) deficiencies.push("Create and develop OTRĀ STĀSTA LĪNIJA from verified reality. Reflection-only VO is not enough: add a distinct authored premise and carry it through OTRĀ STĀSTA ATTĪSTĪBA as setup, escalation and payoff/callback without inventing facts.");\n  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");'''
new = '''  if (!secondStory.passes) deficiencies.push("Create and develop OTRĀ STĀSTA LĪNIJA from verified reality. Reflection-only VO is not enough: add a distinct authored premise and carry it through OTRĀ STĀSTA ATTĪSTĪBA as setup, escalation and payoff/callback without inventing facts.");\n  if (!creativeFreshness.passes) deficiencies.push(`Creative Freshness / WOW ${creativeFreshness.score}/${creativeFreshness.threshold}: ${creativeFreshness.deficiencies.join(" ")}`);\n  if (humourAndPov < weights.humourAndPov) deficiencies.push("Strengthen the fifth-diner point of view, comic framing, contradiction and viewer-thought layer; remove passive reactions.");'''
text = replace_once(text, old, new, "freshness deficiency")

old = '''    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes,\n    dimensions,\n    secondStory,\n    deficiencies,'''
new = '''    passes: score >= LEPERS_GOLDEN_MASTER_THRESHOLD && secondStory.passes && creativeFreshness.passes,\n    dimensions,\n    secondStory,\n    creativeFreshness,\n    deficiencies,'''
text = replace_once(text, old, new, "freshness hard gate")
path.write_text(text)


# --- app/api/generate-voiceover/route.ts ---
path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()

anchor = '''const SECOND_STORY_EDITORIAL_RULES = `\nSECOND STORY — MANDATORY EDITORIAL AUTHORSHIP RULE'''
start = text.find(anchor)
if start < 0:
    raise SystemExit("Patch anchor not found: second story rules")
end_marker = '''`.trim();\n\nconst TONE_PROFILES'''
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("Patch anchor not found: tone profiles after second story")
insert_pos = end + len('`.trim();\n')
creative_rules = '''\nconst CREATIVE_EXECUTIVE_PRODUCER_RULES = `\nWOW CREATIVE EXECUTIVE PRODUCER MODE — MANDATORY\n- Factually conservative, creatively aggressive. Evidence discipline stays strict; creative ambition does not.\n- Do not submit the first reasonable idea. The first obvious interpretation is a draft, not the answer.\n- Before final writing, run a Creative Room: generate at least 5 genuinely different source-grounded editorial angles, deliberately reject safe/reflection-only options, then show the 3 strongest finalists in the package.\n- Divergence must be real: vary the game, tension, metaphor, character lens, structural device and audience expectation — do not create five paraphrases of the same idea.\n- At least 2 predictable ideas must be named and rejected explicitly so the package proves it escaped safe mode.\n- FORMAT SPICE is mandatory: propose at least 3 source-grounded devices that enrich the format itself. Examples include countdown, contradiction tracker, freeze-frame observation, split-screen comparison, faux-serious audit, scorecard, recurring sound cue, ironic chapter title, prediction meter, visual motif, audience question or another equally strong device.\n- At least one Format Spice idea must change how the scene is presented in edit, graphics, sound, structure or recurring game — not merely add another VO joke.\n- Create the line the raw footage does not already hand you: a new game, premise, tension, anticipation mechanism, metaphor, recurring motif, provocation or payoff architecture.\n- Be willing to make a bold editorial choice. Safe, generic, tasteful-but-forgettable output is a failure even when factually correct.\n- Provocative does not mean cruel: protect dignity, legal safety and factual truth while pushing surprise, wit, tension and entertainment.\n- Final self-test: “What did the production team add that was NOT already sitting in the transcript or picture?” If the answer is vague, rewrite.\n`.trim();\n'''
if "const CREATIVE_EXECUTIVE_PRODUCER_RULES" not in text:
    text = text[:insert_pos] + creative_rules + text[insert_pos:]

text = text.replace(
    '${SECOND_STORY_EDITORIAL_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}',
    '${SECOND_STORY_EDITORIAL_RULES}\n\n${CREATIVE_EXECUTIVE_PRODUCER_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}',
)

old = '''SECOND STORY REQUIREMENT: before writing, identify what else this scene can be about beyond the literal events. Create one bold additional editorial storyline from verified reality, label it OTRĀ STĀSTA LĪNIJA in section 1, develop it through setup → escalation → payoff/callback in section 2, and let it influence VO, edit choices, teasers and the final producer judgement. Do not merely reflect the existing dialogue or action.\n\nVOICE-OVER AMOUNT CONTROL:'''
new = '''CREATIVE ROOM / WOW REQUIREMENT: do not submit the first reasonable idea. Explore at least 5 genuinely different source-grounded angles before final writing. In section 1, visibly show CREATIVE ROOM — WOW PASS with exactly 3 strongest OTRĀ STĀSTA KANDIDĀTI, at least 2 NORAIDĪTIE PAREDZAMIE LEŅĶI, at least 3 FORMAT SPICE devices, KO MĒS PIEVIENOJAM, KAS NAV JAU GATAVS MATERIĀLĀ, and one DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA. Be factually conservative and creatively aggressive.\n\nSECOND STORY REQUIREMENT: after the Creative Room, select the strongest bold additional editorial storyline from verified reality, label it OTRĀ STĀSTA LĪNIJA in section 1, develop it through setup → escalation → payoff/callback in section 2, and let it influence VO, edit choices, teasers and the final producer judgement. Do not merely reflect the existing dialogue or action.\n\nFRESHNESS / WOW GATE: a technically correct package that is safe, predictable, merely reflective or adds nothing to the format must be rewritten. The production team must contribute a genuinely new entertainment line beyond the raw material.\n\nVOICE-OVER AMOUNT CONTROL:'''
text = replace_once(text, old, new, "Lepers Creative Room prompt")

old = '''9. CREATE A SECOND STORY: do not stop at reflection. Identify an additional source-grounded angle or game in the scene and author original framing, metaphor, hypothesis, prediction, provocative question or callback around verified facts. Advance that additional line across multiple cues when the material supports it. Invent the editorial idea around reality; never invent reality.\n\nVOICE-OVER AMOUNT STANDARD:'''
new = '''9. CREATE A SECOND STORY: do not stop at reflection. Identify an additional source-grounded angle or game in the scene and author original framing, metaphor, hypothesis, prediction, provocative question or callback around verified facts. Advance that additional line across multiple cues when the material supports it. Invent the editorial idea around reality; never invent reality.\n10. CREATIVE DIVERGENCE: do not submit the first reasonable idea. Generate competing alternatives, reject predictable reflection-only angles, and choose the freshest source-grounded premise. When the footage supports it, use format-level devices such as countdown, freeze-frame, split-screen, scorecard, contradiction tracker, recurring sound cue or ironic chapter title so the format becomes richer, not merely the VO.\n\nVOICE-OVER AMOUNT STANDARD:'''
text = replace_once(text, old, new, "selective VO divergence")

text = replace_once(
    text,
    'reasoning: { effort: "medium" },',
    'reasoning: { effort: "high" },',
    "high creative reasoning",
)

old = '''  if (!goldenMaster.secondStory?.passes) {\n    repairs.push("SECOND STORY: create and explicitly label OTRĀ STĀSTA LĪNIJA from verified reality, then develop the same authored angle through OTRĀ STĀSTA ATTĪSTĪBA as setup → escalation → payoff/callback. Do not settle for reflection-only commentary; preserve strong existing dimensions while adding the missing editorial storyline.");\n  }'''
new = '''  if (!goldenMaster.secondStory?.passes) {\n    repairs.push("SECOND STORY: create and explicitly label OTRĀ STĀSTA LĪNIJA from verified reality, then develop the same authored angle through OTRĀ STĀSTA ATTĪSTĪBA as setup → escalation → payoff/callback. Do not settle for reflection-only commentary; preserve strong existing dimensions while adding the missing editorial storyline.");\n  }\n  if (!goldenMaster.creativeFreshness?.passes) {\n    repairs.push(`FRESHNESS / WOW: current ${goldenMaster.creativeFreshness?.score ?? 0}/${goldenMaster.creativeFreshness?.threshold ?? 80}. Run the Creative Room again: generate genuinely competing angles, reject predictable ones, strengthen FORMAT SPICE with at least one scene-presentation device, state what production adds beyond the raw material, and choose a bolder source-defensible idea. ${goldenMaster.creativeFreshness?.deficiencies?.join(" ") || ""}`);\n  }'''
text = replace_once(text, old, new, "freshness repair map")

text = text.replace(
    'goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes',
    'goldenMaster.score < LEPERS_GOLDEN_MASTER_THRESHOLD || !goldenMaster.secondStory?.passes || !goldenMaster.creativeFreshness?.passes',
)

text = text.replace(
    '${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} GOLDEN MASTER CONFORMANCE:',
    '${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} GOLDEN MASTER CONFORMANCE:',
)

old = '''Preserve and develop the Second Story across the package: OTRĀ STĀSTA LĪNIJA must be a source-grounded authored premise, and OTRĀ STĀSTA ATTĪSTĪBA must carry it through setup → escalation → payoff/callback. GOLDEN MASTER CONFORMANCE:'''
new = '''Preserve and develop the Second Story across the package: OTRĀ STĀSTA LĪNIJA must be a source-grounded authored premise, and OTRĀ STĀSTA ATTĪSTĪBA must carry it through setup → escalation → payoff/callback. CREATIVE ROOM / WOW: preserve or rebuild the visible Creative Room with 3 finalists, 2 rejected predictable angles, 3+ FORMAT SPICE devices, the explicit new production value and the boldest defendable idea. Do not merely polish the same safe premise. GOLDEN MASTER CONFORMANCE:'''
text = replace_once(text, old, new, "correction Creative Room")

old = '''message: `DANA AI rejected the Lepers package because ${!goldenMaster.secondStory?.passes ? "the required Second Story editorial line was still missing or underdeveloped" : `Golden Master conformance remained ${goldenMaster.score}/100`}; minimum quality is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100. Reference: ${requestId}`,'''
new = '''message: `DANA AI rejected the Lepers package because ${!goldenMaster.creativeFreshness?.passes ? `Creative Freshness / WOW remained ${goldenMaster.creativeFreshness?.score ?? 0}/${goldenMaster.creativeFreshness?.threshold ?? 80}` : !goldenMaster.secondStory?.passes ? "the required Second Story editorial line was still missing or underdeveloped" : `Golden Master conformance remained ${goldenMaster.score}/100`}; minimum Golden Master quality is ${LEPERS_GOLDEN_MASTER_THRESHOLD}/100 and WOW freshness must also pass. Reference: ${requestId}`,'''
text = replace_once(text, old, new, "final WOW rejection")

path.write_text(text)


# --- app/page.tsx ---
path = Path("app/page.tsx")
text = path.read_text()

old = '''type GoldenMasterMetrics = {\n  score: number;\n  threshold: number;\n  passes: boolean;\n  dimensions: Record<string, number>;\n  deficiencies: string[];\n};'''
new = '''type GoldenMasterMetrics = {\n  score: number;\n  threshold: number;\n  passes: boolean;\n  dimensions: Record<string, number>;\n  creativeFreshness?: {\n    score: number;\n    threshold: number;\n    passes: boolean;\n    dimensions: Record<string, number>;\n    deficiencies: string[];\n  };\n  deficiencies: string[];\n};'''
text = replace_once(text, old, new, "UI freshness type")

old_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect—create a bold Second Story from verified dialogue + visual evidence using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.';\nconst EDITORIAL_BRIEF_SCHEMA_VERSION = \"2026-08-25-visual-evidence-v4\";"
new_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive: do not submit the first reasonable idea. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE—bold callbacks, visual/editing games, provocations, metaphors and hooks that make the show richer than the raw footage. Fifth Dinner Guest VO must surprise, not reflect. Never invent reality or humiliate participants; keep VO selective near 16.67%.';\nconst EDITORIAL_BRIEF_SCHEMA_VERSION = \"2026-08-25-wow-creative-room-v5\";"
text = replace_once(text, old_brief, new_brief, "visible WOW brief")

old = '''                      <b>Golden Master Match: {goldenMasterMetrics.score}/100</b> · {Object.entries(goldenMasterMetrics.dimensions).map(([key, value]) => `${key} ${value}`).join(" · ")}\n                    </small>'''
new = '''                      <b>Golden Master Match: {goldenMasterMetrics.score}/100</b> · {Object.entries(goldenMasterMetrics.dimensions).map(([key, value]) => `${key} ${value}`).join(" · ")}\n                      {goldenMasterMetrics.creativeFreshness ? ` · WOW Freshness ${goldenMasterMetrics.creativeFreshness.score}/${goldenMasterMetrics.creativeFreshness.threshold}` : ""}\n                    </small>'''
text = replace_once(text, old, new, "WOW score UI")
path.write_text(text)
