import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const lepers = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");
const golden = fs.readFileSync("app/lib/lepers-golden-master.ts", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

test("active fifth-diner narrator presence is a primary system rule", () => {
  assert.match(route, /PRIMARY_NARRATOR_PRESENCE_RULES/);
  assert.match(route, /PRIMARY VO BEHAVIOUR RULE/i);
  assert.match(route, /conversationally present/i);
  assert.match(route, /directly address/i);
  assert.match(route, /react.*participant/i);
  assert.match(route, /challenge.*logic/i);
  assert.match(route, /viewer.*alliance/i);
  assert.match(route, /opening.*middle.*closing/i);
});

test("release quality has an independent narrator presence gate", () => {
  assert.match(route, /narratorPresenceMetrics/);
  assert.match(route, /narratorPresence/);
  assert.match(route, /presenceCoverage/);
  assert.match(route, /conversationalCues/);
  assert.match(route, /memoryCallbackCues/);
  assert.match(route, /fifthDinerPasses\s*=\s*editorialValuePasses\s*&&\s*narratorPresence\.passes/);
});

test("golden master cannot pass when narrator presence fails", () => {
  assert.match(golden, /NARRATOR_PRESENCE_THRESHOLD/);
  assert.match(golden, /narratorPresence/);
  assert.match(golden, /passes:\s*score\s*>=\s*LEPERS_GOLDEN_MASTER_THRESHOLD[\s\S]*narratorPresence\.passes/);
});

test("canonical contract explicitly requires active conversational presence", () => {
  assert.match(lepers, /PRIMARY NARRATOR PRESENCE/i);
  assert.match(lepers, /tieši uzrunāt/i);
  assert.match(lepers, /sarun/i);
  assert.match(lepers, /atcer/i);
  assert.match(lepers, /opening|sākum/i);
});

test("studio surfaces narrator presence and migrates the default brief", () => {
  assert.match(page, /Narrator Presence/i);
  assert.match(page, /2026-08-31-active-fifth-diner-v6/);
  assert.match(page, /conversationally present/i);
  assert.match(page, /directly react/i);
});
