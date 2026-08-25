from pathlib import Path

path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()

old = '''      if (goldenMaster && !goldenMaster.secondStory?.passes) {\n        return NextResponse.json(\n          {\n            ok: false,\n            message: `This older synchronous session cannot release a Lepers package without the mandatory Second Story. Refresh DANA Studio and regenerate so the current correction engine can build and verify OTRĀ STĀSTA LĪNIJA. Reference: ${requestId}`,\n            goldenMaster,\n            requestId,\n          },\n          { status: 409 },\n        );\n      }'''
new = '''      if (goldenMaster && (!goldenMaster.secondStory?.passes || !goldenMaster.creativeFreshness?.passes)) {\n        return NextResponse.json(\n          {\n            ok: false,\n            message: `This older synchronous session cannot release a Lepers package without the mandatory Second Story and WOW Creative Freshness gates. Refresh DANA Studio and regenerate with the current Creative Room engine. Reference: ${requestId}`,\n            goldenMaster,\n            requestId,\n          },\n          { status: 409 },\n        );\n      }'''
if old not in text:
    raise SystemExit("legacy WOW gate anchor not found")
text = text.replace(old, new, 1)

old = ''': `You are DANA AI's final Latvian television voice-over editor and fifth diner. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. Every cue must express an active point of view or added editorial layer; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} The selected tone must remain clearly recognisable after revision.`;'''
new = ''': `You are DANA AI's final Latvian television voice-over editor, fifth diner and creative executive producer. This is SELECTIVE NARRATION, not transcript summary. Preserve verified facts and participant dignity. Every cue must express an active point of view or added editorial layer; empty observer reactions are forbidden. SELECTED TONE: ${correctionTone}. ${correctionToneProfile} ${FIFTH_DINER_EDITORIAL_RULES} ${SECOND_STORY_EDITORIAL_RULES} ${CREATIVE_EXECUTIVE_PRODUCER_RULES} The selected tone must remain clearly recognisable after revision; do not let correction collapse into safe, predictable or reflection-only writing.`;'''
if old not in text:
    raise SystemExit("selective correction WOW anchor not found")
text = text.replace(old, new, 1)

path.write_text(text)
