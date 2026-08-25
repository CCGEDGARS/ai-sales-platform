import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const standard = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
let golden = "";
try { golden = fs.readFileSync("app/lib/lepers-golden-master.ts", "utf8"); } catch {}

test("Lepers Golden Master is a locked 10/10 benchmark with measured reference fingerprint", () => {
  assert.match(golden, /Lepers Golden Master · locked 10\/10 benchmark/);
  assert.match(golden, /LEPERS_GOLDEN_MASTER_THRESHOLD\s*=\s*95/);
  assert.match(golden, /referencePages:\s*16/);
  assert.match(golden, /dramaturgyActs:\s*7/);
  assert.match(golden, /teaserBeats:\s*5/);
  assert.match(golden, /socialHooks:\s*4/);
  assert.match(golden, /targetVoRatio:\s*1\s*\/\s*6/);
});

test("Golden Master scorer covers the nine agreed dimensions totalling 100 points", () => {
  for (const label of ["structure", "depth", "voAmount", "humourAndPov", "pace", "productionUsefulness", "promo", "characterInsight", "formatting"]) {
    assert.match(golden, new RegExp(label));
  }
  assert.match(golden, /scoreLepersGoldenMaster/);
  assert.match(golden, /total:\s*100/);
});

test("Lepers generation injects Golden Master fingerprint and automatically corrects below 95", () => {
  assert.match(route, /lepers-golden-master/);
  assert.match(route, /scoreLepersGoldenMaster/);
  assert.match(route, /LEPERS_GOLDEN_MASTER_THRESHOLD/);
  assert.match(route, /goldenMaster\.score\s*<\s*LEPERS_GOLDEN_MASTER_THRESHOLD/);
  assert.match(route, /GOLDEN MASTER CONFORMANCE/);
  assert.match(route, /goldenMaster/);
});

test("canonical contract locks production standard while allowing content variation", () => {
  assert.match(standard, /Variation is allowed in content, never in production standard/);
  assert.match(standard, /Golden Master/);
});

test("UI identifies the locked Golden Master mode and can show the match score", () => {
  assert.match(page, /Lepers Golden Master · locked 10\/10 benchmark/);
  assert.match(page, /Golden Master Match/);
});
