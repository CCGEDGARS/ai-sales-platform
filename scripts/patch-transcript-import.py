from pathlib import Path

# Apply the transcript re-import workflow to the live DANA production UI.
PAGE = Path("app/page.tsx")
text = PAGE.read_text()

ref_anchor = '''  const fileInput = useRef<HTMLInputElement>(null);\n  const sourceInput = useRef<HTMLInputElement>(null);\n  const segmentInput = useRef<HTMLInputElement>(null);\n'''
ref_replacement = '''  const fileInput = useRef<HTMLInputElement>(null);\n  const sourceInput = useRef<HTMLInputElement>(null);\n  const segmentInput = useRef<HTMLInputElement>(null);\n  const transcriptImportInput = useRef<HTMLInputElement>(null);\n'''
if "transcriptImportInput" not in text:
    if ref_anchor not in text:
        raise SystemExit("Transcript import ref anchor not found")
    text = text.replace(ref_anchor, ref_replacement, 1)

choose_anchor = '''  const chooseFile = () => fileInput.current?.click();\n  const onFiles = (files?: FileList | null) => {\n'''
import_logic = '''  const inferRuntimeFromTranscript = (value: string) => {\n    const matches = Array.from(\n      value.matchAll(/(?:^|\\n)\\s*\\[?(\\d{2}):(\\d{2}):(\\d{2})\\]?/g),\n    );\n    const latest = matches.reduce((max, match) => {\n      const seconds =\n        Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);\n      return Math.max(max, seconds);\n    }, 0);\n    return latest > 0 ? latest + 2 : 0;\n  };\n  const chooseTranscriptImport = () => transcriptImportInput.current?.click();\n  const onTranscriptImport = async (files?: FileList | null) => {\n    const file = files?.[0];\n    if (!file) return;\n    setTranscriptionMessage(`Importing ${file.name}…`);\n    try {\n      const form = new FormData();\n      form.append("file", file);\n      const response = await fetch("/api/import-transcript", {\n        method: "POST",\n        body: form,\n      });\n      const data = await response.json().catch(() => ({}));\n      if (!response.ok || !data?.ok || !data?.transcript) {\n        throw new Error(\n          data?.message || `Transcript import failed (HTTP ${response.status}).`,\n        );\n      }\n      const importedTranscript = String(data.transcript).trim();\n      const runtimeSeconds =\n        Number(data.runtimeSeconds) || inferRuntimeFromTranscript(importedTranscript);\n      if (!runtimeSeconds) {\n        throw new Error(\n          "The imported transcript has no usable HH:MM:SS timecodes, so DANA AI cannot calculate the voice-over ratio.",\n        );\n      }\n      setTranscriptResults([\n        {\n          fileName: data.fileName || file.name,\n          transcript: importedTranscript,\n          model: "Imported validated transcript",\n          timecodes: data.timecodes === true,\n        },\n      ]);\n      setFinalRuntimeSeconds(runtimeSeconds);\n      setFileName(data.fileName || file.name);\n      setProcessed(true);\n      setVoiceoverDraft("");\n      setVoiceoverMetrics(null);\n      setVoiceoverStatus("idle");\n      setVoiceoverMessage("");\n      setTranscriptionMessage(\n        `Imported ${file.name}. Timecoded transcript restored; voice-over is unlocked. Runtime inferred as ${formatElapsed(runtimeSeconds)} from the final timecode.`,\n      );\n      setProjectMessage(\n        "Existing transcript imported successfully. You can proceed directly to Voice-over without retranscribing the video.",\n      );\n    } catch (error) {\n      setTranscriptionMessage(\n        error instanceof Error ? error.message : "Transcript import failed.",\n      );\n    } finally {\n      if (transcriptImportInput.current) transcriptImportInput.current.value = "";\n    }\n  };\n  const chooseFile = () => fileInput.current?.click();\n  const onFiles = (files?: FileList | null) => {\n'''
if "const onTranscriptImport" not in text:
    if choose_anchor not in text:
        raise SystemExit("Transcript import function anchor not found")
    text = text.replace(choose_anchor, import_logic, 1)

input_anchor = '''        <input\n          ref={segmentInput}\n          type="file"\n          accept="video/*"\n          multiple\n          hidden\n          onChange={(e) => onSegments(e.target.files)}\n        />\n'''
input_replacement = input_anchor + '''        <input\n          ref={transcriptImportInput}\n          type="file"\n          accept=".txt,.srt,.vtt,.docx"\n          hidden\n          onChange={(e) => void onTranscriptImport(e.target.files)}\n        />\n'''
if 'accept=".txt,.srt,.vtt,.docx"' not in text:
    if input_anchor not in text:
        raise SystemExit("Transcript import input anchor not found")
    text = text.replace(input_anchor, input_replacement, 1)

processed_actions_anchor = '''                  <div className="document-actions">\n                    <button type="button" className="export-btn" onClick={saveTimecodeDocument}>\n                      Save timecode document\n                    </button>\n                    <button type="button" className="export-btn" onClick={() => void exportDocx()}>\n                      Download timecode DOCX\n                    </button>\n                  </div>\n'''
processed_actions_replacement = '''                  <div className="document-actions">\n                    <button type="button" className="export-btn" onClick={saveTimecodeDocument}>\n                      Save timecode document\n                    </button>\n                    <button type="button" className="export-btn" onClick={() => void exportDocx()}>\n                      Download timecode DOCX\n                    </button>\n                    <button type="button" className="export-btn" onClick={chooseTranscriptImport}>\n                      Replace / import transcript\n                    </button>\n                  </div>\n'''
if "Replace / import transcript" not in text:
    if processed_actions_anchor not in text:
        raise SystemExit("Processed transcript action anchor not found")
    text = text.replace(processed_actions_anchor, processed_actions_replacement, 1)

placeholder_anchor = '''                <div className="transcript-placeholder">\n                  The validated transcript will appear here after transcription.\n                </div>\n'''
placeholder_replacement = '''                <div className="transcript-placeholder transcript-import-placeholder">\n                  <b>Already have the transcript?</b>\n                  <span>Import a previously downloaded DANA transcript and continue directly to voice-over. TXT, SRT, VTT and DOCX are supported.</span>\n                  <button\n                    type="button"\n                    className="primary-btn"\n                    onClick={chooseTranscriptImport}\n                  >\n                    Import existing transcript\n                  </button>\n                </div>\n'''
if "Import existing transcript" not in text:
    if placeholder_anchor not in text:
        raise SystemExit("Transcript placeholder anchor not found")
    text = text.replace(placeholder_anchor, placeholder_replacement, 1)

PAGE.write_text(text)
print("Transcript import UI patched")
