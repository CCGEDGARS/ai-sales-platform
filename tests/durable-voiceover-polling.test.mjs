import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");

test("background voiceover polling does not abandon a healthy job after 15 minutes", () => {
  assert.doesNotMatch(page, /pollCount\s*>\s*360/);
  assert.doesNotMatch(page, /still processing after 15 minutes/);
  assert.match(page, /MAX_VOICEOVER_POLL_COUNT/);
  assert.match(page, /still working/i);
});

test("pending OpenAI response survives long processing and resumes after reload", () => {
  assert.match(page, /dana-ai-pending-voiceover/);
  assert.match(page, /Restoring the pending DANA AI generation/i);
  assert.match(page, /pollVoiceoverJob\(pendingResponseId/);
});

test("polling UI exposes output expansion and correction phases", () => {
  assert.match(page, /result\.phase\s*===\s*"output-expansion"/);
  assert.match(page, /expanded output budget/i);
  assert.match(page, /result\.phase\s*===\s*"correction"/);
});
