import test from "node:test";
import assert from "node:assert/strict";
import { narratorPresenceMetrics, NARRATOR_PRESENCE_THRESHOLD } from "../app/lib/narrator-presence.ts";

test("active fifth-diner voice passes the narrator presence gate", () => {
  const result = narratorPresenceMetrics([
    "[00:00:10] VO: Rihard, tu teici, ka viss ir kontrolē. Mēs šo teikumu atcerēsimies.",
    "[00:00:40] VO: Nu ko, pagaidām teorija izskatās pārliecinoši.",
    "[00:01:20] VO: Linda vēl neko nav pateikusi. Seja gan.",
    "[00:02:10] VO: Pagaidi — tiešām?",
    "[00:03:00] VO: Virtuve tikko iesniedza pirmo iebildumu.",
    "[00:04:00] VO: Atgriežamies pie vārdiem ‘viss ir kontrolē’.",
    "[00:05:10] VO: Horens, uzmanīgi. Šim jokam vēl var būt otrā sērija.",
    "[00:06:00] VO: Nu ko, redzēsim — plāns vai pulkstenis?",
    "[00:07:00] VO: Un tomēr… izskatās, ka Rihards savu solījumu izglāba.",
  ]);
  assert.ok(result.score >= NARRATOR_PRESENCE_THRESHOLD, JSON.stringify(result));
  assert.equal(result.passes, true, JSON.stringify(result));
  assert.ok(result.presenceCoverage >= 2);
  assert.ok(result.conversationalCues >= 2);
  assert.ok(result.memoryCallbackCues >= 1);
});

test("neutral explanatory narration fails even when grammatically polished", () => {
  const result = narratorPresenceMetrics([
    "[00:00:10] VO: Tagad saimnieks sāk gatavot vakariņas.",
    "[00:01:00] VO: Viesi ierodas mājā un sasveicinās.",
    "[00:02:00] VO: Saimnieks pasniedz pirmo ēdienu.",
    "[00:03:00] VO: Viesi pārrunā ēdiena garšu.",
    "[00:04:00] VO: Pēc tam visi dodas uz nākamo aktivitāti.",
    "[00:05:00] VO: Vakara noslēgumā tiek pasniegts deserts.",
  ]);
  assert.equal(result.passes, false);
  assert.ok(result.score < NARRATOR_PRESENCE_THRESHOLD, JSON.stringify(result));
  assert.ok(result.deficiencies.some((item) => /conversationally present/i.test(item)));
});

test("one isolated joke does not compensate for a passive scene", () => {
  const result = narratorPresenceMetrics([
    "Tagad saimnieks gatavo vakariņas.",
    "Viesi ierodas pie galda.",
    "Pagaidi — tiešām?",
    "Tālāk tiek pasniegts pamatēdiens.",
    "Viesi runā par ēdienu.",
    "Vakars turpinās ar desertu.",
    "Dalībnieki beigās novērtē vakaru.",
  ]);
  assert.equal(result.passes, false, JSON.stringify(result));
  assert.ok(result.presenceCoverage < 2 || result.conversationalCues < 2);
});
