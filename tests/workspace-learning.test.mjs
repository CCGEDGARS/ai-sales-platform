import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const typesPath = "app/lib/learning-types.ts";
const dataApiPath = "app/lib/learning-data-api.ts";
const repositoryPath = "app/lib/learning-repository.ts";
const sourcesRoutePath = "app/api/learning-sources/route.ts";
const sourceRoutePath = "app/api/learning-sources/[id]/route.ts";
const learnRoutePath = "app/api/learn-source/route.ts";
const contractPath = "app/lib/learning-contract.ts";
const profilePath = "app/lib/learning-profile.ts";
const contextPath = "app/lib/workspace-learning.ts";
const pagePath = "app/page.tsx";

function read(path) {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

test("workspace learning defines persistent source and profile contracts", () => {
  const source = read(typesPath);
  assert.match(source, /LearningAuthority/);
  assert.match(source, /LearningStatus/);
  assert.match(source, /LearningSource/);
  assert.match(source, /LearningProfile/);
  assert.match(source, /canonical/);
  assert.match(source, /supporting/);
  assert.match(source, /learned/);
});

test("Neon learning storage uses Vercel OIDC instead of a static database password", () => {
  const source = read(dataApiPath);
  assert.match(source, /x-vercel-oidc-token/i);
  assert.match(source, /VERCEL_OIDC_TOKEN/);
  assert.match(source, /Authorization/);
  assert.match(source, /Bearer/);
  assert.match(source, /ep-empty-cake-afyj282t\.apirest\.c-2\.us-west-2\.aws\.neon\.tech/);
  assert.match(source, /production/i);
  assert.doesNotMatch(source, /postgresql:\/\//i);
  assert.doesNotMatch(source, /DATABASE_URL/);
  assert.doesNotMatch(source, /npg_[A-Za-z0-9]+/);
});

test("learning storage fails closed when Vercel OIDC is unavailable", () => {
  const source = read(dataApiPath);
  assert.match(source, /requireVercelOidc/);
  assert.match(source, /OIDC[^\n]{0,80}(unavailable|required|missing)/i);
  assert.match(source, /cache:\s*["']no-store["']/);
});

test("learning repository persists source truth before learned status and supports duplicate/version lifecycle", () => {
  const repository = read(repositoryPath);
  const route = read(sourcesRoutePath);
  const itemRoute = read(sourceRoutePath);
  assert.match(repository, /registerLearningSource/);
  assert.match(repository, /source_fingerprint/);
  assert.match(repository, /active:\s*true|active[^\n]{0,40}true/);
  assert.match(repository, /authority[^\n]{0,50}supporting/);
  assert.match(repository, /saveLearningSourceContent/);
  assert.match(repository, /learning_source_content/);
  assert.match(repository, /duplicate/i);
  assert.match(repository, /version/i);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /export async function DELETE/);
});

test("deep learning analysis is a durable background job with verification gating", () => {
  const route = read(learnRoutePath);
  const contract = read(contractPath);
  const profile = read(profilePath);
  assert.match(route, /api\.openai\.com\/v1\/responses/);
  assert.match(route, /background:\s*true/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(route, /verifyLearningProfile/);
  assert.match(route, /extracting-learning|verifying/);
  assert.match(route, /status[^\n]{0,80}learned/);
  assert.match(contract, /What should DANA carry forward/i);
  assert.match(contract, /narrator/i);
  assert.match(contract, /humour/i);
  assert.match(contract, /voice.?over density/i);
  assert.match(contract, /callbacks/i);
  assert.match(contract, /editing/i);
  assert.match(contract, /source-bound|source specific facts|source-specific facts/i);
  assert.match(profile, /completeness/i);
  assert.match(profile, /coverage/i);
  assert.match(profile, /verified/i);
});

test("workspace retrieval enforces authority, active verified sources, provenance and Lepers weighting", () => {
  const context = read(contextPath);
  assert.match(context, /buildWorkspaceLearningContext/);
  assert.match(context, /canonical/);
  assert.match(context, /strong/);
  assert.match(context, /supporting/);
  assert.match(context, /experimental/);
  assert.match(context, /active/);
  assert.match(context, /verified|learned/);
  assert.match(context, /provenance|SOURCE:/i);
  assert.match(context, /Lepers/i);
  assert.match(context, /piekt|fifth diner/i);
  assert.match(context, /source-specific facts|source specific facts/i);
});

test("voice-over and transcription consume shared workspace learning server-side", () => {
  const voice = read("app/api/generate-voiceover/route.ts");
  const transcribe = read("app/api/transcribe/route.ts");
  const uploaded = read("app/api/transcribe-uploaded/route.ts");
  assert.match(voice, /buildWorkspaceLearningContext/);
  assert.match(transcribe, /buildWorkspaceLearningContext/);
  assert.match(uploaded, /buildWorkspaceLearningContext/);
});

test("every uploaded document and MKV/video automatically enters the learning pipeline", () => {
  const page = read(pagePath);
  assert.match(page, /startSourceLearning|beginSourceLearning|learnSource/);
  assert.match(page, /video-transcript/);
  assert.match(page, /document-text/);
  assert.match(page, /uploadVideoDirectlyToGemini/);
  assert.match(page, /transcribe-uploaded/);
  assert.match(page, /api\/learning-sources/);
  assert.match(page, /api\/learn-source/);
  assert.match(page, /Already learned/);
  assert.doesNotMatch(page, /if \(isVideoReferenceFile\(file\)\)[\s\S]{0,600}?Registered video reference[\s\S]{0,300}?continue;/);
});

test("Learning Library exposes lifecycle, workspace-wide toggle, profile inspector and retry controls", () => {
  const page = read(pagePath);
  for (const label of [
    "Uploading",
    "Extracting / Transcribing",
    "Analyzing",
    "Extracting learning",
    "Verifying",
    "Learned ✓",
    "Needs attention",
    "Retry available",
    "Use for learning",
    "View learning",
    "Re-analyze",
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(page, /learningInspector|selectedLearningProfile/);
  assert.match(page, /learningSources/);
});
