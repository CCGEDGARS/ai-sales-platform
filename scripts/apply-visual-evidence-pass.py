from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Patch anchor not found: {label}")
    return text.replace(old, new, 1)

# --- app/page.tsx ---
page_path = Path("app/page.tsx")
page = page_path.read_text()

page = replace_once(
    page,
    '''type TranscriptResult = {\n  fileName: string;\n  transcript: string;\n  model: string;\n  timecodes: boolean;\n};''',
    '''type TranscriptResult = {\n  fileName: string;\n  transcript: string;\n  model: string;\n  timecodes: boolean;\n  visualEvidence?: string;\n  visualEvidenceAvailable?: boolean;\n  visualEvidenceModel?: string;\n};''',
    "TranscriptResult visual fields",
)

old_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect the footage—create a bold Second Story from verified reality using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.';\nconst EDITORIAL_BRIEF_SCHEMA_VERSION = \"2026-08-25-second-story-v3\";"
new_brief = "const DEFAULT_LEPERS_EDITORIAL_BRIEF = 'Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect—create a bold Second Story from verified dialogue + visual evidence using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.';\nconst EDITORIAL_BRIEF_SCHEMA_VERSION = \"2026-08-25-visual-evidence-v4\";"
page = replace_once(page, old_brief, new_brief, "visible editorial brief v4")

old_direct = '''    const data = await response.json().catch(() => ({}));\n    if (!response.ok || !data?.ok) {\n      throw new Error(data?.message || `Gemini transcription failed (HTTP ${response.status}).`);\n    }\n    onUpdate("Transcript returned and timecodes validated.", 90);\n    return {\n      fileName: data.fileName || file.name,\n      transcript: data.transcript,\n      model: data.model || GEMINI_DIRECT_MODEL,\n      timecodes: data.timecodes === true,\n    };\n  };'''
new_direct = '''    const data = await response.json().catch(() => ({}));\n    if (!response.ok || !data?.ok) {\n      throw new Error(data?.message || `Gemini transcription failed (HTTP ${response.status}).`);\n    }\n\n    onUpdate("Gemini is creating a separate Visual Evidence Pass…", 82);\n    let visualEvidence = "";\n    let visualEvidenceAvailable = false;\n    let visualEvidenceModel = "";\n    try {\n      const visualResponse = await fetch("/api/visual-evidence-uploaded", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          uploadedFile: uploaded,\n          originalFile: file.name,\n          model: GEMINI_DIRECT_MODEL,\n        }),\n      });\n      const visualData = await visualResponse.json().catch(() => ({}));\n      if (visualResponse.ok && visualData?.ok && typeof visualData.visualEvidence === "string") {\n        visualEvidence = visualData.visualEvidence.trim();\n        visualEvidenceAvailable = Boolean(visualEvidence);\n        visualEvidenceModel = visualData.model || GEMINI_DIRECT_MODEL;\n      }\n    } catch {\n      // Visual evidence is an additive channel. A failed visual pass never corrupts\n      // or blocks an otherwise valid authentic transcript.\n    }\n\n    onUpdate(\n      visualEvidenceAvailable\n        ? "Transcript and separate timestamped visual evidence returned."\n        : "Transcript returned; visual evidence unavailable for this source.",\n      90,\n    );\n    return {\n      fileName: data.fileName || file.name,\n      transcript: data.transcript,\n      model: data.model || GEMINI_DIRECT_MODEL,\n      timecodes: data.timecodes === true,\n      visualEvidence,\n      visualEvidenceAvailable,\n      visualEvidenceModel,\n    };\n  };\n\n  const analyzeVisualEvidenceDirectly = async (\n    file: File,\n    apiKey: string,\n    onUpdate: (detail: string, percent: number) => void,\n  ): Promise<Pick<TranscriptResult, "visualEvidence" | "visualEvidenceAvailable" | "visualEvidenceModel">> => {\n    try {\n      onUpdate(`Uploading ${file.name} for the separate Visual Evidence Pass…`, 72);\n      const uploaded = await uploadVideoDirectlyToGemini(file);\n      await waitForGeminiVideo(uploaded.name, apiKey, onUpdate);\n      const response = await fetch("/api/visual-evidence-uploaded", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          uploadedFile: uploaded,\n          originalFile: file.name,\n          model: GEMINI_DIRECT_MODEL,\n        }),\n      });\n      const visualData = await response.json().catch(() => ({}));\n      if (!response.ok || !visualData?.ok || typeof visualData.visualEvidence !== "string") {\n        return { visualEvidence: "", visualEvidenceAvailable: false, visualEvidenceModel: "" };\n      }\n      return {\n        visualEvidence: visualData.visualEvidence.trim(),\n        visualEvidenceAvailable: Boolean(visualData.visualEvidence.trim()),\n        visualEvidenceModel: visualData.model || GEMINI_DIRECT_MODEL,\n      };\n    } catch {\n      return { visualEvidence: "", visualEvidenceAvailable: false, visualEvidenceModel: "" };\n    }\n  };'''
page = replace_once(page, old_direct, new_direct, "direct visual evidence call")

old_import = '''          model: "Imported validated transcript",\n          timecodes: data.timecodes === true,\n        },'''
new_import = '''          model: "Imported validated transcript",\n          timecodes: data.timecodes === true,\n          visualEvidence: "",\n          visualEvidenceAvailable: false,\n          visualEvidenceModel: "",\n        },'''
page = replace_once(page, old_import, new_import, "import transcript visual unavailable")

old_native = '''        results = result.results || [];\n      } else {'''
new_native = '''        results = result.results || [];\n        if (results.length && videoFiles[0]) {\n          const visual = await analyzeVisualEvidenceDirectly(\n            videoFiles[0],\n            geminiKey.trim(),\n            (detail, percent) => {\n              setProcessingDetail(detail);\n              setProcessingPercent(Math.max(70, percent));\n              setProcessingMessage(detail);\n            },\n          );\n          results = results.map((item, itemIndex) =>\n            itemIndex === 0 ? { ...item, ...visual } : item,\n          );\n        }\n      } else {'''
page = replace_once(page, old_native, new_native, "native visual evidence pass")

old_adjusted = '''          directResults.push({\n            ...directResult,\n            transcript: adjustedTranscript,\n          });'''
new_adjusted = '''          const adjustedVisualEvidence = (directResult.visualEvidence || "").replace(\n            /\\[?(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\]?/g,\n            (_match, a, b, c) => {\n              const localSeconds =\n                c === undefined\n                  ? Number(a) * 60 + Number(b)\n                  : Number(a) * 3600 + Number(b) * 60 + Number(c);\n              const totalSeconds = Math.max(\n                0,\n                Math.round(localSeconds + segment.startSeconds),\n              );\n              const hours = Math.floor(totalSeconds / 3600);\n              const minutes = Math.floor((totalSeconds % 3600) / 60);\n              const seconds = totalSeconds % 60;\n              return `[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;\n            },\n          );\n          directResults.push({\n            ...directResult,\n            transcript: adjustedTranscript,\n            visualEvidence: adjustedVisualEvidence,\n            visualEvidenceAvailable: Boolean(adjustedVisualEvidence.trim()),\n          });'''
page = replace_once(page, old_adjusted, new_adjusted, "visual evidence timeline offset")

old_transcript_text = '''  const transcriptText =\n    transcriptResults\n      .map((result) => `## ${result.fileName}\\n\\n${result.transcript}`)\n      .join("\\n\\n") ||\n    transcriptionMessage ||\n    "No transcript has been returned yet.";\n  const effectiveRuntimeSeconds ='''
new_transcript_text = '''  const visualEvidenceText = transcriptResults\n    .filter((result) => result.visualEvidenceAvailable && result.visualEvidence?.trim())\n    .map((result) => `## ${result.fileName}\\n\\n${result.visualEvidence}`)\n    .join("\\n\\n");\n  const transcriptText =\n    transcriptResults\n      .map((result) => `## ${result.fileName}\\n\\n${result.transcript}`)\n      .join("\\n\\n") ||\n    transcriptionMessage ||\n    "No transcript has been returned yet.";\n  const effectiveRuntimeSeconds ='''
page = replace_once(page, old_transcript_text, new_transcript_text, "separate evidence text")

old_generation_body = '''          transcript: transcriptText,\n          prompt: voiceoverPrompt,'''
new_generation_body = '''          transcript: transcriptText,\n          visualEvidence: visualEvidenceText,\n          prompt: voiceoverPrompt,'''
page = replace_once(page, old_generation_body, new_generation_body, "send visual evidence to editor")

old_ui = '''                  <pre className="transcript-text">{transcriptText}</pre>\n                  <div className="document-actions">'''
new_ui = '''                  <pre className="transcript-text">{transcriptText}</pre>\n                  <div className="knowledge-note">\n                    <span>{visualEvidenceText ? "◉" : "○"}</span>\n                    <div>\n                      <b>Visual Evidence Pass · {visualEvidenceText ? "AVAILABLE" : "UNAVAILABLE"}</b>\n                      <p>\n                        {visualEvidenceText\n                          ? "A separate timestamped visual evidence log is active for editorial authorship. It is never merged into or exported as the authentic transcript."\n                          : "Visual evidence unavailable. DANA will use the authentic transcript only and must not invent visual details."}\n                      </p>\n                    </div>\n                  </div>\n                  {visualEvidenceText ? (\n                    <details>\n                      <summary>View timestamped visual evidence</summary>\n                      <pre className="transcript-text">{visualEvidenceText}</pre>\n                    </details>\n                  ) : null}\n                  <div className="document-actions">'''
page = replace_once(page, old_ui, new_ui, "visual evidence UI")

page_path.write_text(page)

# --- app/api/generate-voiceover/route.ts ---
route_path = Path("app/api/generate-voiceover/route.ts")
route = route_path.read_text()

route = replace_once(
    route,
    '''  transcript?: string;\n  prompt?: string;''',
    '''  transcript?: string;\n  visualEvidence?: string;\n  prompt?: string;''',
    "VoiceoverInput visualEvidence",
)

route = replace_once(
    route,
    '''- Ground the Second Story in observable or audible evidence. Use real claims, behaviour, timing, reactions, objects, silences or reversals as anchors, then create original language and an original editorial angle around them.''',
    '''- Ground the Second Story in the two factual evidence channels supplied by DANA: the authentic transcript for spoken words and the Visual Evidence Pass for observable non-verbal facts. Use real claims, behaviour, timing, reactions, objects, silences or reversals as anchors, then create original language and an original editorial angle around them.\n- Treat visual evidence as observation, never as ready-made interpretation. DANA may interpret it editorially only after grounding the claim and must qualify uncertain emotional readings.''',
    "Second Story evidence channels",
)

route = replace_once(
    route,
    '''  const references = referenceContentBlock(body);\n  if (isLepersTone(selectedTone)) {''',
    '''  const references = referenceContentBlock(body);\n  const visualEvidence = body.visualEvidence?.trim()\n    ? body.visualEvidence.trim()\n    : "VISUAL EVIDENCE UNAVAILABLE — transcript-only source. Do not invent visual actions, reactions, objects, gestures or off-camera facts.";\n  if (isLepersTone(selectedTone)) {''',
    "visual evidence prompt variable",
)

route = replace_once(
    route,
    '''APPLIED REFERENCE CONTENT:\n${references}\n\nCURRENT SOURCE TRANSCRIPT — THIS IS THE FACTUAL SOURCE OF TRUTH:\n${body.transcript}`;''',
    '''APPLIED REFERENCE CONTENT:\n${references}\n\nVISUAL EVIDENCE — OBSERVABLE FACTS ONLY, NOT EDITORIAL INTERPRETATION:\n${visualEvidence}\n\nEVIDENCE DISCIPLINE: the authentic transcript is the factual source of truth for spoken words. The Visual Evidence Pass is a separate factual observation channel for what is directly visible or non-verbally audible. Do not convert a visual observation into motive, emotion or causality unless the source supports it; uncertain interpretation must remain qualified.\n\nCURRENT SOURCE TRANSCRIPT — THIS IS THE FACTUAL SOURCE OF TRUTH FOR DIALOGUE:\n${body.transcript}`;''',
    "Lepers evidence channels",
)

route = replace_once(
    route,
    '''APPLIED REFERENCE CONTENT:\n${references}\n\nSOURCE TRANSCRIPT:\n${body.transcript}`;''',
    '''APPLIED REFERENCE CONTENT:\n${references}\n\nVISUAL EVIDENCE — OBSERVABLE FACTS ONLY, NOT EDITORIAL INTERPRETATION:\n${visualEvidence}\n\nEVIDENCE DISCIPLINE: transcript = factual spoken-word channel; Visual Evidence Pass = factual observable channel. Editorial interpretation is DANA's separate layer and must never be presented as an observed fact when uncertain.\n\nSOURCE TRANSCRIPT — FACTUAL DIALOGUE SOURCE OF TRUTH:\n${body.transcript}`;''',
    "selective VO evidence channels",
)

route_path.write_text(route)

# --- keep existing brief tests aligned with the new visible v4 copy ---
default_test_path = Path("tests/default-editorial-brief.test.mjs")
default_test = default_test_path.read_text()
default_test = default_test.replace(
    "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect the footage—create a bold Second Story from verified reality using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.",
    "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect—create a bold Second Story from verified dialogue + visual evidence using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.",
)
default_test = default_test.replace("/verified reality/i", "/verified dialogue \\+ visual evidence/i")
default_test = default_test.replace('"2026-08-25-second-story-v3"', '"2026-08-25-visual-evidence-v4"')
default_test_path.write_text(default_test)

second_test_path = Path("tests/second-story-editorial-authorship.test.mjs")
second_test = second_test_path.read_text().replace(
    '/EDITORIAL_BRIEF_SCHEMA_VERSION\\s*=\\s*"2026-08-25-second-story-v3"/',
    '/EDITORIAL_BRIEF_SCHEMA_VERSION\\s*=\\s*"2026-08-25-visual-evidence-v4"/',
)
second_test_path.write_text(second_test)
