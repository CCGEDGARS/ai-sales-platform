export type MediaType = { kind: "audio" | "video"; mimeType: string };

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac",
  flac: "audio/flac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg",
  aiff: "audio/aiff", aif: "audio/aiff",
};
const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska",
  avi: "video/x-msvideo", m4v: "video/mp4",
};
const AUDIO_ALIASES: Record<string, string> = {
  "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav", "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4", "audio/opus": "audio/ogg",
  "application/ogg": "audio/ogg", "audio/x-aiff": "audio/aiff",
  "audio/x-flac": "audio/flac",
};

export const MEDIA_ACCEPT = "video/*,audio/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.aiff,.aif";
export const MEDIA_FORMATS = "MP4, MOV, MKV, WebM, AVI, M4V · MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, AIFF · WhatsApp audio";

/** Extension wins over unreliable browser MIME; unknown named extensions fail closed. */
export function resolveMediaType(fileName: string, suppliedType = ""): MediaType | null {
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const rawType = suppliedType.split(";", 1)[0].trim().toLowerCase();
  const mimeType = AUDIO_ALIASES[rawType] || rawType;
  if (extension === "webm") return mimeType === "audio/webm"
    ? { kind: "audio", mimeType } : { kind: "video", mimeType: "video/webm" };
  if (extension && AUDIO_TYPES[extension]) return { kind: "audio", mimeType: AUDIO_TYPES[extension] };
  if (extension && VIDEO_TYPES[extension]) return { kind: "video", mimeType: VIDEO_TYPES[extension] };
  if (extension) return null;
  if ([...Object.values(AUDIO_TYPES), "audio/webm"].includes(mimeType)) return { kind: "audio", mimeType };
  if ([...Object.values(VIDEO_TYPES), "video/webm"].includes(mimeType)) return { kind: "video", mimeType };
  return null;
}

export function isVideoMedia(file: { name: string; type: string }) {
  return resolveMediaType(file.name, file.type)?.kind === "video";
}
