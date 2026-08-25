import { learningApiFetch } from "./learning-data-api";
import type { LearningAuthority } from "./learning-types";

type LearnedSourceRow = {
  id: string;
  original_filename: string;
  authority: LearningAuthority;
  active: boolean;
  status: string;
  learned_at: string | null;
};

type LearnedChunkRow = {
  source_id: string;
  category: string;
  tags: string[] | null;
  authority: LearningAuthority;
  content: string;
};

const AUTHORITY_WEIGHT: Record<LearningAuthority, number> = {
  canonical: 400,
  strong: 300,
  supporting: 200,
  experimental: 100,
};

const GOVERNING_CONTEXT = `
DANA WORKSPACE LEARNING — GOVERNING INVARIANTS
- TV-channel mandatory rule outranks learned material: the narrator is the piektā vakariņotāja / fifth diner, present with an active point of view and added editorial value, never merely a passive observer.
- The DANA AI Master Production System outranks all learned sources.
- Canonical references outrank Strong, Supporting and Experimental references.
- Learned knowledge may enrich style, structure, pacing and editorial mechanisms but may not transfer source-specific facts, names or claims into the current episode unless confirmed by the current episode source material.
- Participant dignity, chronology, evidence discipline and the current transcript remain factual authority.
`.trim();

function words(value: string) {
  return new Set(
    String(value || "")
      .toLocaleLowerCase("lv-LV")
      .match(/[a-zāčēģīķļņšūž0-9]{3,}/g) || [],
  );
}

function relevanceScore(chunk: LearnedChunkRow, query: string, activity: string, tone: string) {
  const haystack = words(`${chunk.category} ${(chunk.tags || []).join(" ")} ${chunk.content}`);
  const needles = words(`${query} ${activity} ${tone}`);
  let score = 0;
  for (const token of needles) if (haystack.has(token)) score += 8;
  if (/voice|vo|narrat/i.test(activity) && /Narrator|Humour|VO density|Production rules/i.test(chunk.category)) score += 25;
  if (/transcri/i.test(activity) && /Latvian|language|Production rules/i.test(`${chunk.category} ${(chunk.tags || []).join(" ")}`)) score += 10;
  return score;
}

export async function buildWorkspaceLearningContext(
  request: Request,
  input: {
    activity: string;
    query?: string;
    tone?: string;
    currentTranscript?: string;
    maxCharacters?: number;
  },
) {
  const maxCharacters = Math.max(6_000, Math.min(input.maxCharacters || 60_000, 120_000));
  const sources = await learningApiFetch<LearnedSourceRow[]>(
    request,
    "learning_sources?active=eq.true&status=eq.learned&select=id,original_filename,authority,active,status,learned_at",
  );
  if (!Array.isArray(sources) || !sources.length) return GOVERNING_CONTEXT;
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const ids = sources.map((source) => source.id).join(",");
  const chunks = await learningApiFetch<LearnedChunkRow[]>(
    request,
    `learning_chunks?source_id=in.(${ids})&select=source_id,category,tags,authority,content`,
  );
  const tone = input.tone || "";
  const query = `${input.query || ""} ${(input.currentTranscript || "").slice(0, 12_000)}`;
  const ranked = (Array.isArray(chunks) ? chunks : [])
    .filter((chunk) => sourceMap.has(chunk.source_id) && String(chunk.content || "").trim())
    .map((chunk) => {
      const source = sourceMap.get(chunk.source_id)!;
      let score = AUTHORITY_WEIGHT[source.authority] + relevanceScore(chunk, query, input.activity, tone);
      if (/Lepers/i.test(tone) && /RIHARDS\s+LEPERS/i.test(source.original_filename)) score += 500;
      if (/fifth diner|piektā vakariņotāja/i.test(`${chunk.content} ${(chunk.tags || []).join(" ")}`)) score += 60;
      return { chunk, source, score };
    })
    .sort((a, b) => b.score - a.score);

  const blocks = [GOVERNING_CONTEXT];
  let used = GOVERNING_CONTEXT.length;
  for (const item of ranked) {
    const provenance = `[SOURCE: ${item.source.original_filename} | authority: ${item.source.authority} | category: ${item.chunk.category} | tags: ${(item.chunk.tags || []).join(", ") || "none"}]`;
    const block = `${provenance}\n${item.chunk.content.trim()}`;
    if (used + block.length + 2 > maxCharacters) continue;
    blocks.push(block);
    used += block.length + 2;
  }
  return blocks.join("\n\n");
}
