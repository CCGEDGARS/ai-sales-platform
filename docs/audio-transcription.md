# Audio transcription

Use **Upload video or audio → Browse files**, choose recordings (or drag them into the upload area), then **Start transcription**. WhatsApp recordings can be exported/saved from WhatsApp and uploaded directly. No WhatsApp account connection is required.

Supported audio: MP3, WAV, M4A, AAC, FLAC, OGG/OGA, OPUS, AIFF/AIF and audio-only WebM. Unsupported or empty files are rejected visibly. The existing 2 GB per-source upload limit applies. Actual transcription capacity still depends on the connected Gemini model, quota and recording length.

The secure upload worker uses FFprobe to inspect actual streams and duration. FFmpeg creates a temporary lossless FLAC derivative for audio. Originals are never overwritten. Both derivative and server upload copy are removed in `finally`, including on provider errors. Source duration is returned to the browser for cumulative timeline offsets. Audio-only sources never request a Visual Evidence Pass. Transcripts keep the language spoken, timestamps, distinguishable speaker labels, repetitions and unclear-word markers. Existing transcript review and DOCX/PDF/SRT/TXT exports are shared with video.

## Verification

`npm test` runs MIME, actual API request-body contracts and extracted production client functions for visual gating and mixed-batch timing, plus the existing suite. `npm run build` runs that suite and the Next production build.

`python tests/audio_worker_test.py` with the worker requirements and FFmpeg installed tests real audio decoding, duration, byte-for-byte original preservation, audio-only WebM with misleading MIME, cleanup on success/failure, and the native short-source truncation regression. CI runs these Python tests as well.

Release order: deploy the worker from the intended Git commit; verify `/health` reports `native-ffmpeg-1.3-audio`, `audioNormalization: true` and the intended `commit`; deploy/prove each web target using its independent release-integrity configuration. A complete provider smoke test also requires a connected Gemini session; absence of that session must be reported explicitly.
