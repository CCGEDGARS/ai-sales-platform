from pathlib import Path

PAGE = Path("app/page.tsx")
text = PAGE.read_text()

legacy = "Create a production-ready Latvian package for this scene at the Rihards Lepers benchmark: warm, knowing, lightly ironic and character-led. Build from contrast, reactions, awkwardness, callbacks and controlled chaos without describing obvious actions, humiliating participants or inventing facts."
compact = "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest: warm, opinionated, lightly ironic and observant. Say what the viewer is thinking, notice details others miss, use internal dialogue, contradictions, provocation and callbacks when earned. Every VO must add story, humour, tension, character or emotion—never generic description or empty reactions. Protect strong dialogue and silence, never invent facts or humiliate participants, and keep VO selective near the 16.67% target without padding."

constants_anchor = 'const GOLDEN_MASTER_LABEL = "Lepers Golden Master · locked 10/10 benchmark";\n\n'
constants_replacement = (
    'const GOLDEN_MASTER_LABEL = "Lepers Golden Master · locked 10/10 benchmark";\n'
    f'const LEGACY_DEFAULT_EDITORIAL_BRIEF = {legacy!r};\n'
    f'const DEFAULT_LEPERS_EDITORIAL_BRIEF = {compact!r};\n\n'
)

if "DEFAULT_LEPERS_EDITORIAL_BRIEF" not in text:
    if constants_anchor not in text:
        raise SystemExit("Could not find editorial constants anchor")
    text = text.replace(constants_anchor, constants_replacement, 1)

old_default = f'  [DEFAULT_EDITORIAL_TONE]:\n    "{legacy}",'
new_default = '  [DEFAULT_EDITORIAL_TONE]: DEFAULT_LEPERS_EDITORIAL_BRIEF,'
if old_default in text:
    text = text.replace(old_default, new_default, 1)
elif new_default not in text:
    raise SystemExit("Could not replace the default Lepers editorial brief")

function_anchor = '''function defaultEditorialBrief(tone: string) {\n  return EDITORIAL_TONE_BRIEFS[tone] ?? "";\n}\n\n'''
merge_function = '''function mergeSavedEditorialBriefs(saved: Record<string, string>) {\n  const merged = { ...EDITORIAL_TONE_BRIEFS, ...saved };\n  if (saved[DEFAULT_EDITORIAL_TONE] === LEGACY_DEFAULT_EDITORIAL_BRIEF) {\n    merged[DEFAULT_EDITORIAL_TONE] = DEFAULT_LEPERS_EDITORIAL_BRIEF;\n  }\n  return merged;\n}\n\n'''
if "function mergeSavedEditorialBriefs" not in text:
    if function_anchor not in text:
        raise SystemExit("Could not find defaultEditorialBrief function")
    text = text.replace(function_anchor, function_anchor + merge_function, 1)

old_saved_return = '      return { ...EDITORIAL_TONE_BRIEFS, ...saved };'
new_saved_return = '      return mergeSavedEditorialBriefs(saved);'
if old_saved_return in text:
    text = text.replace(old_saved_return, new_saved_return, 1)
elif new_saved_return not in text:
    raise SystemExit("Could not migrate saved editorial brief map")

old_prompt_return = '      return saved[DEFAULT_EDITORIAL_TONE] ?? defaultEditorialBrief(DEFAULT_EDITORIAL_TONE);'
new_prompt_return = '      return mergeSavedEditorialBriefs(saved)[DEFAULT_EDITORIAL_TONE];'
if old_prompt_return in text:
    text = text.replace(old_prompt_return, new_prompt_return, 1)
elif new_prompt_return not in text:
    raise SystemExit("Could not migrate default editorial prompt")

PAGE.write_text(text)
