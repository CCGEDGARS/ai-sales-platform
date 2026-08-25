from pathlib import Path

PAGE = Path("app/page.tsx")
ROUTE = Path("app/api/generate-voiceover/route.ts")

page = PAGE.read_text()
route = ROUTE.read_text()

# Tone-specific default editorial briefs.
anchor = '''};\n\nfunction buildReferenceBrief(names: string[]) {'''
insert = '''};\n\nconst TAILORED_TONE = "Tailored · custom editorial direction";\nconst DEFAULT_EDITORIAL_TONE = "Lepers Standard · premium observational comedy";\n\nconst EDITORIAL_TONE_BRIEFS: Record<string, string> = {\n  [DEFAULT_EDITORIAL_TONE]:\n    "Create a production-ready Latvian package for this scene at the Rihards Lepers benchmark: warm, knowing, lightly ironic and character-led. Build from contrast, reactions, awkwardness, callbacks and controlled chaos without describing obvious actions, humiliating participants or inventing facts.",\n  "Observational · sharp, warm and lightly humorous":\n    "Create selective Latvian voice-over that notices the social details others miss. Use warm precision, character-specific observation and clean comic turns. Add meaning through reactions, contradictions and behaviour without narrating the obvious or mocking vulnerability.",\n  "Dry irony · understated and precise":\n    "Create concise Latvian voice-over with dry, understated humour. Focus on contradictions, awkward pauses, reactions and subtle irony. Underplay rather than exaggerate. Do not describe obvious actions, invent facts, paraphrase dialogue or humiliate participants.",\n  "Warm human · intimate and empathetic":\n    "Create warm, intimate Latvian voice-over that notices effort, nerves, pride, vulnerability and small acts of courage. Use gentle humour and emotional intelligence. Protect participant dignity and avoid sarcasm that turns a person into the joke.",\n  "Rising tension · cinematic and controlled":\n    "Create controlled Latvian voice-over that builds anticipation and tension from verified behaviour, timing, uncertainty and contradiction. Use short, precise interventions around turning points. Never invent stakes or over-dramatise routine actions.",\n  "Fast bridge · concise and energetic":\n    "Create fast, economical Latvian voice-over with compact sentences, active verbs and clean transitions. Every intervention must move the story, sharpen expectation or land a reaction. Avoid decorative filler, recap and long explanations.",\n  "Classic · British original":\n    "Create Latvian voice-over with the dry, clever, lightly cheeky observational spirit of the British format. Use elegant understatement, social observation and comic reversals while preserving Latvian naturalness. Avoid melodrama, cruelty and obvious narration.",\n  [TAILORED_TONE]: "",\n};\n\nfunction defaultEditorialBrief(tone: string) {\n  return EDITORIAL_TONE_BRIEFS[tone] ?? "";\n}\n\nfunction buildReferenceBrief(names: string[]) {'''
if "const EDITORIAL_TONE_BRIEFS:" not in page:
    if anchor not in page:
        raise SystemExit("Could not locate sourceApplications end")
    page = page.replace(anchor, insert, 1)

old_state = '''  const [voiceoverPrompt, setVoiceoverPrompt] = useState(\n    "Create a production-ready Latvian bridge for this scene. Match the Rihards Lepers reference in depth, rhythm, character insight and intelligent humour; build from contrast, reactions and awkwardness without describing obvious actions or inventing facts.",\n  );\n  const [voiceoverTone, setVoiceoverTone] = useState(\n    "Lepers Standard · premium observational comedy",\n  );'''
new_state = '''  const [voiceoverTone, setVoiceoverTone] = useState(DEFAULT_EDITORIAL_TONE);\n  const [voiceoverBriefs, setVoiceoverBriefs] = useState<Record<string, string>>(() => {\n    if (typeof window === "undefined") return { ...EDITORIAL_TONE_BRIEFS };\n    try {\n      const saved = JSON.parse(\n        window.localStorage.getItem("dana-ai-editorial-briefs") || "{}",\n      ) as Record<string, string>;\n      return { ...EDITORIAL_TONE_BRIEFS, ...saved };\n    } catch {\n      return { ...EDITORIAL_TONE_BRIEFS };\n    }\n  });\n  const [voiceoverPrompt, setVoiceoverPrompt] = useState(() => {\n    if (typeof window === "undefined") return defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);\n    try {\n      const saved = JSON.parse(\n        window.localStorage.getItem("dana-ai-editorial-briefs") || "{}",\n      ) as Record<string, string>;\n      return saved[DEFAULT_EDITORIAL_TONE] ?? defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);\n    } catch {\n      return defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);\n    }\n  });'''
if old_state in page:
    page = page.replace(old_state, new_state, 1)
elif "const [voiceoverBriefs, setVoiceoverBriefs]" not in page:
    raise SystemExit("Could not locate voiceover tone/prompt state")

voiceover_effect_anchor = '''  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        "dana-ai-voiceovers",\n        JSON.stringify(voiceovers),\n      );\n    } catch {}\n  }, [voiceovers]);'''
brief_effect = '''  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        "dana-ai-editorial-briefs",\n        JSON.stringify(voiceoverBriefs),\n      );\n    } catch {}\n  }, [voiceoverBriefs]);\n'''
if "JSON.stringify(voiceoverBriefs)" not in page:
    if voiceover_effect_anchor not in page:
        raise SystemExit("Could not locate voiceover persistence effect")
    page = page.replace(voiceover_effect_anchor, brief_effect + voiceover_effect_anchor, 1)

handler_anchor = '''  const generateVoiceover = async () => {'''
handlers = '''  const updateEditorialBrief = (value: string) => {\n    setVoiceoverPrompt(value);\n    setVoiceoverBriefs((current) => ({ ...current, [voiceoverTone]: value }));\n  };\n\n  const changeEditorialTone = (nextTone: string) => {\n    setVoiceoverBriefs((current) => ({\n      ...current,\n      [voiceoverTone]: voiceoverPrompt,\n    }));\n    const nextBrief = voiceoverBriefs[nextTone] ?? defaultEditorialBrief(nextTone);\n    setVoiceoverTone(nextTone);\n    setVoiceoverPrompt(nextBrief);\n    setVoiceoverMessage(\n      nextTone === TAILORED_TONE\n        ? "Tailored mode selected. Describe the exact editorial direction for this scene."\n        : `Editorial brief switched to ${nextTone}.`,\n    );\n  };\n\n  const generateVoiceover = async () => {'''
if "const changeEditorialTone" not in page:
    if handler_anchor not in page:
        raise SystemExit("Could not locate generateVoiceover")
    page = page.replace(handler_anchor, handlers, 1)

old_controls = '''                <label>\n                  What should this bridge do?\n                  <textarea\n                    value={voiceoverPrompt}\n                    onChange={(e) => setVoiceoverPrompt(e.target.value)}\n                  />\n                </label>\n                <label>\n                  Editorial tone\n                  <select\n                    value={voiceoverTone}\n                    onChange={(e) => setVoiceoverTone(e.target.value)}\n                  >\n                    <option>Lepers Standard · premium observational comedy</option>\n                    <option>\n                      Observational · sharp, warm and lightly humorous\n                    </option>\n                    <option>Dry irony · understated and precise</option>\n                    <option>Warm human · intimate and empathetic</option>\n                    <option>Rising tension · cinematic and controlled</option>\n                    <option>Fast bridge · concise and energetic</option>\n                    <option>Classic · British original</option>\n                  </select>\n                </label>'''
new_controls = '''                <label>\n                  Editorial brief\n                  <textarea\n                    value={voiceoverPrompt}\n                    onChange={(e) => updateEditorialBrief(e.target.value)}\n                    placeholder={\n                      voiceoverTone === TAILORED_TONE\n                        ? "Describe the desired narrator attitude, humour level, pace, emotional tone, character treatment, references, or specific instructions for this scene."\n                        : undefined\n                    }\n                  />\n                </label>\n                <label>\n                  Editorial tone\n                  <select\n                    value={voiceoverTone}\n                    onChange={(e) => changeEditorialTone(e.target.value)}\n                  >\n                    <option>{DEFAULT_EDITORIAL_TONE}</option>\n                    <option>\n                      Observational · sharp, warm and lightly humorous\n                    </option>\n                    <option>Dry irony · understated and precise</option>\n                    <option>Warm human · intimate and empathetic</option>\n                    <option>Rising tension · cinematic and controlled</option>\n                    <option>Fast bridge · concise and energetic</option>\n                    <option>Classic · British original</option>\n                    <option>{TAILORED_TONE}</option>\n                  </select>\n                </label>'''
if old_controls in page:
    page = page.replace(old_controls, new_controls, 1)
elif "onChange={(e) => changeEditorialTone(e.target.value)}" not in page:
    raise SystemExit("Could not locate editorial controls")

# Backend: Tailored is a real profile, never a silent fallback to Lepers.
if 'const TAILORED_TONE = "Tailored · custom editorial direction";' not in route:
    route = route.replace(
        'const DEFAULT_TONE = "Lepers Standard · premium observational comedy";\n',
        'const DEFAULT_TONE = "Lepers Standard · premium observational comedy";\nconst TAILORED_TONE = "Tailored · custom editorial direction";\n',
        1,
    )

classic_entry = '''  "Classic · British original":\n    "CLASSIC BRITISH FORMAT. Dry, clever, lightly cheeky and socially observant. Use elegant understatement and comic reversals. Avoid hype, melodrama and direct insults.",\n};'''
tailored_entry = '''  "Classic · British original":\n    "CLASSIC BRITISH FORMAT. Dry, clever, lightly cheeky and socially observant. Use elegant understatement and comic reversals. Avoid hype, melodrama and direct insults.",\n  [TAILORED_TONE]:\n    "TAILORED. Follow the user's editorial brief as the primary stylistic direction. Translate that brief into a coherent Latvian broadcast narrator voice while preserving evidence discipline, participant dignity, selective narration and the voice-over amount standard. Do not inherit Lepers styling unless the user's brief explicitly asks for it.",\n};'''
if "TAILORED. Follow the user's editorial brief" not in route:
    if classic_entry not in route:
        raise SystemExit("Could not locate classic tone profile")
    route = route.replace(classic_entry, tailored_entry, 1)

PAGE.write_text(page)
ROUTE.write_text(route)
print("Applied tone-specific editorial briefs and Tailored mode")
