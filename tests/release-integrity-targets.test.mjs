import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const targets=[
  ['release-integrity.ai-sales-platform.json','https://ai-sales-platform.vercel.app'],
  ['release-integrity.dana-studio.json','https://dana-studio-jet.vercel.app']
];

test('both production targets have independent configs',()=>{
  for(const [file,url] of targets){assert.equal(fs.existsSync(file),true,`${file} must exist`);const config=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(config.productionUrl,url);assert.equal(config.service,'dana-ai-production-studio');assert.equal(config.expectedRef,'main');assert.equal(config.manifestPath,'/api/release');assert.equal(config.backendHealth.url,`${url}/api/release-health`);assert.ok(config.smokeChecks.length>0);assert.ok(Number(config.retry?.timeoutMs)>0);}
});

test('Next release routes expose exact Vercel Git identity and stable health',()=>{
  const release=fs.readFileSync('app/api/release/route.ts','utf8');
  const health=fs.readFileSync('app/api/release-health/route.ts','utf8');
  assert.match(release,/VERCEL_GIT_COMMIT_SHA/);assert.match(release,/VERCEL_GIT_COMMIT_REF/);assert.match(release,/dana-ai-production-studio/);assert.match(release,/no-store/i);
  assert.match(health,/status[^\n]*ok/i);assert.match(health,/dana-ai-production-studio/);assert.doesNotMatch(health,/api\.openai|generativelanguage|ffmpeg-worker|firecrawl/i);
});

test('release workflow proves both targets from the same completed CI head SHA',()=>{
  assert.equal(fs.existsSync('.github/workflows/release-integrity.yml'),true,'release workflow must exist');
  const workflow=fs.readFileSync('.github/workflows/release-integrity.yml','utf8');
  assert.match(workflow,/workflows:\s*\[?"?CCGROUP Release CI/i);
  assert.match(workflow,/workflow_run\.head_sha/);
  assert.match(workflow,/release-integrity\.ai-sales-platform\.json/);
  assert.match(workflow,/release-integrity\.dana-studio\.json/);
  assert.match(workflow,/release-proof-ai-sales-platform\.json/);
  assert.match(workflow,/release-proof-dana-studio\.json/);
  assert.match(workflow,/if:\s*always\(\)/);
  assert.doesNotMatch(workflow,/--expected-sha[^\n]*github\.sha/);
});
