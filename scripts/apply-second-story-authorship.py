from pathlib import Path

path = Path("app/api/generate-voiceover/route.ts")
text = path.read_text()

anchor = '''      if (!quality.formatPasses) {
        return NextResponse.json(
          {
            ok: false,
            message: `DANA AI rejected the draft because it was not formatted as selective TV voice-over cues. Refresh the app and regenerate with the current editorial engine. Reference: ${requestId}`,
            requestId,
          },
          { status: 502 },
        );
      }
      return NextResponse.json({'''
replacement = '''      if (!quality.formatPasses) {
        return NextResponse.json(
          {
            ok: false,
            message: `DANA AI rejected the draft because it was not formatted as selective TV voice-over cues. Refresh the app and regenerate with the current editorial engine. Reference: ${requestId}`,
            requestId,
          },
          { status: 502 },
        );
      }
      if (goldenMaster && !goldenMaster.secondStory?.passes) {
        return NextResponse.json(
          {
            ok: false,
            message: `This older synchronous session cannot release a Lepers package without the mandatory Second Story. Refresh DANA Studio and regenerate so the current correction engine can build and verify OTRĀ STĀSTA LĪNIJA. Reference: ${requestId}`,
            goldenMaster,
            requestId,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({'''

if 'This older synchronous session cannot release a Lepers package without the mandatory Second Story.' not in text:
    if anchor not in text:
        raise SystemExit("legacy gate anchor not found")
    text = text.replace(anchor, replacement, 1)

path.write_text(text)
