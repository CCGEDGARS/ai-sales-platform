import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");

const expectedBrief = "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest and editorial co-author: do not just reflect the footage—create a bold Second Story from verified reality using new angles, metaphors, hypotheses, predictions, contradictions and callbacks. Add story, humour, tension, character or emotion; never invent facts, motives or events, humiliate participants, or pad VO. Keep VO selective near 16.67%.";

test("default Lepers editorial brief exposes the compact Fifth Dinner Guest + Second Story doctrine", () => {
  assert.match(page, new RegExp(expectedBrief.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /invisible fifth dinner guest/i);
  assert.match(page, /editorial co-author/i);
  assert.match(page, /Second Story/i);
  assert.match(page, /verified reality/i);
  assert.match(page, /metaphors, hypotheses, predictions, contradictions and callbacks/i);
  assert.match(page, /never invent facts, motives or events/i);
  assert.match(page, /selective near 16\.67%/i);
});

test("legacy built-in brief is migrated while real custom briefs remain preservable", () => {
  assert.match(page, /LEGACY_DEFAULT_EDITORIAL_BRIEF/);
  assert.match(page, /mergeSavedEditorialBriefs/);
  assert.match(page, /saved\[DEFAULT_EDITORIAL_TONE\]\s*===\s*LEGACY_DEFAULT_EDITORIAL_BRIEF/);
  assert.match(page, /\.\.\.saved/);
});

test("stale browser brief versions cannot override the canonical Lepers default", () => {
  assert.match(page, /EDITORIAL_BRIEF_SCHEMA_VERSION/);
  assert.match(page, /EDITORIAL_BRIEF_VERSION_KEY/);
  assert.match(page, /localStorage\.getItem\(EDITORIAL_BRIEF_VERSION_KEY\)/);
  assert.match(page, /savedVersion\s*!==\s*EDITORIAL_BRIEF_SCHEMA_VERSION/);
  assert.match(page, /\[DEFAULT_EDITORIAL_TONE\]:\s*DEFAULT_LEPERS_EDITORIAL_BRIEF/);
  assert.match(page, /setVoiceoverPrompt\(DEFAULT_LEPERS_EDITORIAL_BRIEF\)/);
  assert.match(page, /localStorage\.setItem\(\s*EDITORIAL_BRIEF_VERSION_KEY,\s*EDITORIAL_BRIEF_SCHEMA_VERSION,?\s*\)/);
});
