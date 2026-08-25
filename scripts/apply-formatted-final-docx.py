from pathlib import Path

path = Path("app/page.tsx")
text = path.read_text()

needle = 'import { createFile as createMp4File } from "mp4box";\n'
replacement = needle + 'import { buildFormattedProductionDocx } from "./lib/formatted-production-docx";\n'
if 'buildFormattedProductionDocx' not in text:
    if needle not in text:
        raise SystemExit("Could not find import anchor")
    text = text.replace(needle, replacement, 1)

start = text.find('  const exportVoiceoverDocx = async () => {')
end = text.find('  const exportPdf = async () => {', start)
if start < 0 or end < 0:
    raise SystemExit("Could not find voice-over DOCX export function")

new_function = '''  const exportVoiceoverDocx = async () => {\n    if (!voiceoverDraft.trim()) {\n      setVoiceoverMessage("Generate a voice-over before downloading the final document.");\n      return;\n    }\n    const title = fileName || "GIV production workspace";\n    const exportedAt = new Date().toLocaleString("lv-LV");\n    const ratioLine = voiceoverMetrics\n      ? `Ratio: ${voiceoverMetrics.ratioPercent}% · ${voiceoverMetrics.words} words · ${voiceoverMetrics.spokenSeconds}s spoken`\n      : "Ratio metrics unavailable.";\n    const doc = buildFormattedProductionDocx({\n      markdown: voiceoverDraft,\n      fileName: title,\n      tone: voiceoverTone,\n      exportedAt,\n      ratioLine,\n    });\n    const safeName = title\n      .replace(/\\.[^.]+$/, "")\n      .replace(/[^A-Za-z0-9ĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]+/g, "_")\n      .replace(/^_+|_+$/g, "") || "DANA_AI";\n    downloadBlob(\n      await Packer.toBlob(doc),\n      `${safeName}_Production_Analysis_and_VO_Formatted.docx`,\n    );\n    setVoiceoverMessage("Production-ready formatted DOCX downloaded successfully.");\n  };\n'''
text = text[:start] + new_function + text[end:]
text = text.replace('Download final DOCX', 'Download formatted final DOCX')

path.write_text(text)
print("Formatted production DOCX integration applied")
