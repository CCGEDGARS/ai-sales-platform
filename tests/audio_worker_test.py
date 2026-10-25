"""Real FFmpeg decoding tests; only the external Gemini upload is stubbed."""
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('dana_worker', Path(__file__).resolve().parents[1] / 'services/ffmpeg-worker/main.py')
worker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = worker
spec.loader.exec_module(worker)


class AudioWorkerTest(unittest.TestCase):
    def test_native_audio_shorter_than_fifteen_minutes_is_not_truncated_to_chunk_length(self):
        from fastapi.testclient import TestClient
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'voice.flac'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=duration=75','-c:a','flac',str(source)],check=True)
            raw=source.read_bytes()
        captured=[]
        async def transcribe(segment,*args):
            captured.append(worker.duration(segment.path))
            return '[00:00:00] Test transcript',segment.start
        with patch.object(worker,'transcribe_segment',transcribe):
            response=TestClient(worker.app).post('/process',data={'geminiApiKey':'test-only-placeholder','chunkLength':'1'},files={'files':('voice.flac',raw,'audio/flac')})
        self.assertEqual(response.status_code,200,response.text)
        self.assertAlmostEqual(sum(captured),75,delta=0.1)

    def test_probe_distinguishes_audio_only_webm_from_video(self):
        self.assertTrue(hasattr(worker, 'inspect_media'))
        with tempfile.TemporaryDirectory() as temporary:
            audio=Path(temporary)/'recording.webm'
            video=Path(temporary)/'clip.mp4'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=duration=1','-c:a','libopus',str(audio)],check=True)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=size=64x64:duration=1','-c:v','libx264',str(video)],check=True)
            self.assertEqual(worker.inspect_media(audio)['kind'],'audio')
            self.assertEqual(worker.inspect_media(video)['kind'],'video')

    def test_every_advertised_audio_format_decodes_to_flac_with_original_duration(self):
        self.assertTrue(hasattr(worker, 'prepare_audio_upload'), 'audio preparation must exist')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for extension, codec in {'wav':'pcm_s16le','mp3':'libmp3lame','m4a':'aac','aac':'aac','flac':'flac','ogg':'libopus','opus':'libopus','aiff':'pcm_s16be','webm':'libopus'}.items():
                with self.subTest(extension=extension):
                    source = root / f'WhatsApp Audio (1).{extension}'
                    subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=1.25','-c:a',codec,str(source)],check=True)
                    before=source.read_bytes()
                    derivative, seconds=worker.prepare_audio_upload(source)
                    self.assertNotEqual(derivative, source)
                    self.assertEqual(derivative.read_bytes()[:4], b'fLaC')
                    self.assertAlmostEqual(seconds,1.25,delta=0.2)
                    self.assertEqual(source.read_bytes(),before)

    def test_invalid_audio_fails_without_uploading(self):
        self.assertTrue(hasattr(worker, 'prepare_audio_upload'))
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'broken.opus'
            source.write_bytes(b'not audio')
            with self.assertRaises(RuntimeError):
                worker.prepare_audio_upload(source)

    def test_proxy_uploads_audio_derivative_and_returns_duration_then_cleans_up(self):
        from fastapi.testclient import TestClient
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'voice.opus'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=duration=1','-c:a','libopus',str(source)],check=True)
            raw=source.read_bytes()
        seen=[]
        async def upload(path, api_key, mime_type='video/mp4', display_name=None):
            seen.append(path)
            self.assertEqual(mime_type,'audio/flac')
            self.assertEqual(path.read_bytes()[:4],b'fLaC')
            self.assertEqual(display_name,'voice.opus')
            return {'name':'files/test','uri':'https://generativelanguage.googleapis.com/v1beta/files/test','mimeType':mime_type}
        client=TestClient(worker.app)
        token='12345678-1234-1234-1234-123456789012'
        response=client.post('/upload-proxy/authorize',json={'token':token,'geminiApiKey':'test-only-placeholder','fileName':'voice.opus','fileSize':len(raw),'mimeType':'audio/ogg'})
        self.assertEqual(response.status_code,200)
        with patch.object(worker,'gemini_upload',upload):
            response=client.post('/upload-proxy/'+token,content=raw)
        self.assertEqual(response.status_code,200,response.text)
        self.assertGreater(response.json().get('sourceDurationSeconds',0),0)
        self.assertTrue(seen)
        self.assertFalse(seen[0].exists())
        self.assertNotIn(token,worker.UPLOAD_TICKETS)

    def test_proxy_detects_audio_only_webm_despite_video_mime_and_cleans_failed_upload(self):
        from fastapi.testclient import TestClient
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'recording.webm'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=duration=1','-c:a','libopus',str(source)],check=True)
            raw=source.read_bytes()
        client=TestClient(worker.app)
        for fail in [False,True]:
            token='12345678-1234-1234-1234-123456789012'
            seen=[]
            async def upload(path,api_key,mime_type='video/mp4',display_name=None):
                seen.append(path)
                self.assertEqual(mime_type,'audio/flac')
                if fail: raise RuntimeError('Test provider failure')
                return {'name':'files/test','uri':'https://generativelanguage.googleapis.com/v1beta/files/test','mimeType':mime_type}
            client.post('/upload-proxy/authorize',json={'token':token,'geminiApiKey':'test-only-placeholder','fileName':'recording.webm','fileSize':len(raw),'mimeType':'video/webm'})
            with patch.object(worker,'gemini_upload',upload):
                response=client.post('/upload-proxy/'+token,content=raw)
            self.assertEqual(response.status_code,502 if fail else 200,response.text)
            if not fail: self.assertEqual(response.json()['sourceMediaKind'],'audio')
            self.assertTrue(seen)
            self.assertFalse(seen[0].exists())
            self.assertNotIn(token,worker.UPLOAD_TICKETS)


if __name__=='__main__':
    unittest.main()
