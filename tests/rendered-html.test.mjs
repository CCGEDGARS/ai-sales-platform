import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const transcribe = fs.readFileSync("app/api/transcribe/route.ts", "utf8");
const voiceoverRoute = fs.readFileSync("app/api/generate-voiceover/route.ts", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("saved API connections are restored from server health", () => {
  assert.match(page, /fetch\("\/api\/system-health"/);
  assert.match(page, /const geminiConnected\s*=/);
  assert.match(page, /setGeminiStatus\([\s\S]*?geminiConnected[\s\S]*?"Connected"/);
  assert.match(page, /setOpenAIStatus\([\s\S]*?openAIConnected[\s\S]*?"Connected"/);
});

test("voice-over can use a restored OpenAI cookie without exposing the key", () => {
  const voiceoverFunction = page.match(/const generateVoiceover = async \(\) => \{[\s\S]*?\n  \};/)?.[0] || "";
  assert.match(voiceoverFunction, /if \(openAIStatus !== "Connected"\)/);
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

test("multi-file video parts retain one cumulative episode timeline", () => {
  assert.match(page, /let cumulativeStartSeconds = 0/);
  assert.match(page, /startSeconds: cumulativeStartSeconds/);
  assert.match(page, /cumulativeStartSeconds \+= durations\[index\] \|\| 0/);
  assert.match(page, /localSeconds \+ segment\.startSeconds/);
});

test("SRT export includes every transcript result rather than only the first file", () => {
  assert.match(page, /transcriptResults\.flatMap\(\(result\) =>/);
  assert.doesNotMatch(page, /transcriptResults\[0\]\.transcript/);
  assert.match(page, /Math\.max\(start \+ 1, nextSeconds\)/);
});

test("production metadata does not advertise a development preview", () => {
  assert.doesNotMatch(layout, /codex-preview/);
});

test("Node runtime is pinned to the deployed major version", () => {
  assert.equal(pkg.engines?.node, "24.x");
});

test("large videos bypass the Vercel payload limit without exposing the saved Gemini key", () => {
  assert.match(page, /VERCEL_NATIVE_PROXY_LIMIT/);
  assert.match(page, /fetch\("\/api\/gemini-upload-session"/);
  assert.match(page, /fetch\("\/api\/gemini-file-status"/);
  assert.match(page, /fetch\("\/api\/transcribe-uploaded"/);
  assert.match(page, /nativeProxySafe =\s*nativeFfmpeg\s*&&\s*videoFiles\.length === 1/);
  assert.equal(fs.existsSync("app/api/gemini-upload-session/route.ts"), true);
  assert.equal(fs.existsSync("app/api/gemini-file-status/route.ts"), true);
  assert.equal(fs.existsSync("app/api/transcribe-uploaded/route.ts"), true);
  const uploadSession = fs.readFileSync("app/api/gemini-upload-session/route.ts", "utf8");
  const fileStatus = fs.readFileSync("app/api/gemini-file-status/route.ts", "utf8");
  const uploadedTranscription = fs.readFileSync("app/api/transcribe-uploaded/route.ts", "utf8");
  assert.match(uploadSession, /getStoredKey\("gemini"\)/);
  assert.match(fileStatus, /getStoredKey\("gemini"\)/);
  assert.match(uploadedTranscription, /getStoredKey\("gemini"\)/);
  const secureDirectFunction = page.match(/const transcribeVideoDirectly = async \([\s\S]*?\n  \};/)?.[0] || "";
  assert.doesNotMatch(secureDirectFunction, /x-goog-api-key/);
});

test("large video bytes go through the controlled native upload proxy instead of a Google browser upload URL", () => {
  const uploadSession = fs.readFileSync("app/api/gemini-upload-session/route.ts", "utf8");
  const worker = fs.readFileSync("services/ffmpeg-worker/main.py", "utf8");
  assert.match(uploadSession, /\/upload-proxy\/authorize/);
  assert.match(uploadSession, /\/upload-proxy\/\$\{encodeURIComponent\(token\)\}/);
  assert.match(worker, /CORSMiddleware/);
  assert.match(worker, /@app\.post\("\/upload-proxy\/authorize"\)/);
  assert.match(worker, /@app\.post\("\/upload-proxy\/\{token\}"\)/);
  assert.match(worker, /async for chunk in request\.stream\(\)/);
});

test("voice-over backend cannot repeat the 300-second synchronous timeout architecture", () => {
  assert.match(voiceoverRoute, /background:\s*true/);
  assert.match(voiceoverRoute, /export async function GET/);
  assert.match(voiceoverRoute, /encodeURIComponent\(responseId\)/);
  assert.match(voiceoverRoute, /LEGACY_VOICEOVER_MODEL = "gpt-5\.6-terra"/);
  assert.match(voiceoverRoute, /reasoning:\s*\{ effort: "none" \}/);
  assert.match(voiceoverRoute, /setTimeout\(\(\) => controller\.abort\(\), 50_000\)/);
  assert.match(voiceoverRoute, /x-dana-voiceover-mode/);
});
