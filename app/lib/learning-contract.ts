export const DANA_LEARNING_ANALYSIS_CONTRACT = `
DANA AI WORKSPACE LEARNING — DEEP SOURCE ANALYSIS CONTRACT

Your task is NOT to summarize the source. Answer this production question:
“What should DANA carry forward from this source into future production work?”

Analyze only the supplied source truth. Every conclusion must be traceable to that source. Source-specific facts, names, claims and biographical details are source-bound and MUST NOT be transferred into another episode unless independently present in that episode's current source material.

GOVERNING AUTHORITY — NEVER OVERRIDE
1. TV-channel mandatory rule: the voice-over narrator is the “piektā vakariņotāja” — an active fifth dinner guest with a point of view and added editorial layer, never a passive observer.
2. DANA AI Master Production System: chronology, evidence discipline, participant dignity, production usefulness and risk control.
3. Explicit Canonical references such as the approved Rihards Lepers benchmark outrank Strong, Supporting and Experimental learning.

If this source conflicts with a governing rule, RECORD the conflict. Never reconcile it silently and never instruct DANA to override the governing rule.

Extract the reusable editorial essence deeply:
- narrator role and narrator attitude
- humour mechanisms and where humour actually comes from
- sentence rhythm and broadcast-language behavior
- voice-over density / intervention frequency
- scene-selection logic
- character treatment and dignity boundaries
- pacing and escalation patterns
- callbacks and recurring motifs
- transitions and story bridges
- hooks, reveals and expectation management
- editing logic and reaction-shot logic
- promo and teaser mechanisms
- recurring language patterns
- what works and why
- what weakens the material and why
- what to avoid
- source-specific production rules worth retaining
- representative structural, voice-over and editorial-decision mechanisms
- negative examples / anti-patterns

EVIDENCE RULE
Give representative evidence from the supplied source. For a timecoded transcript, preserve the relevant timecode whenever available. Excerpts must be short and only long enough to prove the learned conclusion. Do not fabricate timestamps or dialogue.

OUTPUT RULE
Return ONLY valid JSON, no markdown fences and no prose outside JSON, with this exact shape:
{
  "editorialEssence": {
    "narratorRole": "string",
    "narratorAttitude": "string",
    "humourMechanisms": ["string"],
    "sentenceRhythm": "string",
    "voiceoverDensity": "string",
    "sceneSelectionLogic": "string",
    "characterTreatment": "string",
    "conflictAndDignityRules": ["string"],
    "pacing": "string",
    "escalationPatterns": ["string"],
    "callbacks": ["string"],
    "transitions": ["string"],
    "hooksAndReveals": ["string"],
    "editingLogic": ["string"],
    "reactionShotLogic": ["string"],
    "promoTeaserMechanisms": ["string"],
    "recurringLanguagePatterns": ["string"],
    "whatWorks": ["string"],
    "whatWeakens": ["string"],
    "avoid": ["string"],
    "productionRules": ["string"]
  },
  "reusablePatterns": {
    "structural": ["string"],
    "voiceover": ["string"],
    "editorialDecisions": ["string"],
    "antiPatterns": ["string"]
  },
  "evidence": [
    {"timecode": "optional HH:MM:SS", "excerpt": "short source excerpt", "supports": "what this evidence proves"}
  ],
  "tags": ["Narrator", "Fifth diner POV", "Humour", "Story structure", "Character", "Editing", "VO density", "Promo", "Editorial safety", "Latvian language", "British format", "Conflict", "Pacing", "Teaser", "Callback", "Transition"],
  "reportedConflicts": ["string"]
}

Be specific enough that a senior producer can recognize what was learned. Prefer reusable mechanisms over generic praise. If the source does not support a requested learning dimension, say that explicitly in that field rather than inventing it.
`.trim();

export function buildLearningAnalysisInput(input: {
  filename: string;
  sourceType: string;
  authority: string;
  contentKind: string;
  content: string;
}) {
  return `${DANA_LEARNING_ANALYSIS_CONTRACT}\n\nSOURCE METADATA\nFilename: ${input.filename}\nSource type: ${input.sourceType}\nAuthority assigned by DANA: ${input.authority}\nSource truth kind: ${input.contentKind}\n\nSOURCE TRUTH — FACTUAL EVIDENCE BOUNDARY\n${input.content}`;
}
