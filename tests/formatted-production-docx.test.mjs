import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const formatterPath = "app/lib/formatted-production-docx.ts";
const pagePath = "app/page.tsx";

test("final production DOCX has the Rihards Lepers visual production system", () => {
  assert.equal(fs.existsSync(formatterPath), true, `${formatterPath} must exist`);
  if (!fs.existsSync(formatterPath)) return;
  const source = fs.readFileSync(formatterPath, "utf8");
  assert.match(source, /Tahoma/);
  assert.match(source, /17233B/);
  assert.match(source, /B58B2A/);
  assert.match(source, /F3EAD2/);
  assert.match(source, /PageOrientation\.LANDSCAPE/);
  assert.match(source, /VO MASTER/);
  assert.match(source, /GALA VO TEKSTS/);
  assert.match(source, /DANA AI/);
  assert.match(source, /parseProductionMarkdown/);
  assert.match(source, /buildFormattedProductionDocx/);
});

test("final DOCX formatter preserves structured markdown as Word tables and styled sections", () => {
  assert.equal(fs.existsSync(formatterPath), true, `${formatterPath} must exist`);
  if (!fs.existsSync(formatterPath)) return;
  const source = fs.readFileSync(formatterPath, "utf8");
  assert.match(source, /TableRow/);
  assert.match(source, /TableCell/);
  assert.match(source, /KEEP/);
  assert.match(source, /TIGHTEN/);
  assert.match(source, /REMOVE/);
  assert.match(source, /VERIFY/);
  assert.match(source, /RED/);
  assert.match(source, /AMBER/);
  assert.match(source, /footer/i);
});

test("voice-over download uses the formatted production DOCX instead of the old plain export", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /buildFormattedProductionDocx/);
  assert.match(source, /Download formatted final DOCX/);
  assert.doesNotMatch(source, /new Paragraph\(voiceoverDraft\)/);
  assert.match(source, /production-ready formatted DOCX/i);
});
