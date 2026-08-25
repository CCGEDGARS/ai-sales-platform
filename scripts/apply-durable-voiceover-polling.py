from pathlib import Path

path = Path("app/page.tsx")
text = path.read_text()

anchor = 'const EDITORIAL_BRIEF_VERSION_KEY = "dana-ai-editorial-brief-version";\n'
replacement = anchor + 'const MAX_VOICEOVER_POLL_COUNT = 2160; // 90 minutes at 2.5s; pending job remains resumable after this window.\nconst VOICEOVER_LONG_RUNNING_POLL_COUNT = 360; // 15 minutes.\nconst VOICEOVER_POLL_INTERVAL_MS = 2500;\n'
if anchor not in text:
    raise SystemExit("constant anchor not found")
text = text.replace(anchor, replacement, 1)

old_timeout = '''    if (pollCount > 360) {\n      window.localStorage.removeItem("dana-ai-pending-voiceover");\n      setVoiceoverStatus("failed");\n      setVoiceoverMessage(\n        "OpenAI is still processing after 15 minutes. The job was left safely in OpenAI; press Write voice-over draft to start a new run if needed.",\n      );\n      return;\n    }'''
new_timeout = '''    if (pollCount > MAX_VOICEOVER_POLL_COUNT) {\n      setVoiceoverStatus("generating");\n      setVoiceoverMessage(\n        "DANA AI is still working on this background job. The exact OpenAI response ID is preserved on this device; reload the page at any time and DANA will resume checking the same run automatically. Do not start a duplicate run unless you intentionally want to replace it.",\n      );\n      return;\n    }'''
if old_timeout not in text:
    raise SystemExit("timeout block not found")
text = text.replace(old_timeout, new_timeout, 1)

old_message = '''        setVoiceoverMessage(\n          result.phase === "correction"\n            ? "DANA AI is checking selective VO structure, the selected editorial tone and the narration-ratio standard…"\n            : "OpenAI is generating the voice-over in a durable background job. You can keep this page open while it finishes…",\n        );\n        window.setTimeout(() => {\n          void pollVoiceoverJob(nextId, pollCount + 1);\n        }, 2500);'''
new_message = '''        setVoiceoverMessage(\n          result.phase === "output-expansion"\n            ? "DANA AI is rebuilding the complete WOW package with the expanded output budget so no section is truncated. The same source context is preserved…"\n            : result.phase === "correction"\n              ? "DANA AI is running the Golden Master / WOW correction pass: structure, freshness, Fifth Dinner Guest POV and narration ratio are being checked…"\n              : pollCount >= VOICEOVER_LONG_RUNNING_POLL_COUNT\n                ? "DANA AI is still working on the full WOW package. This is a durable OpenAI background job; the response ID is preserved and the page will keep checking it automatically…"\n                : "OpenAI is generating the voice-over in a durable background job. You can keep this page open while it finishes…",\n        );\n        window.setTimeout(() => {\n          void pollVoiceoverJob(nextId, pollCount + 1);\n        }, VOICEOVER_POLL_INTERVAL_MS);'''
if old_message not in text:
    raise SystemExit("progress block not found")
text = text.replace(old_message, new_message, 1)

old_catch = '''    } catch (error) {\n      window.localStorage.removeItem("dana-ai-pending-voiceover");\n      setVoiceoverStatus("failed");\n      setVoiceoverMessage(\n        error instanceof Error ? error.message : "Voice-over generation failed.",\n      );\n    }\n  };\n  const updateEditorialBrief'''
new_catch = '''    } catch (error) {\n      setVoiceoverStatus("failed");\n      setVoiceoverMessage(\n        `${error instanceof Error ? error.message : "Voice-over job check was interrupted."} The pending OpenAI response ID is preserved; reload the page to resume checking this exact run.`,\n      );\n    }\n  };\n  useEffect(() => {\n    let pendingResponseId = "";\n    try {\n      pendingResponseId = window.localStorage.getItem("dana-ai-pending-voiceover") || "";\n    } catch {}\n    if (!pendingResponseId.startsWith("resp_")) return;\n    setVoiceoverStatus("generating");\n    setVoiceoverMessage(\n      "Restoring the pending DANA AI generation from this device and reconnecting to the same OpenAI background job…",\n    );\n    void pollVoiceoverJob(pendingResponseId);\n  }, []);\n  const updateEditorialBrief'''
if old_catch not in text:
    raise SystemExit("poll catch anchor not found")
text = text.replace(old_catch, new_catch, 1)

path.write_text(text)
