# Video and audio transcription

Approved scope: extend the existing upload/transcription flow to MP3, WAV, M4A, AAC, FLAC, OGG, OPUS (including WhatsApp), AIFF and audio WebM. Keep video behavior and exports. Use one upload area, truthful errors, preserved originals, speaker labels only when distinguishable and word-for-word timecoded transcripts. Audio must never request visual evidence.

Approach: reuse Gemini and the existing secure upload proxy. Normalize audio to a temporary FLAC derivative with native FFmpeg, inspect source duration, and carry the real duration to the client for mixed-batch timeline offsets. No separate speech provider or new subscription. Video retains its existing native/direct paths. Unsupported files must be rejected rather than labeled video/mp4.

Verification: executable MIME and route contract tests; real FFmpeg conversion of every advertised audio extension; full repository tests and production build; browser upload UI; exact-SHA CI and target-specific release proof for each web target; worker version/health and audio upload/transcription smoke test where credentials are available.
