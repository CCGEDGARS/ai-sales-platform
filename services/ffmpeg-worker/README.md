# DANA AI native FFmpeg worker

This service is the production processor for long MP4 files. It runs native
FFmpeg with stream-copy cuts, 3-second overlaps, Gemini transcription, original
timeline offsets, duplicate removal, and validated merged output.

Required runtime secret: none for FFmpeg; Gemini access is supplied per request
by the DANA AI app and is never stored by this service.

Build and run locally:

```sh
docker build -t dana-ai-ffmpeg services/ffmpeg-worker
docker run --rm -p 8080:8080 dana-ai-ffmpeg
```

The app connects through the Sites runtime variable `FFMPEG_WORKER_URL`.
