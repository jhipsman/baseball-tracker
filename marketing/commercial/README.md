# 9D commercial (vertical 1080×1920, 70 s, with soundtrack)

Filmed from the real app running the demo team, in three acts: coaches, clubs & organizations, parents & players. Nothing here ships with the app.

| File | What it does |
| --- | --- |
| `timeline.js` | The single timeline (120 BPM, a bar = 2 s): scene times plus the moments sound hits (bat crack, pitch taps, notification ding, Day/Night ripple, pop-outs). Picture and music both read it. |
| `capture2.mjs` | Signs up a coach on a local app (`http://localhost:3000`), builds the demo team, scores a few live pitches, and saves full screens plus close-ups (calendar, health alerts, "How it builds", stats, dashboard, dues, messages, imports) and parent/player phone screens via "View as" into `shots2/`. |
| `stage2.html` | The commercial. `render(t)` draws the frame at `t` seconds. Edit captions and layout here. |
| `music.py` | Original soundtrack and sound design, synthesized in code (no licensed audio): A-minor groove (Am–F–C–G), risers and impacts on chapter cards, bat crack on the reveal, taps, pops, ding, shimmer. `python3 music.py music.wav` (needs numpy + scipy). |
| `render.mjs` | `STAGE=stage2.html node render.mjs stills 9.5,22` for previews; `STAGE=stage2.html node render.mjs video silent.mp4 30` films every frame. |

Final mix: `ffmpeg -i silent.mp4 -i music.wav -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -shortest 9D-commercial.mp4`

Setup: running local app + database, `playwright-core` with Chromium at `/opt/pw-browsers/chromium`, ffmpeg, Manrope TTFs and Barlow Condensed 700 italic (`barlow-cond-700i.ttf`) in `fonts/` (Google Fonts). `stage.html`/`capture.mjs` are the first 42-second cut.
