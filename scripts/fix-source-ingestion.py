from pathlib import Path

PAGE = Path("app/page.tsx")
CSS = Path("app/modules.css")

page = PAGE.read_text()
css = CSS.read_text()

state_anchor = '''  const [processingElapsed, setProcessingElapsed] = useState(0);\n  const [librarySources, setLibrarySources] = useState<Source[]>(() => {\n'''
state_replacement = '''  const [processingElapsed, setProcessingElapsed] = useState(0);\n  const [sourceStatus, setSourceStatus] = useState<\n    "idle" | "indexing" | "success" | "error"\n  >("idle");\n  const [sourceMessage, setSourceMessage] = useState("");\n  const [librarySources, setLibrarySources] = useState<Source[]>(() => {\n'''
if "const [sourceStatus, setSourceStatus]" not in page:
    if state_anchor not in page:
        raise SystemExit("source state anchor missing")
    page = page.replace(state_anchor, state_replacement, 1)

choose_anchor = '''  const chooseSource = () => sourceInput.current?.click();\n  const onSegments = (files?: FileList | null) => {\n'''
choose_replacement = '''  const chooseSource = () => sourceInput.current?.click();\n  const isVideoReferenceFile = (file: File) =>\n    file.type.startsWith("video/") || /\\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);\n  const onSegments = (files?: FileList | null) => {\n'''
if "const isVideoReferenceFile" not in page:
    if choose_anchor not in page:
        raise SystemExit("chooseSource anchor missing")
    page = page.replace(choose_anchor, choose_replacement, 1)

start = page.find('  const onSources = async (files?: FileList | null) => {')
end = page.find('  const applyAllSources = () => {', start)
if start < 0 or end < 0:
    raise SystemExit("onSources block missing")
new_on_sources = '''  const onSources = async (files?: FileList | null) => {\n    if (!files?.length) return;\n    const incoming = Array.from(files);\n    setSourceStatus("indexing");\n    setSourceMessage(\n      `Indexing ${incoming.length} source${incoming.length === 1 ? "" : "s"}…`,\n    );\n    setProjectMessage(\n      `Indexing ${incoming.length} reference source${incoming.length === 1 ? "" : "s"}…`,\n    );\n    const additions: Source[] = [];\n    const indexedContents: Record<string, string> = {};\n    const failures: string[] = [];\n    const existingNames = new Set(librarySources.map((source) => source[1]));\n    const updatedNames: string[] = [];\n    const addedNames: string[] = [];\n\n    for (const file of incoming) {\n      try {\n        if (isVideoReferenceFile(file)) {\n          const extension = String(file.name.split(".").pop() || "VIDEO").toUpperCase();\n          additions.push([\n            "Video reference",\n            file.name,\n            "Registered video reference",\n            extension,\n          ]);\n          (existingNames.has(file.name) ? updatedNames : addedNames).push(file.name);\n          continue;\n        }\n\n        const form = new FormData();\n        form.append("file", file);\n        const response = await fetch("/api/ingest-reference", {\n          method: "POST",\n          body: form,\n        });\n        const data = await response.json().catch(() => ({}));\n        if (!response.ok || !data?.ok) {\n          throw new Error(\n            data?.message || `Could not index ${file.name} (HTTP ${response.status}).`,\n          );\n        }\n        const extension = String(\n          data.extension || file.name.split(".").pop() || "FILE",\n        ).toUpperCase();\n        const type =\n          data.kind === "video" ? "Video reference" : "Production reference";\n        additions.push([\n          type,\n          file.name,\n          data.indexed ? "Indexed knowledge source" : "Registered video reference",\n          extension,\n        ]);\n        (existingNames.has(file.name) ? updatedNames : addedNames).push(file.name);\n        if (\n          data.indexed &&\n          typeof data.content === "string" &&\n          data.content.trim()\n        ) {\n          indexedContents[file.name] = data.content;\n        }\n      } catch (error) {\n        failures.push(\n          error instanceof Error\n            ? `${file.name}: ${error.message}`\n            : `${file.name}: indexing failed`,\n        );\n      }\n    }\n\n    if (additions.length) {\n      setLibrarySources((current) => {\n        const incomingNames = new Set(additions.map((source) => source[1]));\n        const coreSources = current.filter(\n          (source) => source[1] === CORE_SOURCE_NAME,\n        );\n        const remaining = current.filter(\n          (source) =>\n            source[1] !== CORE_SOURCE_NAME && !incomingNames.has(source[1]),\n        );\n        return [...coreSources, ...additions, ...remaining];\n      });\n      setReferenceContents((current) => ({\n        ...current,\n        ...indexedContents,\n      }));\n      setAppliedSources((current) =>\n        Array.from(\n          new Set([\n            ...current,\n            ...additions.map((source) => source[1]),\n            CORE_SOURCE_NAME,\n          ]),\n        ),\n      );\n    }\n\n    const successParts = [\n      addedNames.length\n        ? `Added: ${addedNames.join(", ")}.`\n        : "",\n      updatedNames.length\n        ? `Updated/re-indexed: ${updatedNames.join(", ")}.`\n        : "",\n      Object.keys(indexedContents).length\n        ? `${Object.keys(indexedContents).length} document${Object.keys(indexedContents).length === 1 ? "" : "s"} indexed into editorial context.`\n        : "",\n      additions.some((source) => source[0] === "Video reference")\n        ? "Video references were registered without uploading unused video bytes."\n        : "",\n    ].filter(Boolean);\n\n    const finalMessage = [\n      successParts.join(" "),\n      failures.length ? `Failed: ${failures.join(" · ")}` : "",\n    ]\n      .filter(Boolean)\n      .join(" ");\n\n    setSourceStatus(\n      failures.length && !additions.length ? "error" : failures.length ? "error" : "success",\n    );\n    setSourceMessage(\n      finalMessage || "No sources were added. Choose a supported reference file.",\n    );\n    setProjectMessage(\n      finalMessage || "No sources were added. Choose a supported reference file.",\n    );\n    if (sourceInput.current) sourceInput.current.value = "";\n  };\n'''
page = page[:start] + new_on_sources + page[end:]

old_accept = 'accept="video/*,.txt,.pdf,.doc,.docx,.srt,.vtt,.mp3,.wav"'
new_accept = 'accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.txt,.pdf,.docx,.srt,.vtt,.md,.csv"'
if old_accept in page:
    page = page.replace(old_accept, new_accept, 1)
elif new_accept not in page:
    raise SystemExit("source accept list anchor missing")

old_button = '''                  <button\n                    type="button"\n                    className="ghost-btn"\n                    onClick={chooseSource}\n                  >\n                    ＋ Add source\n                  </button>'''
new_button = '''                  <button\n                    type="button"\n                    className="ghost-btn"\n                    onClick={chooseSource}\n                    disabled={sourceStatus === "indexing"}\n                  >\n                    {sourceStatus === "indexing" ? "Indexing…" : "＋ Add source"}\n                  </button>'''
if 'disabled={sourceStatus === "indexing"}' not in page:
    if old_button not in page:
        raise SystemExit("add source button anchor missing")
    page = page.replace(old_button, new_button, 1)

feedback_anchor = '''              </div>\n              <div className="source-list">\n'''
feedback_replacement = '''              </div>\n              {sourceMessage && (\n                <div\n                  className={`source-feedback ${sourceStatus}`}\n                  role={sourceStatus === "error" ? "alert" : "status"}\n                >\n                  <span>{sourceStatus === "indexing" ? "…" : sourceStatus === "error" ? "!" : "✓"}</span>\n                  <div>\n                    <b>\n                      {sourceStatus === "indexing"\n                        ? "Indexing source"\n                        : sourceStatus === "error"\n                          ? "Source needs attention"\n                          : "Source ready"}\n                    </b>\n                    <small>{sourceMessage}</small>\n                  </div>\n                </div>\n              )}\n              <div className="source-list">\n'''
# Restrict replacement to first source-list after CONNECTED KNOWLEDGE.
knowledge_pos = page.find('<div className="eyebrow">CONNECTED KNOWLEDGE</div>')
feedback_pos = page.find(feedback_anchor, knowledge_pos)
if "className={`source-feedback ${sourceStatus}`}" not in page:
    if feedback_pos < 0:
        raise SystemExit("source feedback anchor missing")
    page = page[:feedback_pos] + page[feedback_pos:].replace(feedback_anchor, feedback_replacement, 1)

css_block = '''\n.source-feedback { display:flex; gap:10px; align-items:flex-start; margin:14px 0 4px; padding:12px 14px; border:1px solid #d7e4d9; border-radius:9px; background:#f5faf5; color:#315a45; }\n.source-feedback > span { flex:0 0 24px; width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:#dcebdd; font-weight:900; }\n.source-feedback b, .source-feedback small { display:block; }\n.source-feedback small { margin-top:3px; line-height:1.45; color:inherit; opacity:.86; }\n.source-feedback.indexing { border-color:#e5dcc4; background:#fffaf0; color:#6b5733; }\n.source-feedback.error { border-color:#eccfc8; background:#fff5f2; color:#934735; }\n.library-actions .ghost-btn:disabled { opacity:.6; cursor:wait; }\n'''
if ".source-feedback {" not in css:
    css += css_block

PAGE.write_text(page)
CSS.write_text(css)
print("Applied source ingestion UX and video-registration fix")
