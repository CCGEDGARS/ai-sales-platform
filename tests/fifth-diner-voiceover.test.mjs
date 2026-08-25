import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const lepers = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");

test("all editorial tones inherit the full fifth-diner point-of-view doctrine", () => {
  assert.match(route, /FIFTH_DINER_EDITORIAL_RULES/);
  assert.match(route, /piekt[aā] vakari[ņn]ot[aā]ja/i);
  assert.match(route, /viewer is likely thinking/i);
  assert.match(route, /internal dialogue/i);
  assert.match(route, /details the participants miss/i);
  assert.match(route, /running (?:jokes|gags)|callbacks/i);
  assert.match(route, /generic documentary narrator/i);
  assert.match(route, /selected tone changes HOW this fifth diner speaks/i);
});

test("empty observer reactions are explicitly treated as low-value VO", () => {
  assert.match(route, /isLowValueObserverCue/);
  for (const reaction of ["hmm", "jā", "traki", "nu gan"]) {
    assert.match(route.toLocaleLowerCase("lv-LV"), new RegExp(reaction));
  }
  assert.match(route, /fifthDinerPasses/);
  assert.match(route, /lowValueObserverCues/);
});

test("generic descriptive narration is detected and forces editorial correction", () => {
  assert.match(route, /isGenericDescriptiveCue/);
  assert.match(route, /genericDescriptiveCues/);
  assert.match(route, /editorialValuePasses/);
  assert.match(route, /requiresEditorialCorrection/);
  assert.match(route, /generic descriptive VO/i);
});

test("quality correction preserves active opinion, detail hunting and callbacks", () => {
  assert.match(route, /FIFTH_DINER_EDITORIAL_RULES/);
  assert.match(route, /correctionSystem[\s\S]*fifth diner/i);
  assert.match(route, /correctionUser[\s\S]*(?:opinion|interpretation|viewer-perspective)/i);
  assert.match(route, /correctionUser[\s\S]*(?:detail|callback|internal dialogue)/i);
});

test("Lepers canonical contract contains the full fifth dinner guest editorial test", () => {
  assert.match(lepers, /piekt[aā] vakari[ņn]ot[aā]ja/i);
  assert.match(lepers, /viedokli/i);
  assert.match(lepers, /skat[iī]t[aā]j/i);
  assert.match(lepers, /(?:nav|nevis) tikai nov[eē]rot[aā]js/i);
  assert.match(lepers, /internal dialogue|iekš[eē]j/i);
  assert.match(lepers, /callback|running/i);
  assert.match(lepers, /generic documentary narrator|dokument[aā]l/i);
});
