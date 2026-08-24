from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected source block not found: {label}")
    return text.replace(old, new, 1)


page_path = Path("app/page.tsx")
page = page_path.read_text(encoding="utf-8")

page = replace_once(
    page,
    '''      setFinalRuntimeSeconds(durations.reduce((total, duration) => total + duration, 0));
      for (let index = 0; index < videoFiles.length; index += 1) {''',
    '''      setFinalRuntimeSeconds(durations.reduce((total, duration) => total + duration, 0));
      let cumulativeStartSeconds = 0;
      for (let index = 0; index < videoFiles.length; index += 1) {''',
    "cumulative multi-file timeline",
)

page = replace_once(
    page,
    '''        segments.push({ file, startSeconds: 0, originalFile: file.name });
      }''',
    '''        segments.push({
          file,
          startSeconds: cumulativeStartSeconds,
          originalFile: file.name,
        });
        cumulativeStartSeconds += durations[index] || 0;
      }''',
    "multi-file segment offsets",
)

page = replace_once(
    page,
    '''          directResults.push(directResult);''',
    '''          const adjustedTranscript = directResult.transcript.replace(
            /\\[?(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\]?/g,
            (_match, a, b, c) => {
              const localSeconds =
                c === undefined
                  ? Number(a) * 60 + Number(b)
                  : Number(a) * 3600 + Number(b) * 60 + Number(c);
              const totalSeconds = Math.max(
                0,
                Math.round(localSeconds + segment.startSeconds),
              );
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              return `[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
            },
          );
          directResults.push({
            ...directResult,
            transcript: adjustedTranscript,
          });''',
    "direct Gemini multi-file offsets",
)

old_export = '''    const body =
      kind === "srt"
        ? transcriptResults.length
          ? transcriptResults[0].transcript
              .split(/\\r?\\n/)
              .filter(Boolean)
              .map((line, index, all) => {
                const match = line.match(
                  /^\\s*\\[?(\\d{2}):(\\d{2}):(\\d{2})\\]?\\s*(.*)$/,
                );
                if (!match)
                  throw new Error(
                    "SRT export blocked: every transcript line must have a validated timecode.",
                  );
                const [, h, m, s, text] = match;
                const start = Number(h) * 3600 + Number(m) * 60 + Number(s);
                const next = all[index + 1]?.match(
                  /^\\s*\\[?(\\d{2}):(\\d{2}):(\\d{2})\\]?/,
                );
                const end = next
                  ? Number(next[1]) * 3600 +
                    Number(next[2]) * 60 +
                    Number(next[3])
                  : start + 2;
                const eh = String(Math.floor(end / 3600)).padStart(2, "0");
                const em = String(Math.floor((end % 3600) / 60)).padStart(
                  2,
                  "0",
                );
                const es = String(end % 60).padStart(2, "0");
                return `${index + 1}\\n${h}:${m}:${s},000 --> ${eh}:${em}:${es},000\\n${text}\\n`;
              })
              .join("\\n")
          : ""
        : `DANA AI PRODUCTION STUDIO\\n${title}\\n\\nExported: ${new Date().toLocaleString("lv-LV")}\\nStatus: ${uploaded ? (processed ? "Transcript returned" : "Video queued") : "No video uploaded"}\\nGemini: ${geminiStatus}\\nChunk length: ${chunkLength} minutes\\n\\n${transcriptText}`;'''
new_export = '''    const srtLines = transcriptResults.flatMap((result) =>
      result.transcript.split(/\\r?\\n/).filter(Boolean),
    );
    const body =
      kind === "srt"
        ? srtLines
            .map((line, index, all) => {
              const match = line.match(
                /^\\s*\\[?(\\d{2}):(\\d{2}):(\\d{2})\\]?\\s*(.*)$/,
              );
              if (!match)
                throw new Error(
                  "SRT export blocked: every transcript line must have a validated timecode.",
                );
              const [, h, m, s, text] = match;
              const start = Number(h) * 3600 + Number(m) * 60 + Number(s);
              const next = all[index + 1]?.match(
                /^\\s*\\[?(\\d{2}):(\\d{2}):(\\d{2})\\]?/,
              );
              const nextSeconds = next
                ? Number(next[1]) * 3600 +
                  Number(next[2]) * 60 +
                  Number(next[3])
                : start + 2;
              const end = Math.max(start + 1, nextSeconds);
              const eh = String(Math.floor(end / 3600)).padStart(2, "0");
              const em = String(Math.floor((end % 3600) / 60)).padStart(
                2,
                "0",
              );
              const es = String(end % 60).padStart(2, "0");
              return `${index + 1}\\n${h}:${m}:${s},000 --> ${eh}:${em}:${es},000\\n${text}\\n`;
            })
            .join("\\n")
        : `DANA AI PRODUCTION STUDIO\\n${title}\\n\\nExported: ${new Date().toLocaleString("lv-LV")}\\nStatus: ${uploaded ? (processed ? "Transcript returned" : "Video queued") : "No video uploaded"}\\nGemini: ${geminiStatus}\\nChunk length: ${chunkLength} minutes\\n\\n${transcriptText}`;'''
page = replace_once(page, old_export, new_export, "multi-file SRT export")

page_path.write_text(page, encoding="utf-8")
print("DANA multi-file timeline and SRT fixes applied successfully.")
