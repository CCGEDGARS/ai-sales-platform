import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const lepers = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");

test("all editorial tones inherit the fifth-diner point-of-view rule", () => {
  assert.match(route, /FIFTH_DINER_EDITORIAL_RULES/);
  assert.match(route, /piekt[aā] vakari[ņn]ot[aā]ja/i);
  assert.match(route, /viewer is likely thinking/i);
  assert.match(route, /not merely an observer/i);
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

test("quality correction preserves active opinion rather than padding with reactions", () => {
  assert.match(route, /FIFTH_DINER_EDITORIAL_RULES/);
  assert.match(route, /correctionSystem[\s\S]*fifth diner/i);
  assert.match(route, /correctionUser[\s\S]*opinion|interpretation|viewer-perspective/i);
});

test("Lepers canonical contract defines narrator as the fifth dinner guest", () => {
  assert.match(lepers, /piekt[aā] vakari[ņn]ot[aā]ja/i);
  assert.match(lepers, /viedokli/i);
  assert.match(lepers, /skat[iī]t[aā]j/i);
  assert.match(lepers, /nav tikai nov[eē]rot[aā]js/i);
});
