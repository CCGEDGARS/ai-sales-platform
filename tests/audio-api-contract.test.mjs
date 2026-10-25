import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {resolveMediaType,isVideoMedia} from '../app/lib/media.ts';

// Execute the actual route bodies. Only cookies, framework response wrapper and
// external HTTP calls are replaced; media validation and request construction run.
function loadRoute(path, fetchImpl) {
  const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  const media=ts.transpileModule(fs.readFileSync('app/lib/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mediaModule={exports:{}};
  new Function('exports',media)(mediaModule.exports);
  const require=(name)=>{
    if(name==='next/server')return {NextResponse:{json:(body,options)=>Response.json(body,options)}};
    if(name.endsWith('/credentials'))return {getStoredKey:async()=>'test-only-placeholder'};
    if(name.endsWith('/media'))return mediaModule.exports;
    if(name==='node:crypto')return {default:globalThis.crypto};
    throw new Error('Unexpected dependency '+name);
  };
  new Function('require','exports','fetch',source)(require,module.exports,fetchImpl);
  return module.exports.POST;
}

test('upload session forwards canonical WhatsApp MIME to the existing secure proxy',async()=>{
  let forwarded;
  const post=loadRoute('app/api/gemini-upload-session/route.ts',async(_url,options)=>{
    forwarded=JSON.parse(options.body);return Response.json({ok:true});
  });
  const response=await post(new Request('https://example.test',{method:'POST',body:JSON.stringify({fileName:'WhatsApp Audio.opus',fileSize:100,mimeType:'application/octet-stream'})}));
  assert.equal(response.status,200);
  assert.equal(forwarded.mimeType,'audio/ogg');
  assert.equal((await response.json()).ok,true);
});

test('uploaded normalized audio is transcribed as FLAC and preserves original filename',async()=>{
  let forwarded;
  const post=loadRoute('app/api/transcribe-uploaded/route.ts',async(_url,options)=>{
    forwarded=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{text:'[00:00:00] Runātājs 1: Labvakar!'}]}}]});
  });
  const response=await post(new Request('https://example.test',{method:'POST',body:JSON.stringify({originalFile:'WhatsApp.opus',uploadedFile:{name:'files/abc',uri:'https://generativelanguage.googleapis.com/v1beta/files/abc',mimeType:'audio/flac'}})}));
  assert.equal(response.status,200);
  assert.equal(forwarded.contents[0].parts[0].file_data.mime_type,'audio/flac');
  const data=await response.json();
  assert.equal(data.fileName,'WhatsApp.opus');
  assert.equal(data.timecodes,true);
});

test('bad types and invalid files fail before any provider request',async()=>{
  const fetchNever=()=>{throw new Error('Provider must not be called');};
  for(const [path,payload] of [
    ['app/api/gemini-upload-session/route.ts',{fileName:'document.pdf',fileSize:100,mimeType:'audio/mpeg'}],
    ['app/api/transcribe-uploaded/route.ts',{uploadedFile:{name:'files/abc',uri:'https://generativelanguage.googleapis.com/v1beta/files/abc',mimeType:'application/octet-stream'}}],
    ['app/api/visual-evidence-uploaded/route.ts',{uploadedFile:{name:'files/abc',uri:'https://generativelanguage.googleapis.com/v1beta/files/abc',mimeType:'audio/flac'}}],
  ]){
    const response=await loadRoute(path,fetchNever)(new Request('https://example.test',{method:'POST',body:JSON.stringify(payload)}));
    assert.equal(response.status,400);
  }
});

function loadClientFunction(startMarker,endMarker,context) {
  const page=fs.readFileSync('app/page.tsx','utf8');
  const code=page.slice(page.indexOf(startMarker),page.indexOf(endMarker,page.indexOf(startMarker)));
  const name=startMarker.match(/const (\w+)/)[1];
  const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(context),`${compiled}\nreturn ${name};`)(...Object.values(context));
}

test('real client transcription never requests visual evidence for audio, including detected audio-only WebM',async()=>{
  for (const [name,type] of [['WhatsApp.opus',''],['voice.webm','video/webm']]) {
    const requests=[];
    const transcribe=loadClientFunction('const transcribeVideoDirectly = async (','  const analyzeVisualEvidenceDirectly = async (',{
      resolveMediaType,
      uploadVideoDirectlyToGemini:async()=>({name:'files/test',uri:'https://generativelanguage.googleapis.com/v1beta/files/test',mimeType:'audio/flac',sourceMediaKind:'audio',sourceDurationSeconds:2.5}),
      waitForGeminiVideo:async()=>{},GEMINI_DIRECT_MODEL:'test-model',buildReferenceBrief:()=>'',appliedSources:[],
      fetch:async(url)=>{requests.push(url);return Response.json({ok:true,transcript:'[00:00:00] Labvakar!',timecodes:true});},
    });
    const result=await transcribe(new File(['fixture'],name,{type}),'',()=>{});
    assert.deepEqual(requests,['/api/transcribe-uploaded']);
    assert.equal(result.visualEvidenceAvailable,false);
    assert.equal(result.sourceDurationSeconds,2.5);
  }
});

test('real batch orchestration restores mixed audio/video offsets from exact uploaded source durations',async()=>{
  const files=[new File(['1'],'first.opus'),new File(['2'],'middle.mp4'),new File(['3'],'last.mp3')];
  const sourceDurations=[2.3,8.5,4];
  let returned, runtime, failure;
  const context={uploaded:true,geminiStatus:'Connected',nativeFfmpeg:false,videoFiles:files,VERCEL_NATIVE_PROXY_LIMIT:3800000,geminiKey:'',chunkLength:'10',GEMINI_DIRECT_MODEL:'test-model',isVideoMedia,
    document:{createElement:()=>{
      const element={duration:1,removeAttribute(){},load(){},set src(_url){queueMicrotask(()=>element.onloadedmetadata?.());}};
      return element;
    }},
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},window:{setTimeout,clearTimeout},
    transcribeVideoDirectly:async(file)=>({fileName:file.name,transcript:'[00:00:00] Labvakar!',timecodes:true,sourceDurationSeconds:sourceDurations[files.indexOf(file)],visualEvidence:isVideoMedia(file)?'[00:00:00] VISUAL: Viesis ienāk.':'',visualEvidenceAvailable:isVideoMedia(file)}),
    inferRuntimeFromTranscript:()=>{throw new Error('Exact source duration must be used');},
  };
  const page=fs.readFileSync('app/page.tsx','utf8');
  const startBody=page.slice(page.indexOf('const startProcessing = async () => {'),page.indexOf('  const openGeminiEditor = () => {'));
  for(const name of new Set(startBody.match(/\bset[A-Z]\w+(?=\()/g)))context[name]=()=>{};
  context.setTranscriptResults=(results)=>{returned=results;};context.setFinalRuntimeSeconds=(seconds)=>{runtime=seconds;};
  context.setProcessingMessage=(message)=>{if(message.startsWith('Processing failed:'))failure=message;};
  const start=loadClientFunction('const startProcessing = async () => {','  const openGeminiEditor = () => {',context);
  await start();
  assert.equal(failure,undefined);
  assert.equal(runtime,14.8);
  assert.deepEqual(returned.map(x=>x.transcript.match(/^\[[^\]]+\]/)[0]),['[00:00:00]','[00:00:02]','[00:00:11]']);
  assert.match(returned[1].visualEvidence,/^\[00:00:02\]/);
});
