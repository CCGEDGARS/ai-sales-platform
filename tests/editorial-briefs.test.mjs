import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");

test("editorial tone selection owns a separate default brief for every built-in tone", () => {
  assert.match(page, /const EDITORIAL_TONE_BRIEFS:/);
  for (const tone of [
    "Lepers Standard · premium observational comedy",
    "Observational · sharp, warm and lightly humorous",
    "Dry irony · understated and precise",
    "Warm human · intimate and empathetic",
    "Rising tension · cinematic and controlled",
    "Fast bridge · concise and energetic",
    "Classic · British original",
  ]) {
    assert.match(page, new RegExp(tone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /dana-ai-editorial-briefs/);
});

test("changing editorial tone swaps to that tone's saved brief instead of leaving Lepers instructions behind", () => {
  assert.match(page, /function defaultEditorialBrief/);
  assert.match(page, /const changeEditorialTone/);
  assert.match(page, /setVoiceoverBriefs/);
  assert.match(page, /setVoiceoverPrompt\(nextBrief\)/);
  assert.match(page, /onChange=\{\(e\) => changeEditorialTone\(e\.target\.value\)\}/);
});

test("Tailored tone starts with an empty editorial brief and exposes a custom-direction placeholder", () => {
  assert.match(page, /Tailored · custom editorial direction/);
  assert.match(page, /TAILORED_TONE/);
  assert.match(page, /\[TAILORED_TONE\]:\s*""/);
  assert.match(page, /Describe the desired narrator attitude, humour level, pace, emotional tone/);
  assert.match(route, /Tailored · custom editorial direction/);
  assert.match(route, /TAILORED\. Follow the user's editorial brief as the primary stylistic direction/);
});

test("voice-over form labels the left field Editorial brief", () => {
  assert.match(page, /Editorial brief/);
  assert.doesNotMatch(page, /What should this bridge do\?/);
});
