from pathlib import Path
import re

PAGE = Path("app/page.tsx")
text = PAGE.read_text()

APPLIED_EFFECT = '''  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dana-ai-applied-sources",
        JSON.stringify(appliedSources),
      );
    } catch {}
  }, [appliedSources]);
'''

PERSISTENCE = '''  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("dana-ai-transcript-session");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        transcriptResults?: TranscriptResult[];
        finalRuntimeSeconds?: number;
        fileName?: string;
      };
      if (Array.isArray(saved.transcriptResults) && saved.transcriptResults.length) {
        setTranscriptResults(saved.transcriptResults);
        setFinalRuntimeSeconds(Number(saved.finalRuntimeSeconds) || 0);
        setFileName(saved.fileName || saved.transcriptResults[0]?.fileName || "");
        setProcessed(true);
        setUploaded(true);
        setTranscriptionMessage("Validated transcript restored from this device.");
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!processed || !transcriptResults.length) return;
    try {
      window.localStorage.setItem(
        "dana-ai-transcript-session",
        JSON.stringify({ transcriptResults, finalRuntimeSeconds, fileName }),
      );
    } catch {}
  }, [processed, transcriptResults, finalRuntimeSeconds, fileName]);
'''

if "dana-ai-transcript-session" not in text:
    if APPLIED_EFFECT not in text:
        raise SystemExit("Could not locate applied-sources persistence effect")
    text = text.replace(APPLIED_EFFECT, APPLIED_EFFECT + PERSISTENCE, 1)

NEW_VOICEOVER = r'''  const pollVoiceoverJob = async (
    responseId: string,
    pollCount = 0,
  ): Promise<void> => {
    if (pollCount > 360) {
      window.localStorage.removeItem("dana-ai-pending-voiceover");
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "OpenAI is still processing after 15 minutes. The job was left safely in OpenAI; press Write voice-over draft to start a new run if needed.",
      );
      return;
    }
    try {
      const response = await fetch(
        `/api/generate-voiceover?responseId=${encodeURIComponent(responseId)}`,
        { cache: "no-store" },
      );
      const raw = await response.text();
      let result: Record<string, any> = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Voice-over service returned HTTP ${response.status} without JSON${raw ? `: ${raw.slice(0, 220)}` : "."}`,
        );
      }
      if (!response.ok || !result.ok) {
        throw new Error(
          String(result.message || `Voice-over job check failed (HTTP ${response.status}).`),
        );
      }
      const nextId = String(result.responseId || responseId);
      if (result.status === "completed" && typeof result.text === "string" && result.text.trim()) {
        window.localStorage.removeItem("dana-ai-pending-voiceover");
        setVoiceoverDraft(result.text);
        setVoiceoverMetrics(result.metrics || null);
        setVoiceoverStatus("generated");
        setVoiceoverMessage(
          result.ratioWarning
            ? `Voice-over generated with ${result.model}. Editorial draft is ready; ratio is ${result.metrics?.ratioPercent ?? "—"}% and needs a final timing review.`
            : `Generated successfully with ${result.model}. Ratio gate passed: ${result.metrics?.ratioPercent ?? "—"}% of runtime. Review before saving.`,
        );
        return;
      }
      if (result.status === "queued" || result.status === "in_progress") {
        window.localStorage.setItem("dana-ai-pending-voiceover", nextId);
        setVoiceoverStatus("generating");
        setVoiceoverMessage(
          result.phase === "correction"
            ? "Voice-over draft is ready and DANA AI is automatically correcting the mandatory narration ratio…"
            : "OpenAI is generating the voice-over in a durable background job. You can keep this page open while it finishes…",
        );
        window.setTimeout(() => {
          void pollVoiceoverJob(nextId, pollCount + 1);
        }, 2500);
        return;
      }
      throw new Error(`Unexpected voice-over job status: ${String(result.status || "unknown")}.`);
    } catch (error) {
      window.localStorage.removeItem("dana-ai-pending-voiceover");
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        error instanceof Error ? error.message : "Voice-over generation failed.",
      );
    }
  };
  const generateVoiceover = async () => {
    if (!processed || !transcriptResults.length) {
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Generate is blocked until a real validated transcript exists.",
      );
      return;
    }
    if (openAIStatus !== "Connected") {
      setShowSettings(true);
      setShowOpenAIEditor(true);
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        "Connect OpenAI first. The voice-over generator uses the connected OpenAI API.",
      );
      return;
    }
    setVoiceoverStatus("generating");
    setVoiceoverMessage("Starting a durable OpenAI background voice-over job…");
    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DANA-Voiceover-Mode": "background",
        },
        body: JSON.stringify({
          apiKey: openAIKey.trim(),
          transcript: transcriptText,
          prompt: voiceoverPrompt,
          tone: voiceoverTone,
          context: buildReferenceBrief(appliedSources),
          appliedSources,
          finalRuntimeSeconds,
        }),
      });
      const raw = await response.text();
      let result: Record<string, any> = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Voice-over service returned HTTP ${response.status} without JSON${raw ? `: ${raw.slice(0, 220)}` : "."}`,
        );
      }
      if (!response.ok || !result.ok) {
        throw new Error(
          String(result.message || `Voice-over job could not start (HTTP ${response.status}).`),
        );
      }
      const responseId = String(result.responseId || "");
      if (!responseId) throw new Error("OpenAI started no retrievable voice-over job.");
      window.localStorage.setItem("dana-ai-pending-voiceover", responseId);
      setVoiceoverMessage("Voice-over job started. Waiting for OpenAI to finish…");
      await pollVoiceoverJob(responseId);
    } catch (error) {
      window.localStorage.removeItem("dana-ai-pending-voiceover");
      setVoiceoverStatus("failed");
      setVoiceoverMessage(
        error instanceof Error ? error.message : "Voice-over generation failed.",
      );
    }
  };
'''

pattern = re.compile(r'  const generateVoiceover = async \(\) => \{[\s\S]*?\n  \};\n  const saveVoiceover = \(\) => \{')
replacement = NEW_VOICEOVER + '  const saveVoiceover = () => {'
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"Could not replace generateVoiceover block; matches={count}")

text = text.replace(
    "GPT-5.6 Sol · high reasoning",
    "GPT-5.6 Sol · durable background generation",
)
text = text.replace(
    "Frontier editorial generation model. A GPT-5.4 fallback is used only if the connected API cannot serve GPT-5.6 Sol.",
    "Frontier editorial generation runs as a durable OpenAI background job. GPT-5.6 Terra is the automatic fallback and ratio-correction model.",
)

PAGE.write_text(text)
print("Patched app/page.tsx for durable background voice-over generation")
