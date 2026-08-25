import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const typesPath = "app/lib/learning-types.ts";
const dataApiPath = "app/lib/learning-data-api.ts";

test("workspace learning defines persistent source and profile contracts", () => {
  assert.equal(fs.existsSync(typesPath), true, `${typesPath} must exist`);
  if (!fs.existsSync(typesPath)) return;
  const source = fs.readFileSync(typesPath, "utf8");
  assert.match(source, /LearningAuthority/);
  assert.match(source, /LearningStatus/);
  assert.match(source, /LearningSource/);
  assert.match(source, /LearningProfile/);
  assert.match(source, /canonical/);
  assert.match(source, /supporting/);
  assert.match(source, /learned/);
});

test("Neon learning storage uses Vercel OIDC instead of a static database password", () => {
  assert.equal(fs.existsSync(dataApiPath), true, `${dataApiPath} must exist`);
  if (!fs.existsSync(dataApiPath)) return;
  const source = fs.readFileSync(dataApiPath, "utf8");
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
  if (!fs.existsSync(dataApiPath)) {
    assert.fail(`${dataApiPath} must exist`);
  }
  const source = fs.readFileSync(dataApiPath, "utf8");
  assert.match(source, /requireVercelOidc/);
  assert.match(source, /OIDC[^\n]{0,80}(unavailable|required|missing)/i);
  assert.match(source, /cache:\s*["']no-store["']/);
});
