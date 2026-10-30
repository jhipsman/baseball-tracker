# Diamond Program commercial (vertical, 42 s)

A 1080×1920 promo built from the real app running the demo team. Nothing here ships with the app.

- `capture.mjs`: signs up a coach on a local app (`http://localhost:3000`), creates the demo team, scores a few live pitches, and screenshots desktop and phone screens (Day and Night) into `shots/`. Players and parents are captured through "View as" (read-only).
- `stage.html`: the commercial itself. `render(t)` draws the frame at `t` seconds: the problem (kinetic type), logo reveal, game day (live scorer + Pitch Smart callout), player health (zoom into the arm-pain alert), player, parent, Day→Night ripple, montage, end card. Edit text and timings here (`T` holds the scene times).
- `render.mjs`: `node render.mjs stills 5,12,30` writes preview frames; `node render.mjs video out.mp4 30` films every frame in headless Chromium and encodes H.264 with ffmpeg.

Setup: a running local app + database, `playwright-core` (Chromium at `/opt/pw-browsers/chromium`), ffmpeg, and Manrope TTFs in `fonts/` (from Google Fonts; file names are referenced in `stage.html`). No music is included: add a licensed track in CapCut/iMovie.
