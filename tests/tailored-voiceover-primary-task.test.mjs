import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");

test("tailored voice-over is the primary product task in the workspace", () => {
  assert.match(page, /Tailored Voice-over Studio/);
  assert.match(page, /PRIMARY TASK · TAILORED VOICE-OVER/);
  assert.match(page, /Create tailored voice-over/);
  assert.match(page, /Fifth Dinner Guest/);
  assert.match(page, /Second Story/);
  assert.match(page, /WOW/);
  assert.match(page, /Narrator Presence/);
  assert.match(page, /Golden Master/);
});

test("generation and all repair paths preserve the tailored voice-over mission", () => {
  assert.match(route, /PRIMARY PRODUCT MISSION — TAILORED VOICE-OVER/);
  assert.match(route, /main job is to create a scene-specific, tailored voice-over/i);
  const uses = route.match(/\$\{TAILORED_VOICEOVER_MISSION_RULES\}/g) || [];
  assert.ok(uses.length >= 4, `expected mission in generation, recovery and correction paths, got ${uses.length}`);
});
