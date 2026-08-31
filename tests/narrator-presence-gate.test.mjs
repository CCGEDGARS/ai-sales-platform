import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/generate-voiceover/route.ts", import.meta.url), "utf8");
const standard = fs.readFileSync(new URL("../app/lib/lepers-standard.ts", import.meta.url), "utf8");
const golden = fs.readFileSync(new URL("../app/lib/lepers-golden-master.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("primary narrator presence rule is injected into generation and correction paths", () => {
  assert.match(route, /PRIMARY VO BEHAVIOUR RULE — ACTIVE FIFTH DINNER GUEST/);
  assert.match(route, /narratorPresenceMetrics\(cueLines\)/);
  assert.match(route, /narratorPresenceMetrics\(masterCueTexts\)/);
});

test("short authentic reactions are not globally rejected", () => {
  const observerSet = route.match(/const emptyObserverReactions = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  assert.doesNotMatch(observerSet, /ak vai/i);
  assert.doesNotMatch(observerSet, /nu ko/i);
  assert.doesNotMatch(observerSet, /oho/i);
});

test("Golden Master has an independent narrator presence release gate", () => {
  assert.match(golden, /narratorPresence: NarratorPresenceMetrics/);
  assert.match(golden, /creativeFreshness\.passes && narratorPresence\.passes/);
  assert.match(route, /!goldenMaster\.narratorPresence\?\.passes/);
});

test("production contract and default brief preserve active fifth guest without increasing VO ratio", () => {
  assert.match(standard, /PRIMARY NARRATOR PRESENCE — OBLIGĀTS/);
  assert.match(standard, /16\.67% princips paliek spēkā/);
  assert.match(page, /active-fifth-diner-v6/);
  assert.match(page, /Presence does not mean more VO/);
});
