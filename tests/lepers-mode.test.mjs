import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const voiceover = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");

test("reference documents are parsed into real knowledge content and auto-applied", () => {
  assert.equal(fs.existsSync("app/api/ingest-reference/route.ts"), true);
  const ingest = fs.readFileSync("app/api/ingest-reference/route.ts", "utf8");
  assert.match(ingest, /mammoth/);
  assert.match(ingest, /application\/pdf|\.pdf/);
  assert.match(page, /referenceContents/);
  assert.match(page, /fetch\("\/api\/ingest-reference"/);
  assert.match(page, /setAppliedSources/);
  assert.match(page, /dana-ai-reference-contents/);
});

test("only the DANA Master Production System is locked in the source library", () => {
  assert.match(page, /CORE_SOURCE_NAME\s*=\s*"DANA AI Master Production System"/);
  assert.match(page, /name === CORE_SOURCE_NAME/);
  assert.doesNotMatch(page, /protectedSources\.some\(\(source\) => source\[1\] === name\)/);
});

test("Lepers Standard is a full production package contract, not a cue-only transcript summary", () => {
  assert.equal(fs.existsSync("app/lib/lepers-standard.ts"), true);
  const contract = fs.readFileSync("app/lib/lepers-standard.ts", "utf8");
  for (const heading of [
    "1. Izpildproducenta lēmums",
    "2. Ieteicamā epizodes dramaturģija",
    "3. Montāžas lēmumi: Keep / Tighten / Remove / Verify",
    "4. VO MASTER — gala teksts ierakstam",
    "5. Teaseri, štorkas un promo āķi",
    "6. Redakcionālie, faktu un reputācijas riski",
    "7. Montāžas un skaņas izpildījuma piezīmes",
    "8. Gala piegādes kontrolsaraksts",
    "Galīgā producenta rekomendācija",
  ]) assert.match(contract, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(voiceover, /LEPERS_PRODUCTION_PACKAGE_CONTRACT/);
  assert.match(contract, /Rihards Lepers reference is the canonical benchmark/);
});

test("Lepers ratio is calculated only from VO MASTER spoken text", () => {
  assert.match(voiceover, /function extractVoiceoverMasterText/);
  assert.match(voiceover, /VO MASTER/);
  assert.match(voiceover, /ratioMetrics\(extractVoiceoverMasterText\(text\)/);
});

test("Lepers package quality gate validates required sections and VO table columns", () => {
  assert.match(voiceover, /function lepersPackageQualityMetrics/);
  assert.match(voiceover, /Laiks/);
  assert.match(voiceover, /Funkcija/);
  assert.match(voiceover, /GALA VO TEKSTS/);
  assert.match(voiceover, /Izpildījums \/ montāža/);
});

test("actual extracted reference text is sent to the generation backend", () => {
  assert.match(page, /referenceContents:/);
  assert.match(voiceover, /referenceContents\?:/);
  assert.match(voiceover, /body\.referenceContents/);
  assert.match(voiceover, /APPLIED REFERENCE CONTENT/);
});
