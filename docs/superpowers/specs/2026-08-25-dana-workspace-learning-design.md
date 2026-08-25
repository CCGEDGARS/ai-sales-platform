# DANA AI Workspace Learning — Architecture Design

Date: 2026-08-25
Status: Proposed for implementation after user review

## 1. Goal

Turn every uploaded source into persistent, workspace-wide DANA production knowledge automatically.

User experience:

**Upload once → Analyze deeply → Extract essence → Verify → Save permanently → Auto-use across all DANA activities.**

The user must not manually transcribe, tag, activate, promote, or re-upload the same source for each project.

## 2. Core product rule

Every newly uploaded source is workspace-wide by default and has `Use for learning = ON`.

The DANA AI Master Production System and TV-channel mandatory rules remain governing authority. New learning enriches them but cannot silently override them.

Authority hierarchy:

1. TV-channel mandatory editorial rules
2. DANA AI Master Production System
3. Explicit Canonical references, including the approved Rihards Lepers benchmark
4. Strong references
5. Supporting references
6. Experimental references

If two learned sources conflict, the higher-authority source wins. Conflicts must be recorded rather than silently reconciled.

## 3. What “learning” means

DANA does not retrain the underlying OpenAI or Gemini model.

Each source is processed into a persistent **DANA Learning Profile** and related searchable knowledge. Future activities retrieve the relevant learned essence at generation time.

This makes learning auditable, reversible, source-traceable and safe.

## 4. Supported source pipeline

### Documents
Supported first-class formats:
- DOCX
- PDF
- TXT
- SRT
- VTT
- MD
- CSV

Pipeline:
1. Register source metadata and fingerprint.
2. Extract readable text.
3. Preserve full extracted source text.
4. Run deep editorial analysis.
5. Build a structured DANA Learning Profile.
6. Verify required learning fields and source coverage.
7. Persist source, profile, transcript/text, tags and provenance.
8. Mark `Learned ✓` only after verification succeeds.

### Video
Supported first-class formats:
- MKV
- MP4
- MOV
- WEBM
- AVI
- M4V

Pipeline:
1. Register source metadata and fingerprint.
2. Upload/process the video through the existing Gemini video path.
3. Generate a complete timecoded transcript.
4. Run deep editorial analysis over the transcript plus source metadata.
5. Build a structured DANA Learning Profile.
6. Verify transcript coverage and learning-profile completeness.
7. Persist transcript, profile, tags, provenance and source fingerprint.
8. Mark `Learned ✓` only after verification succeeds.
9. Raw large video bytes are not retained permanently after successful learning unless permanent media storage is added later.

## 5. DANA Learning Profile schema

Each source produces one persistent profile containing:

### Identity
- source id
- original filename
- source type
- file extension
- MIME type
- size
- source fingerprint/hash
- uploaded timestamp
- learned timestamp
- active/inactive learning flag
- authority level
- processing status
- model provenance

### Source truth
- complete extracted document text OR complete timecoded video transcript
- language
- duration when applicable
- source-specific names/entities only when present in source

### Editorial essence
- narrator role and attitude
- humour mechanisms
- sentence rhythm
- VO density / intervention frequency
- scene-selection logic
- character treatment
- conflict and dignity rules
- pacing
- escalation patterns
- callbacks
- transitions
- hooks/reveals
- editing logic
- reaction-shot logic
- promo/teaser mechanisms
- recurring language patterns
- what works
- what weakens the material
- what to avoid
- source-specific production rules

### Reusable patterns
- representative structural examples
- representative VO mechanisms
- representative editorial decisions
- reusable templates/pattern descriptions
- negative examples / anti-patterns

Representative examples remain tied to their source and must not be copied as facts into a new episode.

### Classification
Tags may include:
- Narrator
- Fifth diner POV
- Humour
- Story structure
- Character
- Editing
- VO density
- Promo
- Editorial safety
- Latvian language
- British format
- Conflict
- Pacing
- Teaser
- Callback
- Transition

### Verification
- coverage score
- profile completeness score
- confidence level
- verification notes
- conflicting rules detected
- final verified boolean

## 6. Persistence architecture

### Database
Use persistent server-side PostgreSQL storage rather than browser localStorage for learned knowledge.

Recommended implementation: Neon Postgres with Drizzle ORM, already compatible with the application’s current dependency direction.

Core tables:

`learning_sources`
- source identity, metadata, fingerprint, authority, active state, status, timestamps

`learning_source_content`
- extracted document text or video transcript

`learning_profiles`
- structured distilled editorial essence as JSON plus verification fields

`learning_chunks`
- retrieval chunks with tags, source id, authority and searchable text

`learning_events`
- processing lifecycle / failure / verification audit trail

### Raw source retention
- Documents: extracted content is persisted; raw binary storage is optional and not required for v1.
- Large videos: raw video is processed transiently and not permanently stored. Transcript, profile, fingerprint and provenance are persisted.

This design preserves all knowledge needed for future DANA work without accumulating large video-storage costs.

## 7. Automatic processing lifecycle

Every source has one visible state:

1. `Uploading`
2. `Extracting / Transcribing`
3. `Analyzing`
4. `Extracting learning`
5. `Verifying`
6. `Learned ✓`

Failure states:
- `Needs attention`
- `Retry available`

The app must never show `Learned ✓` until the verification step succeeds.

Processing should be durable for long video jobs. Long analysis must use background/polling architecture, not a single Vercel request that can time out.

## 8. Learning analysis contract

The deep-learning analysis must answer: **What should DANA carry forward from this source into future production work?**

It must not be a generic summary.

For each source, the analyzer must identify:
- editorial principles
- repeatable mechanisms
- tone and narrator behavior
- pacing and structure
- character treatment
- humour source
- strongest patterns
- weak patterns
- source-specific constraints
- reusable techniques
- conflict with governing DANA rules

For video, timecoded evidence should be preserved for important learned conclusions wherever possible.

## 9. Workspace-wide retrieval

Create one common server-side learning-context service used by every AI activity.

Conceptual API:

`buildWorkspaceLearningContext({ activity, query, tone, currentTranscript })`

Activities include:
- transcription context
- story analysis
- voice-over generation
- Lepers production package
- highlights
- annotations
- teasers
- promo hooks
- editorial risk analysis
- future DANA AI production tools

Retrieval rules:
1. Always include governing mandatory rules.
2. Include active Canonical profiles first.
3. Rank remaining profiles by authority + tag/activity relevance + lexical/semantic relevance.
4. Respect context-size budget.
5. Include provenance labels with every retrieved profile/chunk.
6. Never transfer source-specific facts into a current episode unless confirmed by current source material.

## 10. Lepers Standard interaction

Lepers Standard remains a dedicated production mode.

When selected:
- Rihards Lepers canonical learning profile is always strongly weighted.
- The TV-channel `piektā vakariņotāja` rule remains mandatory.
- Other learned sources may enrich pacing, humour or structure but cannot dilute or override the Lepers contract.

## 11. Fifth-diner global invariant

All editorial tones inherit the mandatory channel rule:
- narrator is the fifth dinner guest with a point of view
- narrator adds an editorial layer
- narrator may tease and articulate what the viewer is thinking
- narrator does not brutally insult or humiliate participants
- empty observer reactions such as “hmm”, “jā”, “traki”, “nu gan” are low-value and rejected
- every VO cue must carry opinion, interpretation, contrast, anticipation, callback, comic framing or viewer-perspective thought

A learned source cannot disable this rule.

## 12. UI changes

Reference Library becomes a true learning library.

Each row shows:
- source name
- source type
- status
- authority
- `Use for learning` toggle
- learned timestamp
- `View learning` action
- Remove action except locked governing core

`View learning` opens a readable profile showing:
- what DANA learned
- source-derived evidence
- tags
- authority
- conflicts/warnings
- verification status

Upload feedback remains visible in the library instead of only in the project banner.

## 13. Duplicate handling

Use source fingerprint plus filename/size metadata.

If an identical source is uploaded again:
- do not create duplicate knowledge
- show `Already learned`
- allow `Re-analyze` if desired

If the same filename contains different bytes:
- treat as a new source version
- preserve version provenance

## 14. Error handling

Document extraction failure:
- retain source registration and error audit
- do not mark learned
- show exact reason and retry path

Video transcription failure:
- preserve source metadata and job state
- do not run learning extraction from an incomplete transcript

AI analysis failure:
- retain transcript/extracted text
- allow analysis retry without re-uploading/retranscribing the source

Verification failure:
- preserve draft learning profile
- mark `Needs attention`
- do not include it in production retrieval until verified

## 15. Privacy and data boundaries

Learning is private to Dana’s DANA AI workspace.

No learned source is made public or used to train third-party foundation models by this application.

Source-derived facts must remain source-bound. Learned style or production principles may be reused, but personal/private factual content must not leak into unrelated episodes.

## 16. Testing requirements

Mandatory automated tests:
- document upload creates persistent source record
- MKV upload enters video learning pipeline
- every new source defaults to workspace-wide learning ON
- duplicate source is not learned twice
- transcript/text is persisted before learning is marked complete
- profile verification required before `Learned ✓`
- failed analysis can retry without re-upload
- retrieval obeys authority hierarchy
- lower-authority source cannot override governing rules
- Lepers Standard always retrieves canonical Lepers profile
- fifth-diner global invariant survives learned-source conflicts
- inactive source is excluded from retrieval
- source removal removes it from future retrieval
- full profile remains traceable to source provenance
- long-running video learning uses durable polling/background execution
- existing transcription and voice-over regression suite remains green

## 17. Delivery criteria

The feature is complete only when:
- a user can upload a DOCX/PDF/TXT/SRT/VTT/MD/CSV and it automatically becomes verified reusable workspace learning
- a user can upload MKV/MP4/MOV/WEBM/AVI/M4V and it automatically becomes a transcript + verified reusable workspace learning profile
- learning survives browser refresh and new projects
- all AI generation paths use the shared workspace learning service
- the user can inspect what DANA learned from each source
- the user can disable or remove a learning source
- authority conflicts are controlled
- production deployment is READY
- automated tests and production build pass
- live verification confirms the production domain uses the new learning subsystem

## 18. Implementation sequence

1. Persistent database schema and repository layer
2. Learning source API and processing lifecycle
3. Document deep-learning pipeline
4. Video/MKV deep-learning pipeline using existing Gemini path
5. Learning-profile verification
6. Shared workspace retrieval service
7. Integrate retrieval into transcription and voice-over first, then all current AI activities
8. Learning Library UI and profile inspector
9. Duplicate/version handling
10. Full regression, build, audit and production verification

## 19. Non-goals for v1

- Training/fine-tuning the underlying foundation model
- Permanent storage of multi-gigabyte raw videos
- Cross-customer/public knowledge sharing
- Automatic deletion of governing canonical rules
- Silent reconciliation of conflicting learned rules
