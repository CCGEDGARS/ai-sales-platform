import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const contract = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");
const goldenMaster = fs.readFileSync("app/lib/lepers-golden-master.ts", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

test("DANA has a mandatory Second Story editorial authorship doctrine", () => {
  assert.match(route, /SECOND_STORY_EDITORIAL_RULES/);
  assert.match(route, /editorial co-author/i);
  assert.match(route, /invent the editorial idea around reality/i);
  assert.match(route, /metaphor|comic premise/i);
  assert.match(route, /prediction|hypothesis/i);
  assert.match(route, /never invent events|never invent facts/i);
});

test("the Lepers package must explicitly name and develop the Second Story", () => {
  assert.match(contract, /OTRĀ STĀSTA LĪNIJA/);
  assert.match(contract, /verified reality|pārbaud.*realit|avot/i);
  assert.match(contract, /setup.*payoff|solīj.*atgriezt|callback/i);
});

test("Golden Master scoring and repair enforce editorial authorship instead of reflection-only VO", () => {
  assert.match(goldenMaster, /secondStory/i);
  assert.match(goldenMaster, /OTRĀ STĀSTA LĪNIJA/);
  assert.match(goldenMaster, /reflection|atspoguļ/i);
  assert.match(route, /SECOND STORY:/);
  assert.match(route, /preserve.*second story|develop.*second story/i);
});

test("legacy synchronous Lepers generation cannot bypass the Second Story gate", () => {
  const start = route.indexOf("if (!asyncMode)");
  const end = route.indexOf("const configuredModel", start);
  assert.ok(start >= 0 && end > start);
  const legacyBlock = route.slice(start, end);
  assert.match(legacyBlock, /goldenMaster/);
  assert.match(legacyBlock, /secondStory\?\.passes|goldenMaster\.passes/);
  assert.match(legacyBlock, /Refresh|refresh/);
});

test("the visible default Editorial brief tells DANA to create a Second Story", () => {
  assert.match(page, /Second Story/i);
  assert.match(page, /create|veido|build/i);
  assert.match(page, /EDITORIAL_BRIEF_SCHEMA_VERSION\s*=\s*"2026-08-25-second-story-v3"/);
});
