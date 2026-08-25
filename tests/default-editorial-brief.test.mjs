import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");

const expectedBrief = "Create the Latvian Lepers Golden Master package in WOW mode. Be factually conservative and creatively aggressive: do not submit the first reasonable idea. Generate competing Second Story angles, reject predictable ones, choose the freshest source-grounded premise, and add FORMAT SPICE—bold callbacks, visual/editing games, provocations, metaphors and hooks that make the show richer than the raw footage. Fifth Dinner Guest VO must surprise, not reflect. Never invent reality or humiliate participants; keep VO selective near 16.67%.";

test("default Lepers editorial brief exposes the compact Fifth Dinner Guest + Second Story + WOW doctrine", () => {
  assert.match(page, new RegExp(expectedBrief.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /WOW mode/i);
  assert.match(page, /factually conservative and creatively aggressive/i);
  assert.match(page, /do not submit the first reasonable idea/i);
  assert.match(page, /Second Story/i);
  assert.match(page, /FORMAT SPICE/i);
  assert.match(page, /Fifth Dinner Guest/i);
  assert.match(page, /never invent reality/i);
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
  assert.match(page, /2026-08-25-wow-creative-room-v5/);
  assert.match(page, /EDITORIAL_BRIEF_VERSION_KEY/);
  assert.match(page, /localStorage\.getItem\(EDITORIAL_BRIEF_VERSION_KEY\)/);
  assert.match(page, /savedVersion\s*!==\s*EDITORIAL_BRIEF_SCHEMA_VERSION/);
  assert.match(page, /\[DEFAULT_EDITORIAL_TONE\]:\s*DEFAULT_LEPERS_EDITORIAL_BRIEF/);
  assert.match(page, /setVoiceoverPrompt\(DEFAULT_LEPERS_EDITORIAL_BRIEF\)/);
  assert.match(page, /localStorage\.setItem\(\s*EDITORIAL_BRIEF_VERSION_KEY,\s*EDITORIAL_BRIEF_SCHEMA_VERSION,?\s*\)/);
});
