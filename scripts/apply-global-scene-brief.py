from pathlib import Path

path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()

anchor = '''const FIFTH_DINER_EDITORIAL_RULES = `\n'''
if anchor not in text:
    raise SystemExit("Could not find fifth diner rules anchor")

insert = '''const GLOBAL_SCENE_DIRECTIVE_RULES = `\nGLOBAL SCENE DIRECTIVE — MANDATORY APPLICATION RULE\n- The user's Editorial brief is a GLOBAL SCENE DIRECTIVE, not a VO-only note.\n- In Lepers Standard, apply it coherently across all 8 sections of the Lepers production package: EP decision and story priorities; dramaturgy and act emphasis; KEEP / TIGHTEN / REMOVE / VERIFY decisions; VO MASTER narrator attitude and beat selection; teasers and promo; editorial/factual risk emphasis where relevant; editing and sound recommendations; and the final producer recommendation.\n- The brief may change emphasis, comic pressure, warmth, provocativeness, pacing, character focus, tension, sentiment and what moments are prioritised, as long as the source supports those choices.\n- Do not confine an edited brief to section 4. If the brief says to sharpen awkwardness, reduce sentiment, foreground a character contradiction, or prioritise a story line, that decision must be visible consistently throughout the package.\n- The brief must not override mandatory channel rules, the DANA Master Production System, participant dignity, factual discipline, canonical Lepers package structure or the current transcript as factual source of truth.\n- If the user's brief conflicts with a higher-priority rule, preserve the higher-priority rule and apply the brief as far as safely and editorially possible.\n`.trim();\n\n'''
if "GLOBAL SCENE DIRECTIVE — MANDATORY APPLICATION RULE" not in text:
    text = text.replace(anchor, insert + anchor, 1)

needle = '''${FIFTH_DINER_EDITORIAL_RULES}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
replacement = '''${FIFTH_DINER_EDITORIAL_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}\n\n${LEPERS_PRODUCTION_PACKAGE_CONTRACT}`;'''
if needle not in text:
    raise SystemExit("Could not find Lepers system prompt anchor")
text = text.replace(needle, replacement, 1)

old = '''Editorial request: ${body.prompt || "Use the Rihards Lepers production standard as the benchmark for this scene."}'''
new = '''GLOBAL SCENE DIRECTIVE — APPLY TO THE ENTIRE PACKAGE:\n${body.prompt || "Use the Rihards Lepers production standard as the benchmark for this scene."}\n\nApplication check: before finalising, verify that this directive materially influences the EP decision, dramaturgy, KEEP / TIGHTEN / REMOVE / VERIFY choices, VO MASTER, teasers and promo, editing and sound recommendations, and final producer recommendation wherever the source evidence makes it relevant.'''
if old not in text:
    raise SystemExit("Could not find Lepers editorial request anchor")
text = text.replace(old, new, 1)

# Non-Lepers tones still treat the field as a directive over the complete VO output.
non_lepers_needle = '''${FIFTH_DINER_EDITORIAL_RULES}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;'''
non_lepers_replacement = '''${FIFTH_DINER_EDITORIAL_RULES}\n\n${GLOBAL_SCENE_DIRECTIVE_RULES}\nThe selected tone is mandatory: it must materially change rhythm, vocabulary, comic pressure, warmth, irony and sentence shape while all factual constraints remain unchanged.`;'''
if non_lepers_needle not in text:
    raise SystemExit("Could not find non-Lepers system prompt anchor")
text = text.replace(non_lepers_needle, non_lepers_replacement, 1)

text = text.replace('Editorial request: ${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}', 'GLOBAL SCENE DIRECTIVE — APPLY TO THE COMPLETE VO OUTPUT:\n${body.prompt || "Build a clear, engaging bridge that heightens character, tension and humour without overexplaining."}', 1)

path.write_text(text)
print("Global scene directive integration applied")
