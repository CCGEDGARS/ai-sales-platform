import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=process.cwd();
const corePath=path.join(root,'scripts/release-integrity-core.mjs');
const SHA='0123456789abcdef0123456789abcdef01234567';

async function loadCore(){
  assert.equal(fs.existsSync(corePath),true,'release integrity core must exist');
  return import(`${pathToFileURL(corePath).href}?test=${Date.now()}-${Math.random()}`);
}

function response({status=200,json,text}={}){
  return {ok:status>=200&&status<300,status,async json(){return json;},async text(){return text??JSON.stringify(json??{});}};
}

function config(){return {
  schemaVersion:1,application:'DANA Test',service:'dana-ai-production-studio',productionUrl:'https://example.com',manifestPath:'/api/release',expectedRef:'main',
  backendHealth:{url:'https://example.com/api/release-health',status:200,json:{status:'ok',service:'dana-ai-production-studio'}},
  smokeChecks:[{id:'shell',type:'text',url:'/',status:200,contains:['DANA AI']}],retry:{attempts:1,delayMs:0,timeoutMs:50}
};}

async function provenFetch(url){const value=String(url);if(value.includes('/api/release?'))return response({json:{service:'dana-ai-production-studio',commit:SHA,ref:'main',provenance:'vercel-git'}});if(value.includes('/api/release-health'))return response({json:{status:'ok',service:'dana-ai-production-studio'}});return response({text:'DANA AI'});}

test('CI failure blocks before network access',async()=>{const {verifyRelease,VERDICTS}=await loadCore();let calls=0;const proof=await verifyRelease({config:config(),expectedSha:SHA,ciConclusion:'failure',fetchImpl:async()=>{calls++;return provenFetch('');}});assert.equal(calls,0);assert.equal(proof.verdict,VERDICTS.BLOCKED_CI);});

test('wrong live SHA is stale deployment',async()=>{const {verifyRelease,VERDICTS}=await loadCore();const proof=await verifyRelease({config:config(),expectedSha:SHA,ciConclusion:'success',fetchImpl:async url=>String(url).includes('/api/release?')?response({json:{service:'dana-ai-production-studio',commit:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',ref:'main'}}):provenFetch(url),nonce:'stale'});assert.equal(proof.verdict,VERDICTS.BLOCKED_STALE_DEPLOYMENT);});

test('backend health failure blocks proof',async()=>{const {verifyRelease,VERDICTS}=await loadCore();const proof=await verifyRelease({config:config(),expectedSha:SHA,ciConclusion:'success',fetchImpl:async url=>String(url).includes('/api/release-health')?response({status:503,json:{status:'error'}}):provenFetch(url),nonce:'health'});assert.equal(proof.verdict,VERDICTS.BLOCKED_BACKEND_HEALTH);});

test('smoke failure blocks proof',async()=>{const {verifyRelease,VERDICTS}=await loadCore();const proof=await verifyRelease({config:config(),expectedSha:SHA,ciConclusion:'success',fetchImpl:async url=>String(url).includes('/api/release?')||String(url).includes('/api/release-health')?provenFetch(url):response({text:'wrong shell'}),nonce:'smoke'});assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);});

test('all mandatory gates return PROVEN for one exact SHA',async()=>{const {verifyRelease,VERDICTS}=await loadCore();const proof=await verifyRelease({config:config(),expectedSha:SHA,ciConclusion:'success',ciRunId:'42',fetchImpl:provenFetch,nonce:'proof'});assert.equal(proof.verdict,VERDICTS.PROVEN);assert.equal(proof.expected.sha,SHA);assert.equal(proof.manifest.commit,SHA);assert.equal(proof.backend.passed,true);assert.equal(proof.smokeChecks.every(x=>x.passed),true);});

test('network requests are bounded by timeout',async()=>{const {fetchWithTimeout}=await loadCore();const started=Date.now();await assert.rejects(fetchWithTimeout(async()=>new Promise(()=>{}),'https://example.com',{},20),/timeout/i);assert.ok(Date.now()-started<500);});
