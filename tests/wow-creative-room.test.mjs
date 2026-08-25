import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const standard = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");
const score = fs.readFileSync("app/lib/lepers-golden-master.ts", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

test("WOW mode forces divergent creative thinking before final writing", () => {
  assert.match(route, /CREATIVE ROOM|CREATIVE EXECUTIVE PRODUCER/i);
  assert.match(route, /do not submit the first reasonable idea/i);
  assert.match(route, /factually conservative.*creatively aggressive/i);
  assert.match(route, /competing|divergent|alternatives/i);
  assert.match(route, /reject.*predictable|predictable.*reject/i);
});

test("Golden Master contract exposes a visible Creative Room and Format Spice", () => {
  assert.match(standard, /CREATIVE ROOM/i);
  assert.match(standard, /OTRĀ STĀSTA KANDIDĀTI/i);
  assert.match(standard, /NORAIDĪT.*PAREDZAM/i);
  assert.match(standard, /FORMAT SPICE/i);
  assert.match(standard, /KO MĒS PIEVIENOJAM/i);
  assert.match(standard, /DROSMĪGĀKĀ AIZSTĀVAMĀ IDEJA/i);
});

test("Freshness WOW score rejects technically correct but boring packages", () => {
  assert.match(score, /CREATIVE_FRESHNESS_THRESHOLD\s*=\s*80/);
  assert.match(score, /creativeFreshness/i);
  assert.match(score, /originalAngle/i);
  assert.match(score, /entertainmentSurprise/i);
  assert.match(score, /formatEnhancement/i);
  assert.match(score, /provocationTension/i);
  assert.match(score, /callbacksEngineering/i);
  assert.match(score, /visualCreativity/i);
  assert.match(route, /creativeFreshness.*passes|passes.*creativeFreshness/i);
  assert.match(route, /FRESHNESS|WOW/i);
});

test("Format Spice includes format-level devices, not only extra VO jokes", () => {
  assert.match(route, /countdown|freeze-frame|split-screen|scorecard|contradiction tracker|sound cue|chapter title/i);
  assert.match(route, /format.*richer|spice.*format|format enhancement/i);
  assert.match(route, /changes? how the scene.*presented|not merely.*VO/i);
});

test("visible editorial brief switches to WOW creative executive producer mode", () => {
  assert.match(page, /WOW mode/i);
  assert.match(page, /factually conservative.*creatively aggressive/i);
  assert.match(page, /FORMAT SPICE/i);
  assert.match(page, /do not submit the first reasonable idea/i);
});

test("primary editorial generation uses high reasoning for creative divergence", () => {
  assert.match(route, /reasoning:\s*\{\s*effort:\s*"high"\s*\}/);
});

test("legacy Lepers release cannot bypass the WOW Freshness gate", () => {
  const start = route.indexOf("if (!asyncMode)");
  const end = route.indexOf("const configuredModel", start);
  assert.ok(start >= 0 && end > start);
  const legacyBlock = route.slice(start, end);
  assert.match(legacyBlock, /creativeFreshness\?\.passes/);
  assert.match(legacyBlock, /WOW|Freshness/i);
});

test("correction passes retain Creative Executive Producer rules", () => {
  const start = route.indexOf("const correctionSystem");
  const end = route.indexOf("const correctionUser", start);
  assert.ok(start >= 0 && end > start);
  const correctionSystem = route.slice(start, end);
  const occurrences = correctionSystem.match(/CREATIVE_EXECUTIVE_PRODUCER_RULES/g) || [];
  assert.ok(occurrences.length >= 2, "both Lepers and selective VO correction branches must retain WOW rules");
});
