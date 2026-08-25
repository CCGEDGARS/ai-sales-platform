import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");

test("WOW generation has enough output headroom for high reasoning plus the full package", () => {
  assert.match(route, /BACKGROUND_MAX_OUTPUT_TOKENS\s*=\s*64_000/);
  assert.match(route, /MAX_OUTPUT_RECOVERY_TOKENS\s*=\s*96_000/);
  assert.match(route, /max_output_tokens:\s*maxOutputTokens/);
});

test("max_output_tokens incomplete jobs recover automatically instead of surfacing the raw provider reason", () => {
  assert.match(route, /data\.status\s*===\s*"incomplete"/);
  assert.match(route, /incomplete_details\?\.reason\s*===\s*"max_output_tokens"/);
  assert.match(route, /MAX_OUTPUT_RECOVERIES/);
  assert.match(route, /previousResponseId:\s*responseId/);
  assert.match(route, /maxOutputTokens:\s*MAX_OUTPUT_RECOVERY_TOKENS/);
  assert.match(route, /phase:\s*"output-expansion"/);
});

test("output expansion is tracked separately from Golden Master correction attempts", () => {
  assert.match(route, /dana_output_recovery_attempt/);
  assert.match(route, /outputRecoveryAttempt/);
});
