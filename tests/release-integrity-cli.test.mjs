import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

const cliPath=path.join(process.cwd(),'scripts/verify-release-integrity.mjs');
const SHA='0123456789abcdef0123456789abcdef01234567';
async function loadCli(){assert.equal(fs.existsSync(cliPath),true,'release integrity CLI must exist');return import(`${pathToFileURL(cliPath).href}?test=${Date.now()}-${Math.random()}`);}

test('CLI requires exact SHA and CI conclusion',async()=>{const {parseArgs}=await loadCli();assert.throws(()=>parseArgs([]),/expected-sha/i);assert.throws(()=>parseArgs(['--expected-sha',SHA]),/ci-conclusion/i);});
test('only PROVEN has zero exit code',async()=>{const {exitCodeForVerdict}=await loadCli();assert.equal(exitCodeForVerdict('PROVEN'),0);for(const verdict of ['BLOCKED_CI','BLOCKED_STALE_DEPLOYMENT','BLOCKED_BACKEND_HEALTH','BLOCKED_SMOKE_CHECK','INCOMPLETE_VERIFICATION'])assert.notEqual(exitCodeForVerdict(verdict),0);});
test('proof writer persists blocked evidence',async()=>{const {writeProof}=await loadCli();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ccgroup-proof-'));const target=path.join(dir,'proof.json');const proof={schemaVersion:1,verdict:'BLOCKED_CI',failures:['CI failed']};await writeProof(target,proof);assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),proof);});
test('CLI supports target-specific config and proof paths',async()=>{const {parseArgs}=await loadCli();const args=parseArgs(['--expected-sha',SHA,'--ci-conclusion','success','--config','release-integrity.dana-studio.json','--proof','release-proof-dana-studio.json']);assert.equal(args.configPath,'release-integrity.dana-studio.json');assert.equal(args.proofPath,'release-proof-dana-studio.json');});
