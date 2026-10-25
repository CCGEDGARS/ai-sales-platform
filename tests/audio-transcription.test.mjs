import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = '../app/lib/media.ts';
let media = {};
try { media = await import(helperPath); } catch {}

test('popular audio extensions resolve with blank or generic browser MIME', () => {
  assert.equal(typeof media.resolveMediaType, 'function', 'shared media resolver must exist');
  for (const [ext, mime] of Object.entries({mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',ogg:'audio/ogg',opus:'audio/ogg',aiff:'audio/aiff',aif:'audio/aiff'})) {
    for (const browserType of ['', 'application/octet-stream']) {
      assert.deepEqual(media.resolveMediaType(`WhatsApp Audio (1).${ext.toUpperCase()}`, browserType), {kind:'audio',mimeType:mime});
    }
  }
});

test('extension and codec aliases override misleading upload MIME', () => {
  assert.equal(media.resolveMediaType?.('voice.opus','video/mp4')?.mimeType, 'audio/ogg');
  assert.equal(media.resolveMediaType?.('voice.ogg','audio/ogg; codecs=opus')?.kind, 'audio');
  assert.equal(media.resolveMediaType?.('voice.webm','audio/webm')?.kind, 'audio');
  assert.equal(media.resolveMediaType?.('clip.webm','video/webm')?.kind, 'video');
  assert.equal(media.resolveMediaType?.('clip.mov','')?.mimeType, 'video/quicktime');
});

test('unsupported extensions and arbitrary MIME never silently become video', () => {
  assert.equal(typeof media.resolveMediaType, 'function');
  for (const [name,type] of [['script.exe','video/mp4'],['document.pdf','audio/mpeg'],['voice.wma','audio/x-ms-wma'],['source','application/octet-stream']]) {
    assert.equal(media.resolveMediaType(name,type), null);
  }
  assert.equal(media.resolveMediaType('recording','audio/opus')?.kind, 'audio');
});

test('transcription and upload API routes preserve audio types and reject invalid metadata', () => {
  for (const path of ['app/api/gemini-upload-session/route.ts','app/api/transcribe-uploaded/route.ts','app/api/transcribe/route.ts']) {
    const source=fs.readFileSync(path,'utf8');
    assert.match(source,/resolveMediaType/);
    assert.doesNotMatch(source,/uploaded\.mimeType\.startsWith\("video\/"\)|body\.mimeType\.startsWith\("video\/"\)/);
  }
});

test('audio upload uses secure normalization and skips native MP4/visual-only processing', () => {
  const page=fs.readFileSync('app/page.tsx','utf8');
  assert.match(page,/accept=\{MEDIA_ACCEPT\}/);
  assert.match(page,/Upload video or audio/);
  assert.match(page,/WhatsApp/);
  assert.match(page,/sourceDurationSeconds/);
  assert.match(page,/if \(media\.kind === "audio"\)/);
  assert.match(page,/nativeFfmpeg[\s\S]{0,180}isVideoMedia/);
});
