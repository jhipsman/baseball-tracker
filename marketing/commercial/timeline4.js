// 16:9 cut. Shared by stage4.html (picture) and music4.py (sound). 120 BPM, a bar = 2 s.
window.TL = {
  "bpm": 120,
  "duration": 58,
  "scenes": {
    "hook": [0, 4],
    "reveal": [4, 8],
    "dash": [8, 12],
    "live": [12, 20],
    "lock": [20, 24],
    "schedule": [24, 28],
    "health": [28, 32],
    "develop": [32, 36],
    "stats": [36, 40],
    "paid": [40, 44],
    "reach": [44, 48],
    "real": [48, 52],
    "end": [52, 58]
  },
  "hookWords": [0.25, 1.1, 1.95],
  "strike": 2.85,
  "batCrack": 3.75,
  "groove": [8, 52],
  "live": { "pitches": [12.7, 13.4, 14.1], "hit": 14.9, "runnerDone": 16.1, "run": 16.1, "feedNext": 17.4 },
  "lockUpdates": [21.2, 22.6],
  "events": {
    "land": [8.4, 8.6, 8.8, 9.0, 9.2, 24.5, 32.45, 32.75, 33.05, 33.35, 36.45],
    "taps": [12.7, 13.4, 14.1, 25.4, 25.8, 26.2, 45.8],
    "stamp": [34.4, 40.6, 41.2, 41.8, 42.4, 37.4],
    "alert": [29.4],
    "dings": [20.9, 21.5, 22.1, 46.3, 46.6, 46.9],
    "typing": [44.3, 45.6],
    "count": [37.4, 38.6],
    "beats": [48, 49, 50, 51]
  }
}
