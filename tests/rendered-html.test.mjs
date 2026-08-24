import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const transcribe = fs.readFileSync("app/api/transcribe/route.ts", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("saved API connections are restored from server health", () => {
  assert.match(page, /fetch\("\/api\/system-health"/);
  assert.match(page, /setGeminiStatus\(geminiConnected \? "Connected"/);
  assert.match(page, /setOpenAIStatus\(openAIConnected \? "Connected"/);
});

test("voice-over can use a restored OpenAI cookie without exposing the key", () => {
  assert.match(page, /if \(openAIStatus !== "Connected"\)/);
  assert.match(transcribe, /getStoredKey\("gemini"\)/);
});

test("video dropzone supports real drag and drop", () => {
  assert.match(page, /onDragOver=\{\(e\) =>/);
  assert.match(page, /onDrop=\{\(e\) =>/);
  assert.match(page, /onFiles\(e\.dataTransfer\.files\)/);
});

test("PDF export uses a browser print document so Latvian text and multipage output are preserved", () => {
  assert.match(page, /window\.open\("", "_blank"\)/);
  assert.match(page, /Save as PDF/);
  assert.doesNotMatch(page, /PDFDocument\.create\(/);
});

test("production metadata does not advertise a development preview", () => {
  assert.doesNotMatch(layout, /codex-preview/);
});

test("Node runtime is pinned to the deployed major version", () => {
  assert.equal(pkg.engines?.node, "24.x");
});
