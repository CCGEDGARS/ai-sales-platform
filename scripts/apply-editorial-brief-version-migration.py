from pathlib import Path

PAGE = Path("app/page.tsx")
text = PAGE.read_text()

brief_anchor = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest: warm, opinionated, lightly ironic and observant. Say what the viewer is thinking, notice details others miss, use internal dialogue, contradictions, provocation and callbacks when earned. Every VO must add story, humour, tension, character or emotion—never generic description or empty reactions. Protect strong dialogue and silence, never invent facts or humiliate participants, and keep VO selective near the 16.67% target without padding.';\n"
version_constants = (
    'const EDITORIAL_BRIEF_SCHEMA_VERSION = "2026-08-25-fifth-diner-v2";\n'
    'const EDITORIAL_BRIEF_VERSION_KEY = "dana-ai-editorial-brief-version";\n'
)

if "EDITORIAL_BRIEF_SCHEMA_VERSION" not in text:
    if brief_anchor not in text:
        raise SystemExit("Could not find compact Lepers brief anchor")
    text = text.replace(brief_anchor, brief_anchor + version_constants, 1)

persistence_anchor = '''  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        "dana-ai-editorial-briefs",\n        JSON.stringify(voiceoverBriefs),\n      );\n    } catch {}\n  }, [voiceoverBriefs]);\n'''

migration_effect = '''  useEffect(() => {\n    try {\n      const savedVersion = window.localStorage.getItem(EDITORIAL_BRIEF_VERSION_KEY);\n      if (savedVersion !== EDITORIAL_BRIEF_SCHEMA_VERSION) {\n        setVoiceoverBriefs((current) => {\n          const migrated = {\n            ...current,\n            [DEFAULT_EDITORIAL_TONE]: DEFAULT_LEPERS_EDITORIAL_BRIEF,\n          };\n          window.localStorage.setItem(\n            "dana-ai-editorial-briefs",\n            JSON.stringify(migrated),\n          );\n          return migrated;\n        });\n        setVoiceoverPrompt(DEFAULT_LEPERS_EDITORIAL_BRIEF);\n        window.localStorage.setItem(\n          EDITORIAL_BRIEF_VERSION_KEY,\n          EDITORIAL_BRIEF_SCHEMA_VERSION,\n        );\n      }\n    } catch {}\n  }, []);\n'''

if "localStorage.getItem(EDITORIAL_BRIEF_VERSION_KEY)" not in text:
    if persistence_anchor not in text:
        raise SystemExit("Could not find editorial brief persistence effect")
    text = text.replace(persistence_anchor, migration_effect + persistence_anchor, 1)

PAGE.write_text(text)
