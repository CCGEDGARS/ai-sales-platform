from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected source block not found: {label}")
    return text.replace(old, new, 1)


page_path = Path("app/page.tsx")
page = page_path.read_text(encoding="utf-8")

page = replace_once(
    page,
    'import { PDFDocument, StandardFonts, rgb } from "pdf-lib";\n',
    '',
    "obsolete pdf-lib import",
)

old_health_effect = '''  useEffect(() => {
    fetch("/api/engine-status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setNativeFfmpeg(Boolean(data?.nativeFfmpeg)))
      .catch(() => setNativeFfmpeg(false));
  }, []);'''
new_health_effect = '''  useEffect(() => {
    let cancelled = false;
    fetch("/api/system-health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const geminiConnected =
          data?.gemini?.configured === true && data?.gemini?.signal === "healthy";
        const openAIConnected =
          data?.openai?.configured === true && data?.openai?.signal === "healthy";
        setGeminiStatus(
          geminiConnected
            ? "Connected"
            : data?.gemini?.signal === "problem"
              ? "Connection failed"
              : "Not configured",
        );
        setOpenAIStatus(
          openAIConnected
            ? "Connected"
            : data?.openai?.signal === "problem"
              ? "Connection failed"
              : "Not configured",
        );
        setNativeFfmpeg(data?.ffmpeg?.signal === "healthy");
        if (geminiConnected)
          setGeminiMessage("Saved Gemini connection restored securely.");
        if (openAIConnected)
          setOpenAIMessage("Saved OpenAI connection restored securely.");
      })
      .catch(() => {
        if (!cancelled) setNativeFfmpeg(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);'''
page = replace_once(page, old_health_effect, new_health_effect, "connection hydration effect")

page = replace_once(
    page,
    '      "Testing the live Gemini connection. The key is used only for this session and is not persisted by this app.",',
    '      "Testing the live Gemini connection. After validation, the key is stored securely in an HTTP-only cookie on this device for up to 180 days.",',
    "Gemini persistence message",
)

openai_test_pattern = re.compile(
    r'  const testOpenAIConnection = \(\) => \{.*?\n  \};\n  const saveGeminiKey',
    re.S,
)
openai_test_replacement = '''  const testOpenAIConnection = async () => {
    setOpenAIStatus("Saving and testing…");
    setOpenAIMessage("Testing the saved OpenAI connection.");
    try {
      const response = await fetch("/api/openai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openAIKey.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(result.message || "OpenAI connection failed.");
      setOpenAIStatus("Connected");
      setOpenAIMessage(`Connection verified successfully to ${result.model}.`);
    } catch (error) {
      setOpenAIStatus("Connection failed");
      setOpenAIMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const saveGeminiKey'''
page, count = openai_test_pattern.subn(openai_test_replacement, page, count=1)
if count != 1:
    raise SystemExit("Expected source block not found: OpenAI retest")

gemini_test_pattern = re.compile(
    r'  const testGeminiConnection = \(\) => \{.*?\n  \};\n  const refreshStatus',
    re.S,
)
gemini_test_replacement = '''  const testGeminiConnection = async () => {
    setGeminiStatus("Saving and testing…");
    setGeminiMessage("Testing the saved Gemini connection.");
    try {
      const response = await fetch("/api/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: geminiKey.trim(),
          model: GEMINI_DIRECT_MODEL,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Gemini connection failed.");
      setGeminiStatus("Connected");
      setGeminiMessage(`Connection verified successfully to ${result.model}.`);
    } catch (error) {
      setGeminiStatus("Connection failed");
      setGeminiMessage(
        error instanceof Error
          ? `Connection failed: ${error.message}`
          : "Connection failed.",
      );
    }
  };
  const refreshStatus'''
page, count = gemini_test_pattern.subn(gemini_test_replacement, page, count=1)
if count != 1:
    raise SystemExit("Expected source block not found: Gemini retest")

refresh_pattern = re.compile(
    r'  const refreshStatus = async \(\) => \{.*?\n  \};\n  const generateVoiceover',
    re.S,
)
refresh_replacement = '''  const refreshStatus = async () => {
    setRefreshing(true);
    setExportMessage("");
    try {
      const response = await fetch("/api/system-health", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("System health check failed.");
      const geminiConnected =
        data?.gemini?.configured === true && data?.gemini?.signal === "healthy";
      const openAIConnected =
        data?.openai?.configured === true && data?.openai?.signal === "healthy";
      setGeminiStatus(
        geminiConnected
          ? "Connected"
          : data?.gemini?.signal === "problem"
            ? "Connection failed"
            : "Not configured",
      );
      setOpenAIStatus(
        openAIConnected
          ? "Connected"
          : data?.openai?.signal === "problem"
            ? "Connection failed"
            : "Not configured",
      );
      setNativeFfmpeg(data?.ffmpeg?.signal === "healthy");
      setGeminiMessage(data?.gemini?.message || "Gemini status refreshed.");
      setOpenAIMessage(data?.openai?.message || "OpenAI status refreshed.");
      setExportMessage(
        data?.ffmpeg?.signal === "healthy"
          ? "System status refreshed. Native FFmpeg is online."
          : data?.ffmpeg?.message || "System status refreshed.",
      );
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "System status refresh failed.",
      );
    } finally {
      setRefreshing(false);
    }
  };
  const generateVoiceover'''
page, count = refresh_pattern.subn(refresh_replacement, page, count=1)
if count != 1:
    raise SystemExit("Expected source block not found: refreshStatus")

voiceover_gate = '''    if (!openAIKey.trim()) {
      setShowSettings(true);
      setShowOpenAIEditor(true);
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Connect OpenAI first. The voice-over generator uses the connected OpenAI API.",
      );
      return;
    }'''
voiceover_gate_fixed = '''    if (openAIStatus !== "Connected") {
      setShowSettings(true);
      setShowOpenAIEditor(true);
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Connect OpenAI first. The voice-over generator uses the connected OpenAI API.",
      );
      return;
    }'''
page = replace_once(page, voiceover_gate, voiceover_gate_fixed, "voice-over restored-key gate")

start_gate = '''    if (geminiStatus !== "Connected") {
      setShowSettings(true);
      setShowGeminiEditor(true);
      setGeminiMessage(
        "Gemini is not connected yet. Save a valid API key and wait for a successful connection test before starting transcription.",
      );
      return;
    }
    setPreferredTool("Gemini 3.6 Flash");'''
start_gate_fixed = '''    if (geminiStatus !== "Connected") {
      setShowSettings(true);
      setShowGeminiEditor(true);
      setGeminiMessage(
        "Gemini is not connected yet. Save a valid API key and wait for a successful connection test before starting transcription.",
      );
      return;
    }
    if (!nativeFfmpeg && !geminiKey.trim()) {
      setShowSettings(true);
      setShowGeminiEditor(true);
      setGeminiMessage(
        "The native FFmpeg worker is offline. Re-enter the Gemini API key to use the direct browser fallback securely for this run.",
      );
      return;
    }
    setPreferredTool("Gemini 3.6 Flash");'''
page = replace_once(page, start_gate, start_gate_fixed, "worker-offline direct fallback guard")

old_dropzone = '''              <div
                className={uploaded ? "dropzone uploaded" : "dropzone"}
                onClick={chooseFile}
              >'''
new_dropzone = '''              <div
                className={uploaded ? "dropzone uploaded" : "dropzone"}
                onClick={chooseFile}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onFiles(e.dataTransfer.files);
                }}
              >'''
page = replace_once(page, old_dropzone, new_dropzone, "dropzone handlers")

page = replace_once(
    page,
    "              pipeline. Keys are never displayed after saving.",
    "              pipeline. Keys are stored in secure HTTP-only cookies for up to 180 days on this device and are never displayed after saving.",
    "settings credential copy",
)
page = replace_once(
    page,
    "            <span>Session-only prototype archive</span>",
    "            <span>Device-local production archive</span>",
    "voice-over archive label",
)

page = replace_once(
    page,
    '''            <button type="button" className="outline-btn">
              ＋ Add another integration
            </button>''',
    '''            <button
              type="button"
              className="outline-btn"
              disabled
              title="Gemini, native FFmpeg and OpenAI are the supported production integrations in this version."
            >
              Supported integrations are already configured
            </button>''',
    "dead integration button",
)

pdf_pattern = re.compile(
    r'  const exportPdf = async \(\) => \{.*?\n  \};\n\n  const navigateTo',
    re.S,
)
pdf_replacement = '''  const exportPdf = async () => {
    if (!processed || !transcriptResults.length) {
      setExportMessage(
        "Export is blocked until a real validated transcript is returned.",
      );
      return;
    }
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return entities[character] || character;
      });
    const popup = window.open("", "_blank");
    if (!popup) {
      setExportMessage(
        "PDF export was blocked by the browser. Allow pop-ups for this site and try again.",
      );
      return;
    }
    popup.opener = null;
    const title = fileName || "GIV production workspace";
    popup.document.write(`<!doctype html><html lang="lv"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{margin:18mm}body{font-family:Arial,Helvetica,sans-serif;color:#17221d;line-height:1.45}h1{font-size:20px;margin:0 0 6px}p{font-size:11px;color:#4b5a52}pre{font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:20px}</style></head><body><h1>DANA AI PRODUCTION STUDIO</h1><p>${escapeHtml(title)} · Exported ${escapeHtml(new Date().toLocaleString("lv-LV"))}</p><pre>${escapeHtml(transcriptText)}</pre></body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
    setExportMessage('PDF print view opened. Choose “Save as PDF” in the browser print dialog.');
  };

  const navigateTo'''
page, count = pdf_pattern.subn(pdf_replacement, page, count=1)
if count != 1:
    raise SystemExit("Expected source block not found: exportPdf")

page_path.write_text(page, encoding="utf-8")

transcribe_path = Path("app/api/transcribe/route.ts")
transcribe = transcribe_path.read_text(encoding="utf-8")
transcribe = replace_once(
    transcribe,
    'import { NextResponse } from "next/server";\n',
    'import { NextResponse } from "next/server";\nimport { getStoredKey } from "../../lib/credentials";\n',
    "transcribe credentials import",
)
transcribe = replace_once(
    transcribe,
    '    const apiKey = String(form.get("apiKey") || "").trim();\n',
    '    const submittedKey = String(form.get("apiKey") || "").trim();\n    const apiKey = submittedKey || await getStoredKey("gemini");\n',
    "transcribe stored-key fallback",
)
transcribe_path.write_text(transcribe, encoding="utf-8")

layout_path = Path("app/layout.tsx")
layout = layout_path.read_text(encoding="utf-8")
layout = replace_once(
    layout,
    '  other: {\n    "codex-preview": "development",\n  },\n',
    '',
    "development preview metadata",
)
layout_path.write_text(layout, encoding="utf-8")

package_path = Path("package.json")
package = package_path.read_text(encoding="utf-8")
package = replace_once(
    package,
    '"node": ">=22.13.0"',
    '"node": "24.x"',
    "Node engine pin",
)
package_path.write_text(package, encoding="utf-8")

print("DANA production source fixes applied successfully.")
