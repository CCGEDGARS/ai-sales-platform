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

test("edited Lepers brief is a global scene directive that must influence the entire production package", () => {
  assert.match(route, /GLOBAL SCENE DIRECTIVE/);
  assert.match(route, /all 8 sections of the Lepers production package/i);
  assert.match(route, /EP decision/i);
  assert.match(route, /dramaturgy/i);
  assert.match(route, /KEEP \/ TIGHTEN \/ REMOVE \/ VERIFY/i);
  assert.match(route, /VO MASTER/i);
  assert.match(route, /teasers and promo/i);
  assert.match(route, /editing and sound/i);
  assert.match(route, /final producer recommendation/i);
  assert.match(route, /must not override mandatory channel rules/i);
});
