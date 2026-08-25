import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");

test("Golden Master rescue has enough correction headroom", () => {
  assert.match(route, /const MAX_BACKGROUND_CORRECTIONS = [5-9]/);
});

test("Golden Master rescue tells the model the exact deterministic score gaps", () => {
  assert.match(route, /goldenMasterRepairInstructions/);
  assert.match(route, /1400/);
  assert.match(route, /10 edit rows/i);
  assert.match(route, /4 risk rows/i);
  assert.match(route, /5 teaser/i);
  assert.match(route, /4 social hooks/i);
  assert.match(route, /JSON\.stringify\(goldenMaster\?\.dimensions/);
});

test("correction uses the strongest configured model first and Terra only as fallback", () => {
  assert.match(route, /createCorrectionResponse/);
  assert.match(route, /process\.env\.OPENAI_VOICEOVER_MODEL\s*\|\|\s*PRIMARY_VOICEOVER_MODEL/);
  assert.match(route, /modelUnavailable/);
  assert.match(route, /FALLBACK_VOICEOVER_MODEL/);
  assert.doesNotMatch(route, /const correction = await createBackgroundResponse\(\{[\s\S]{0,220}model:\s*FALLBACK_VOICEOVER_MODEL/);
});
