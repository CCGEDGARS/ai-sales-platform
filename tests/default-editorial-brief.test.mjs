import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");

const expectedBrief = "Create the complete Latvian package at the Lepers Golden Master standard. VO is the invisible fifth dinner guest: warm, opinionated, lightly ironic and observant. Say what the viewer is thinking, notice details others miss, use internal dialogue, contradictions, provocation and callbacks when earned. Every VO must add story, humour, tension, character or emotion—never generic description or empty reactions. Protect strong dialogue and silence, never invent facts or humiliate participants, and keep VO selective near the 16.67% target without padding.";

test("default Lepers editorial brief exposes the compact Fifth Dinner Guest doctrine", () => {
  assert.match(page, new RegExp(expectedBrief.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /invisible fifth dinner guest/i);
  assert.match(page, /internal dialogue/i);
  assert.match(page, /details others miss/i);
  assert.match(page, /provocation and callbacks/i);
  assert.match(page, /never generic description or empty reactions/i);
  assert.match(page, /16\.67% target without padding/i);
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
  assert.match(page, /localStorage\.setItem\(EDITORIAL_BRIEF_VERSION_KEY,\s*EDITORIAL_BRIEF_SCHEMA_VERSION\)/);
});
