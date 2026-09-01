import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('agent policy is fail closed and forbids old build substitution',()=>{
  assert.equal(fs.existsSync('AGENTS.md'),true,'AGENTS.md must exist');
  assert.equal(fs.existsSync('.agents/skills/release-integrity/SKILL.md'),true,'release-integrity skill must exist');
  const text=`${read('AGENTS.md')}\n${read('.agents/skills/release-integrity/SKILL.md')}`;
  for(const token of ['LATEST CODE','VERIFIED PREVIEW','PROVEN PRODUCTION','LAST KNOWN WORKING','release-proof','exact','SHA'])assert.match(text,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.match(text,/fail[- ]closed/i);
  assert.match(text,/never[^\n]*(older|old)[^\n]*(current|latest)/i);
});
