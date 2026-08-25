from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing anchor: {label}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one regex match for {label}, got {count}")
    return updated

# ---------------------------------------------------------------------------
# Voice-over: server-side workspace learning retrieval
# ---------------------------------------------------------------------------
path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()
text = replace_once(
    text,
    'import { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";\n',
    'import { LEPERS_PRODUCTION_PACKAGE_CONTRACT, LEPERS_REQUIRED_SECTIONS } from "../../lib/lepers-standard";\nimport { buildWorkspaceLearningContext } from "../../lib/workspace-learning";\n',
    "voice-over learning import",
)
text = replace_once(
    text,
    '    const { selectedTone, system, user } = prompts(body, finalRuntimeSeconds);\n',
    '''    let workspaceLearning = "";\n    try {\n      workspaceLearning = await buildWorkspaceLearningContext(request, {\n        activity: "voice-over generation",\n        query: String(body.prompt || ""),\n        tone: String(body.tone || DEFAULT_TONE),\n        currentTranscript: body.transcript || "",\n        maxCharacters: 60_000,\n      });\n    } catch (error) {\n      workspaceLearning = `Workspace learning retrieval unavailable for this run: ${error instanceof Error ? error.message : "unknown storage error"}. Governing DANA rules still apply.`;\n    }\n    const contextualBody: VoiceoverInput = {\n      ...body,\n      context: [body.context || "", `WORKSPACE LEARNING — VERIFIED INTERNAL SOURCES:\\n${workspaceLearning}`]\n        .filter(Boolean)\n        .join("\\n\\n"),\n    };\n    const { selectedTone, system, user } = prompts(contextualBody, finalRuntimeSeconds);\n''',
    "voice-over learning retrieval",
)
path.write_text(text)

# ---------------------------------------------------------------------------
# Direct/native transcription: learned context is a guardrail, never truth
# ---------------------------------------------------------------------------
path = Path("app/api/transcribe/route.ts")
text = path.read_text()
text = replace_once(
    text,
    'import { getStoredKey } from "../../lib/credentials";\n',
    'import { getStoredKey } from "../../lib/credentials";\nimport { buildWorkspaceLearningContext } from "../../lib/workspace-learning";\n',
    "transcribe learning import",
)
text = replace_once(
    text,
    '    if (!files.length) return NextResponse.json({ ok: false, message: "No video files were submitted." }, { status: 400 });\n\n    if (processor === "native") {\n',
    '''    if (!files.length) return NextResponse.json({ ok: false, message: "No video files were submitted." }, { status: 400 });\n\n    let workspaceLearning = "";\n    try {\n      workspaceLearning = await buildWorkspaceLearningContext(request, {\n        activity: "transcription context",\n        query: files.map((file) => file.name).join(" "),\n        maxCharacters: 20_000,\n      });\n    } catch {}\n    const combinedReferenceContext = [referenceManifest, workspaceLearning]\n      .filter(Boolean)\n      .join("\\n\\nWORKSPACE LEARNING GUARDRAILS — NEVER ALTER FACTUAL TRANSCRIPTION:\\n");\n\n    if (processor === "native") {\n''',
    "transcribe workspace retrieval",
)
text = text.replace('nativeForm.append("referenceManifest", referenceManifest);', 'nativeForm.append("referenceManifest", combinedReferenceContext);')
text = text.replace('${referenceManifest}`;', '${combinedReferenceContext}`;')
path.write_text(text)

# ---------------------------------------------------------------------------
# Already-uploaded Gemini video transcription: same server-side retrieval
# ---------------------------------------------------------------------------
path = Path("app/api/transcribe-uploaded/route.ts")
text = path.read_text()
text = replace_once(
    text,
    'import { getStoredKey } from "../../lib/credentials";\n',
    'import { getStoredKey } from "../../lib/credentials";\nimport { buildWorkspaceLearningContext } from "../../lib/workspace-learning";\n',
    "uploaded transcription learning import",
)
text = replace_once(
    text,
    '    const prompt = `You are producing an authentic Latvian television transcript for the original file “${originalFile}”.',
    '''    let workspaceLearning = "";\n    try {\n      workspaceLearning = await buildWorkspaceLearningContext(request, {\n        activity: "transcription context",\n        query: originalFile,\n        maxCharacters: 20_000,\n      });\n    } catch {}\n    const combinedReferenceContext = [referenceManifest, workspaceLearning]\n      .filter(Boolean)\n      .join("\\n\\nWORKSPACE LEARNING GUARDRAILS — NEVER ALTER FACTUAL TRANSCRIPTION:\\n");\n\n    const prompt = `You are producing an authentic Latvian television transcript for the original file “${originalFile}”.''',
    "uploaded transcription retrieval",
)
text = text.replace('${referenceManifest}`;', '${combinedReferenceContext}`;')
path.write_text(text)

# ---------------------------------------------------------------------------
# Learning route: allow re-analysis from persisted source truth without upload
# ---------------------------------------------------------------------------
path = Path("app/api/learn-source/route.ts")
text = path.read_text()
text = replace_once(
    text,
    '  getLearningSource,\n',
    '  getLearningSource,\n  getLearningSourceContent,\n',
    "learn route persisted content import",
)
old = '''    sourceId = String(body.sourceId || "");\n    const content = String(body.content || "").trim();\n    const contentKind = body.contentKind;\n    if (!sourceId || !content || !contentKind) {\n      return NextResponse.json(\n        { ok: false, message: "Source ID, complete source truth and content kind are required." },\n        { status: 400 },\n      );\n    }\n    const source = await getLearningSource(request, sourceId);\n    if (!source) return NextResponse.json({ ok: false, message: "Learning source not found." }, { status: 404 });\n\n    await updateLearningSource(request, sourceId, {\n      status: contentKind === "video-transcript" ? "transcribing" : "extracting",\n    });\n    await saveLearningSourceContent(request, sourceId, {\n      content,\n      contentKind,\n      language: body.language || "lv",\n      durationSeconds: body.durationSeconds ?? null,\n    });\n'''
new = '''    sourceId = String(body.sourceId || "");\n    if (!sourceId) {\n      return NextResponse.json({ ok: false, message: "Source ID is required." }, { status: 400 });\n    }\n    const source = await getLearningSource(request, sourceId);\n    if (!source) return NextResponse.json({ ok: false, message: "Learning source not found." }, { status: 404 });\n    let content = String(body.content || "").trim();\n    let contentKind = body.contentKind;\n    let durationSeconds = body.durationSeconds ?? null;\n    if (!content || !contentKind) {\n      const persisted = await getLearningSourceContent(request, sourceId);\n      if (persisted) {\n        content = String(persisted.content || "").trim();\n        contentKind = persisted.content_kind;\n        durationSeconds = persisted.duration_seconds;\n      }\n    }\n    if (!content || !contentKind) {\n      return NextResponse.json(\n        { ok: false, message: "No persisted source truth is available. Re-upload or retranscribe this source before re-analysis." },\n        { status: 400 },\n      );\n    }\n\n    await updateLearningSource(request, sourceId, {\n      status: contentKind === "video-transcript" ? "transcribing" : "extracting",\n    });\n    await saveLearningSourceContent(request, sourceId, {\n      content,\n      contentKind,\n      language: body.language || "lv",\n      durationSeconds,\n    });\n'''
text = replace_once(text, old, new, "learn route persisted reanalysis")
path.write_text(text)

# ---------------------------------------------------------------------------
# Main UI: automatic workspace learning + Learning Library inspector
# ---------------------------------------------------------------------------
path = Path("app/page.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { createFile as createMp4File } from "mp4box";\n',
    '''import { createFile as createMp4File } from "mp4box";\nimport {\n  fetchLearningSourceDetail,\n  fetchLearningSources,\n  LEARNING_STATUS_LABELS,\n  patchLearningSource,\n  registerSourceForLearning,\n  removeLearningSource,\n  RETRY_AVAILABLE_LABEL,\n  startSourceLearning,\n} from "./lib/client-learning";\nimport type { LearningProfile, LearningSource } from "./lib/learning-types";\n''',
    "page learning imports",
)
text = replace_once(
    text,
    '  const [sourceMessage, setSourceMessage] = useState("");\n',
    '''  const [sourceMessage, setSourceMessage] = useState("");\n  const [learningSources, setLearningSources] = useState<LearningSource[]>([]);\n  const [learningProgressByName, setLearningProgressByName] = useState<Record<string, string>>({});\n  const [learningInspector, setLearningInspector] = useState<{\n    source: LearningSource;\n    profile: LearningProfile | null;\n    verified: boolean;\n    contentKind?: string;\n  } | null>(null);\n''',
    "page learning state",
)
text = replace_once(
    text,
    '  const transcriptImportInput = useRef<HTMLInputElement>(null);\n  useEffect(() => {\n',
    '''  const transcriptImportInput = useRef<HTMLInputElement>(null);\n\n  const mergePersistentLearningSources = (sources: LearningSource[]) => {\n    setLearningSources(sources);\n    const serverNames = new Set(sources.map((source) => source.originalFilename));\n    const serverRows: Source[] = sources.map((source) => [\n      source.sourceType === "video" ? "Video reference" : "Production reference",\n      source.originalFilename,\n      "Persistent workspace learning",\n      source.extension.toUpperCase(),\n    ]);\n    setLibrarySources((current) => {\n      const core = current.find((source) => source[1] === CORE_SOURCE_NAME) ||\n        defaultSources.find((source) => source[1] === CORE_SOURCE_NAME)!;\n      const legacy = current.filter(\n        (source) => source[1] !== CORE_SOURCE_NAME && !serverNames.has(source[1]),\n      );\n      return [core, ...serverRows, ...legacy];\n    });\n    setAppliedSources((current) => {\n      const legacy = current.filter(\n        (name) => name === CORE_SOURCE_NAME || !serverNames.has(name),\n      );\n      const activeLearning = sources.filter((source) => source.active).map((source) => source.originalFilename);\n      return Array.from(new Set([CORE_SOURCE_NAME, ...legacy, ...activeLearning]));\n    });\n  };\n\n  const refreshLearningSources = async () => {\n    const sources = await fetchLearningSources();\n    mergePersistentLearningSources(sources);\n    return sources;\n  };\n\n  useEffect(() => {\n    void refreshLearningSources().catch(() => {\n      // Legacy local references remain usable if persistent storage is temporarily unavailable.\n    });\n  }, []);\n\n  useEffect(() => {\n''',
    "page learning hydration",
)

# Insert learning actions beside chooseSource.
text = replace_once(
    text,
    '  const chooseSource = () => sourceInput.current?.click();\n  const isVideoReferenceFile = (file: File) =>\n',
    '''  const chooseSource = () => sourceInput.current?.click();\n  const authorityForLearningFile = (name: string) =>\n    /RIHARDS[ _-]*LEPERS/i.test(name) ? "canonical" as const : "supporting" as const;\n\n  const setLearningProgress = (name: string, label: string) =>\n    setLearningProgressByName((current) => ({ ...current, [name]: label }));\n\n  const reAnalyzeLearningSource = async (source: LearningSource) => {\n    try {\n      setSourceStatus("indexing");\n      setLearningProgress(source.originalFilename, "Analyzing");\n      setSourceMessage(`Re-analyzing ${source.originalFilename} from saved source truth…`);\n      await startSourceLearning(\n        { sourceId: source.id },\n        (progress) => setLearningProgress(source.originalFilename, progress.label),\n      );\n      await refreshLearningSources();\n      setSourceStatus("success");\n      setSourceMessage(`${source.originalFilename}: Learned ✓. Updated essence is active workspace-wide.`);\n    } catch (error) {\n      setSourceStatus("error");\n      setLearningProgress(source.originalFilename, "Needs attention");\n      setSourceMessage(error instanceof Error ? error.message : "Re-analysis failed.");\n    }\n  };\n\n  const toggleLearningSource = async (source: LearningSource) => {\n    try {\n      await patchLearningSource(source.id, { active: !source.active });\n      await refreshLearningSources();\n      setSourceMessage(\n        `${source.originalFilename}: Use for learning ${source.active ? "OFF" : "ON"}.`,\n      );\n    } catch (error) {\n      setSourceStatus("error");\n      setSourceMessage(error instanceof Error ? error.message : "Learning toggle failed.");\n    }\n  };\n\n  const openLearningInspector = async (source: LearningSource) => {\n    try {\n      const detail = await fetchLearningSourceDetail(source.id);\n      setLearningInspector({\n        source: detail.source,\n        profile: detail.profile,\n        verified: detail.verified,\n        contentKind: detail.content?.content_kind,\n      });\n    } catch (error) {\n      setSourceStatus("error");\n      setSourceMessage(error instanceof Error ? error.message : "Learning profile could not be opened.");\n    }\n  };\n\n  const isVideoReferenceFile = (file: File) =>\n''',
    "page learning actions",
)

# Replace the old source registration-only flow wholesale.
pattern = r'  const onSources = async \(files\?: FileList \| null\) => \{[\s\S]*?\n  \};\n  const applyAllSources = \(\) => \{'
replacement = '''  const onSources = async (files?: FileList | null) => {\n    if (!files?.length) return;\n    const incoming = Array.from(files);\n    setSourceStatus("indexing");\n    setSourceMessage(\n      `Uploading ${incoming.length} source${incoming.length === 1 ? "" : "s"} → deep learning…`,\n    );\n    const failures: string[] = [];\n    const successes: string[] = [];\n    const alreadyLearned: string[] = [];\n    const indexedContents: Record<string, string> = {};\n\n    for (const file of incoming) {\n      let registered: LearningSource | null = null;\n      try {\n        const isVideo = isVideoReferenceFile(file);\n        setLearningProgress(file.name, "Uploading");\n        const registration = await registerSourceForLearning(\n          file,\n          isVideo ? "video" : "document",\n          authorityForLearningFile(file.name),\n        );\n        registered = registration.source;\n        const extension = String(file.name.split(".").pop() || (isVideo ? "VIDEO" : "FILE")).toUpperCase();\n        const localRow: Source = [\n          isVideo ? "Video reference" : "Production reference",\n          file.name,\n          "Persistent workspace learning",\n          extension,\n        ];\n        setLibrarySources((current) => {\n          const core = current.filter((source) => source[1] === CORE_SOURCE_NAME);\n          const remaining = current.filter(\n            (source) => source[1] !== CORE_SOURCE_NAME && source[1] !== file.name,\n          );\n          return [...core, localRow, ...remaining];\n        });\n        setAppliedSources((current) => Array.from(new Set([CORE_SOURCE_NAME, ...current, file.name])));\n\n        if (registration.duplicate && registration.source.status === "learned") {\n          alreadyLearned.push(file.name);\n          setLearningProgress(file.name, "Learned ✓");\n          continue;\n        }\n\n        if (isVideo) {\n          setLearningProgress(file.name, "Extracting / Transcribing");\n          const uploaded = await uploadVideoDirectlyToGemini(file);\n          await waitForGeminiVideo(uploaded.name, "", (detail) => {\n            setLearningProgress(file.name, "Extracting / Transcribing");\n            setSourceMessage(`${file.name}: ${detail}`);\n          });\n          const transcriptResponse = await fetch("/api/transcribe-uploaded", {\n            method: "POST",\n            headers: { "Content-Type": "application/json" },\n            body: JSON.stringify({\n              uploadedFile: uploaded,\n              originalFile: file.name,\n              model: GEMINI_DIRECT_MODEL,\n              referenceManifest: buildReferenceBrief(appliedSources),\n            }),\n          });\n          const transcriptData = await transcriptResponse.json().catch(() => ({}));\n          if (!transcriptResponse.ok || !transcriptData?.ok || !transcriptData?.transcript) {\n            throw new Error(\n              transcriptData?.message || `Video transcription failed (HTTP ${transcriptResponse.status}).`,\n            );\n          }\n          const transcript = String(transcriptData.transcript).trim();\n          const durationSeconds = inferRuntimeFromTranscript(transcript);\n          setLearningProgress(file.name, "Analyzing");\n          await startSourceLearning(\n            {\n              sourceId: registered.id,\n              content: transcript,\n              contentKind: "video-transcript",\n              durationSeconds: durationSeconds || null,\n            },\n            (progress) => {\n              setLearningProgress(file.name, progress.label);\n              if (progress.message) setSourceMessage(`${file.name}: ${progress.message}`);\n            },\n          );\n        } else {\n          setLearningProgress(file.name, "Extracting / Transcribing");\n          const form = new FormData();\n          form.append("file", file);\n          const response = await fetch("/api/ingest-reference", { method: "POST", body: form });\n          const data = await response.json().catch(() => ({}));\n          if (!response.ok || !data?.ok || !data?.content) {\n            throw new Error(data?.message || `Could not extract ${file.name} (HTTP ${response.status}).`);\n          }\n          indexedContents[file.name] = String(data.content);\n          setLearningProgress(file.name, "Analyzing");\n          await startSourceLearning(\n            {\n              sourceId: registered.id,\n              content: String(data.content),\n              contentKind: "document-text",\n              durationSeconds: null,\n            },\n            (progress) => {\n              setLearningProgress(file.name, progress.label);\n              if (progress.message) setSourceMessage(`${file.name}: ${progress.message}`);\n            },\n          );\n        }\n        successes.push(file.name);\n        setLearningProgress(file.name, "Learned ✓");\n        await refreshLearningSources();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : "learning failed";\n        failures.push(`${file.name}: ${message}`);\n        setLearningProgress(file.name, "Needs attention");\n        if (registered) {\n          await fetch(`/api/learning-sources/${encodeURIComponent(registered.id)}`, {\n            method: "PATCH",\n            headers: { "Content-Type": "application/json" },\n            body: JSON.stringify({ status: "needs-attention" }),\n          }).catch(() => undefined);\n        }\n      }\n    }\n\n    if (Object.keys(indexedContents).length) {\n      setReferenceContents((current) => ({ ...current, ...indexedContents }));\n    }\n    await refreshLearningSources().catch(() => undefined);\n    const finalMessage = [\n      successes.length ? `Learned workspace-wide: ${successes.join(", ")}.` : "",\n      alreadyLearned.length ? `Already learned: ${alreadyLearned.join(", ")}.` : "",\n      failures.length ? `Needs attention: ${failures.join(" · ")}. ${RETRY_AVAILABLE_LABEL}.` : "",\n    ].filter(Boolean).join(" ") || "No sources were added.";\n    setSourceStatus(failures.length ? "error" : "success");\n    setSourceMessage(finalMessage);\n    setProjectMessage(finalMessage);\n    if (sourceInput.current) sourceInput.current.value = "";\n  };\n  const applyAllSources = () => {'''
text = sub_once(text, pattern, replacement, "automatic source learning flow")

# Make remove delete persistent source too.
pattern = r'  const removeSource = \(name: string\) => \{[\s\S]*?\n  \};\n  // Retained as an explicit manual fallback'
replacement = '''  const removeSource = async (name: string) => {\n    if (name === CORE_SOURCE_NAME) {\n      setProjectMessage("The DANA AI Master Production System is the governing core and cannot be removed.");\n      return;\n    }\n    const legacySource = librarySources.find((item) => item[1] === name);\n    if (!legacySource) return;\n    if (!window.confirm(`Remove “${name}” from the reference library?\\n\\nThis also removes it from future workspace learning retrieval.`)) return;\n    const learningSource = learningSources.find((item) => item.originalFilename === name);\n    try {\n      if (learningSource) await removeLearningSource(learningSource.id);\n      setLibrarySources((current) => current.filter((item) => item[1] !== name));\n      setAppliedSources((current) => current.filter((item) => item !== name));\n      setReferenceContents((current) => {\n        const next = { ...current };\n        delete next[name];\n        return next;\n      });\n      setLearningProgressByName((current) => {\n        const next = { ...current };\n        delete next[name];\n        return next;\n      });\n      if (learningInspector?.source.originalFilename === name) setLearningInspector(null);\n      await refreshLearningSources().catch(() => undefined);\n      setProjectMessage(`Removed ${name} from the library and future DANA learning retrieval.`);\n    } catch (error) {\n      setSourceStatus("error");\n      setSourceMessage(error instanceof Error ? error.message : "Source removal failed.");\n    }\n  };\n  // Retained as an explicit manual fallback'''
text = sub_once(text, pattern, replacement, "persistent source removal")

# Source-row display and actions.
text = replace_once(
    text,
    '                  const isIndexed = Boolean(referenceContents[name]);\n                  return (\n',
    '''                  const isIndexed = Boolean(referenceContents[name]);\n                  const learningSource = learningSources.find(\n                    (source) => source.originalFilename === name,\n                  );\n                  const learningLabel = learningSource\n                    ? learningProgressByName[name] || LEARNING_STATUS_LABELS[learningSource.status] || learningSource.status\n                    : "";\n                  return (\n''',
    "learning row state",
)
old_small = '''                          {type} ·{" "}\n                          {isCore\n                            ? "Core · locked governing source"\n                            : isVideo\n                              ? isApplied ? "Video reference · applied" : "Video reference · pending"\n                              : isIndexed\n                                ? isApplied ? "Indexed · applied to project" : "Indexed · pending"\n                                : "Needs indexing · add the file again"}\n'''
new_small = '''                          {type} ·{" "}\n                          {isCore\n                            ? "Core · locked governing source"\n                            : learningSource\n                              ? `${learningLabel} · ${learningSource.authority} · workspace-wide`\n                              : isVideo\n                                ? isApplied ? "Video reference · applied" : "Video reference · pending"\n                                : isIndexed\n                                  ? isApplied ? "Indexed · applied to project" : "Indexed · pending"\n                                  : "Needs indexing · add the file again"}\n'''
text = replace_once(text, old_small, new_small, "learning row description")
text = replace_once(
    text,
    '                        {isCore ? "● Core" : isApplied ? isIndexed || isVideo ? "✓ Applied" : "Re-index" : "Pending"}\n                      </span>\n                      <button\n',
    '''                        {isCore\n                          ? "● Core"\n                          : learningSource\n                            ? learningLabel\n                            : isApplied\n                              ? isIndexed || isVideo ? "✓ Applied" : "Re-index"\n                              : "Pending"}\n                      </span>\n                      {learningSource && !isCore && (\n                        <div className="learning-source-actions">\n                          <label className="learning-toggle">\n                            <input\n                              type="checkbox"\n                              checked={learningSource.active}\n                              onChange={() => void toggleLearningSource(learningSource)}\n                            />\n                            <span>Use for learning</span>\n                          </label>\n                          <button type="button" onClick={() => void openLearningInspector(learningSource)}>\n                            View learning\n                          </button>\n                          <button type="button" onClick={() => void reAnalyzeLearningSource(learningSource)}>\n                            {learningSource.status === "needs-attention"\n                              ? `${RETRY_AVAILABLE_LABEL} · Re-analyze`\n                              : "Re-analyze"}\n                          </button>\n                        </div>\n                      )}\n                      <button\n''',
    "learning row actions",
)
text = text.replace('onClick={() => removeSource(name)}', 'onClick={() => void removeSource(name)}')

# Learning inspector before existing knowledge note.
text = replace_once(
    text,
    '              </div>\n              <div className="knowledge-note">\n                <span>◉</span> Applied references guide the editorial context\n',
    '''              </div>\n              {learningInspector && (\n                <div className="learning-inspector" role="dialog" aria-label="DANA Learning Profile">\n                  <div className="learning-inspector-head">\n                    <div>\n                      <div className="eyebrow">DANA LEARNING PROFILE</div>\n                      <h4>{learningInspector.source.originalFilename}</h4>\n                      <small>\n                        {learningInspector.verified ? "Verified · Learned ✓" : "Needs attention"} · {learningInspector.source.authority} · {learningInspector.contentKind || learningInspector.source.sourceType}\n                      </small>\n                    </div>\n                    <button type="button" onClick={() => setLearningInspector(null)}>Close</button>\n                  </div>\n                  {learningInspector.profile ? (\n                    <div className="learning-inspector-body">\n                      <section>\n                        <b>What DANA learned</b>\n                        <p><strong>Narrator:</strong> {learningInspector.profile.editorialEssence.narratorRole}</p>\n                        <p><strong>Attitude:</strong> {learningInspector.profile.editorialEssence.narratorAttitude}</p>\n                        <p><strong>Rhythm:</strong> {learningInspector.profile.editorialEssence.sentenceRhythm}</p>\n                        <p><strong>VO density:</strong> {learningInspector.profile.editorialEssence.voiceoverDensity}</p>\n                        <p><strong>Pacing:</strong> {learningInspector.profile.editorialEssence.pacing}</p>\n                      </section>\n                      <section>\n                        <b>Reusable production rules</b>\n                        <ul>{learningInspector.profile.editorialEssence.productionRules.map((item) => <li key={item}>{item}</li>)}</ul>\n                      </section>\n                      <section>\n                        <b>Humour & story mechanisms</b>\n                        <ul>{[...learningInspector.profile.editorialEssence.humourMechanisms, ...learningInspector.profile.editorialEssence.escalationPatterns, ...learningInspector.profile.editorialEssence.callbacks].map((item) => <li key={item}>{item}</li>)}</ul>\n                      </section>\n                      <section>\n                        <b>Source-derived evidence</b>\n                        <ul>{learningInspector.profile.evidence.map((item, index) => <li key={`${item.timecode || "e"}-${index}`}><strong>{item.timecode || "Source"}</strong> — {item.supports}: “{item.excerpt}”</li>)}</ul>\n                      </section>\n                      <section>\n                        <b>Tags</b>\n                        <div className="learning-tags">{learningInspector.profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>\n                      </section>\n                      <section>\n                        <b>Verification & conflicts</b>\n                        <p>Coverage {learningInspector.profile.verification.coverageScore}% · Completeness {learningInspector.profile.verification.completenessScore}% · Confidence {learningInspector.profile.verification.confidence}</p>\n                        {learningInspector.profile.verification.conflictingRules.length > 0 ? (\n                          <ul>{learningInspector.profile.verification.conflictingRules.map((item) => <li key={item}>{item}</li>)}</ul>\n                        ) : <p>No governing-rule conflicts reported.</p>}\n                      </section>\n                    </div>\n                  ) : (\n                    <p className="learning-empty-profile">No verified learning profile is available yet. {RETRY_AVAILABLE_LABEL}.</p>\n                  )}\n                </div>\n              )}\n              <div className="knowledge-note">\n                <span>◉</span> Applied references guide the editorial context\n''',
    "learning inspector",
)
path.write_text(text)

# ---------------------------------------------------------------------------
# Styling for the learning controls and inspector
# ---------------------------------------------------------------------------
path = Path("app/modules.css")
text = path.read_text()
append = '''\n\n/* Persistent DANA workspace learning */\n.learning-source-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-left:auto}.learning-source-actions>button{border:1px solid #d7dfd8;background:#fff;color:#3e5849;border-radius:7px;padding:7px 9px;font-size:11px;font-weight:800;cursor:pointer}.learning-source-actions>button:hover{background:#f3f8f3}.learning-toggle{display:flex!important;grid-template-columns:none!important;align-items:center;gap:6px!important;font-size:11px!important;font-weight:800!important;color:#52685b!important;white-space:nowrap}.learning-toggle input{accent-color:#47765b}.learning-inspector{margin:16px 0 6px;padding:18px;border:1px solid #cfdfd2;border-radius:11px;background:#fbfdf9;box-shadow:0 10px 28px rgba(48,76,57,.08)}.learning-inspector-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid #e0e9e1}.learning-inspector-head h4{margin:4px 0;font-size:18px;color:var(--ink)}.learning-inspector-head small{color:var(--muted)}.learning-inspector-head button{border:1px solid var(--line);background:#fff;border-radius:7px;padding:7px 10px;cursor:pointer}.learning-inspector-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.learning-inspector-body section{padding:13px;border:1px solid #e1e9e2;border-radius:9px;background:#fff}.learning-inspector-body section>b{display:block;margin-bottom:8px;color:#315143}.learning-inspector-body p{margin:5px 0;line-height:1.5;color:#52645a}.learning-inspector-body ul{margin:6px 0 0;padding-left:18px;color:#52645a}.learning-inspector-body li{margin:5px 0;line-height:1.45}.learning-tags{display:flex;flex-wrap:wrap;gap:6px}.learning-tags span{padding:4px 7px;border-radius:999px;background:#edf5ee;color:#41604b;font-size:11px;font-weight:800}.learning-empty-profile{margin:14px 0 0;color:#8a5d42}.source-row{flex-wrap:wrap}.source-info{min-width:220px;flex:1}.source-check,.source-pending{max-width:150px;text-align:right}@media(max-width:900px){.learning-source-actions{width:100%;margin-left:44px}.learning-inspector-body{grid-template-columns:1fr}}\n'''
if "Persistent DANA workspace learning" not in text:
    text += append
path.write_text(text)

print("Workspace learning patch applied.")
