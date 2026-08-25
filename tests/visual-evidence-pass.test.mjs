import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const voiceRoute = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
let visualRoute = "";
try { visualRoute = fs.readFileSync("app/api/visual-evidence-uploaded/route.ts", "utf8"); } catch {}

test("visual evidence is a separate factual Gemini pass, not part of the authentic transcript", () => {
  assert.match(visualRoute, /VISUAL EVIDENCE|visual evidence/i);
  assert.match(visualRoute, /observable|directly visible/i);
  assert.match(visualRoute, /do not infer|never infer/i);
  assert.match(visualRoute, /do not transcribe|not.*transcript/i);
  assert.match(visualRoute, /\[HH:MM:SS\]/i);
});

test("visual evidence is accepted only as strict timestamped VISUAL facts", () => {
  assert.match(visualRoute, /maxDuration\s*=\s*300/);
  assert.match(visualRoute, /evidenceLines/);
  assert.match(visualRoute, /validEvidenceLine/);
  assert.match(visualRoute, /every\(\(line:\s*string\)\s*=>\s*validEvidenceLine\.test\(line\)\)/);
  assert.match(visualRoute, /observable-facts-only/);
});

test("video processing stores transcript and visual evidence in separate fields", () => {
  assert.match(page, /visualEvidence\??:\s*string/);
  assert.match(page, /visualEvidenceAvailable\??:\s*boolean/);
  assert.match(page, /\/api\/visual-evidence-uploaded/);
  assert.match(page, /visualEvidence:\s*data\.visualEvidence|visualEvidence:\s*visual/i);
  assert.match(page, /Imported validated transcript/);
  assert.match(page, /visualEvidenceAvailable:\s*false/);
});

test("timeline offsets are restored for visual evidence as well as dialogue", () => {
  assert.match(page, /adjustedVisualEvidence|visualEvidence.*startSeconds/i);
});

test("editorial generation receives visual evidence as a separate evidence channel", () => {
  assert.match(page, /visualEvidence:\s*visualEvidenceText/);
  assert.match(voiceRoute, /visualEvidence\?:\s*string/);
  assert.match(voiceRoute, /VISUAL EVIDENCE/i);
  assert.match(voiceRoute, /observable facts|observable evidence/i);
  assert.match(voiceRoute, /transcript.*factual|factual.*transcript/i);
  assert.match(voiceRoute, /visual evidence.*interpret|interpret.*visual evidence/i);
});

test("the UI shows whether visual evidence is available without contaminating transcript export", () => {
  assert.match(page, /Visual Evidence Pass/);
  assert.match(page, /visualEvidenceText/);
  assert.match(page, /timestamped visual evidence|visual evidence unavailable/i);
  const transcriptDefinition = page.match(/const transcriptText\s*=([\s\S]*?)const effectiveRuntimeSeconds/);
  assert.ok(transcriptDefinition);
  assert.doesNotMatch(transcriptDefinition[1], /visualEvidence/i);
});
