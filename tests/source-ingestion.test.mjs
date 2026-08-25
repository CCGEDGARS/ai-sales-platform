import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/page.tsx", "utf8");
const route = fs.readFileSync("app/api/ingest-reference/route.ts", "utf8");

test("reference upload exposes progress and result beside the library", () => {
  assert.match(page, /sourceStatus/);
  assert.match(page, /sourceMessage/);
  assert.match(page, /Indexing source|Indexing sources|Indexing…/);
  assert.match(page, /source-feedback/);
});

test("video references are registered client-side instead of uploading unused bytes", () => {
  assert.match(page, /isVideoReferenceFile/);
  assert.match(page, /Registered video reference/);
  assert.match(page, /if \(isVideoReferenceFile\(file\)\)[\s\S]*continue;/);
});

test("source picker only advertises file types the ingestion path supports", () => {
  const accept = page.match(/ref=\{sourceInput\}[\s\S]{0,300}?accept="([^"]+)"/)?.[1] || "";
  assert.match(accept, /\.pdf/);
  assert.match(accept, /\.docx/);
  assert.match(accept, /\.md/);
  assert.match(accept, /\.csv/);
  assert.doesNotMatch(accept, /\.doc(?:,|$)/);
  assert.doesNotMatch(accept, /\.mp3|\.wav/);
});

test("successful source ingestion puts the newest source immediately after the core source", () => {
  assert.match(page, /incomingNames/);
  assert.match(page, /coreSources/);
  assert.match(page, /\.\.\.additions/);
  assert.match(page, /\.\.\.remaining/);
});

test("server document size message describes document indexing rather than video registration", () => {
  assert.match(route, /Reference documents are limited/);
});
