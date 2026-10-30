"""Original soundtrack + sound design for the 9D commercial, synthesized from scratch.

Reads the shared timeline (timeline.js) so every hit lands on the picture.
120 BPM, A minor (Am - F - C - G), one chord per 2-second bar.
Usage: python3 music.py out.wav
"""
import json, re, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
TL = json.loads(re.search(r"window\.TL = (\{.*\})", open(sys.argv[2] if len(sys.argv) > 2 else "timeline3.js").read(), re.S).group(1))
DUR = TL["duration"]
S = TL["scenes"]
BEAT = 60 / TL["bpm"]
BAR = BEAT * 4
N = int(DUR * SR) + SR
rng = np.random.default_rng(9)

L = np.zeros(N); R = np.zeros(N)          # dry bus
RL = np.zeros(N); RR = np.zeros(N)        # reverb send
duck = np.ones(N)                          # sidechain from the kick


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    """ADSR envelope of n samples (hold = sustain length in s)."""
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    h = n - a_ - d_ - r_ if hold is None else int(hold * SR)
    h = max(h, 0)
    e = np.concatenate([np.linspace(0, 1, max(a_, 1)), np.linspace(1, s, max(d_, 1)), np.full(h, s), np.linspace(s, 0, max(r_, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f, SR / 2 - 100) / (SR / 2), "low"); return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high"); return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band"); return signal.lfilter(b, a, x)


def put(x, at, gain=1.0, pan=0.0, verb=0.0):
    i = int(at * SR)
    if i >= N or i + len(x) <= 0: return
    x = x[: N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(x)] += x * gl; R[i:i + len(x)] += x * gr
    if verb:
        RL[i:i + len(x)] += x * gl * verb; RR[i:i + len(x)] += x * gr * verb


def hz(note):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    m = re.match(r"([A-G]#?)(-?\d)", note)
    return 440 * 2 ** ((names[m.group(1)] + 12 * (int(m.group(2)) - 4)) / 12)


# ------------------------------------------------------------------ instruments
def kick(power=1.0):
    t = t_(0.45)
    f = 45 + 120 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.3
    return np.tanh((x + click) * 1.6 * power)


def clap():
    t = t_(0.35)
    n = rng.standard_normal(len(t))
    e = np.zeros(len(t))
    for k, o in enumerate([0, 0.011, 0.022]):
        i = int(o * SR); e[i:] += np.exp(-(t[: len(t) - i]) * (200 if k < 2 else 18))
    return bp(n, 900, 5000) * e * 0.6


def hat(open_=False):
    t = t_(0.25 if open_ else 0.05)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (12 if open_ else 90)) * 0.35


def saw(freq, sec, detune=(0,), cutoff=3000):
    t = t_(sec)
    x = sum(signal.sawtooth(2 * np.pi * freq * (1 + d) * t + rng.uniform(0, 6)) for d in detune) / len(detune)
    return lp(x, cutoff)


def bass(note, sec):
    f = hz(note)
    t = t_(sec)
    x = signal.sawtooth(2 * np.pi * f * t) * 0.6 + np.sin(2 * np.pi * f / 2 * t) * 0.7
    return lp(x, 650) * env(len(t), 0.004, 0.12, 0.6, 0.04)


def pad(notes, sec, cutoff=2400):
    x = sum(saw(hz(n), sec, (-0.006, 0, 0.007), cutoff) for n in notes) / len(notes)
    return x * env(len(x), 0.25, 0.4, 0.8, 0.5)


def pluck(note, sec=0.3):
    t = t_(sec)
    f = hz(note)
    x = signal.square(2 * np.pi * f * t, 0.3) * 0.5 + np.sin(2 * np.pi * f * 2 * t) * 0.3
    return lp(x, 4200) * np.exp(-t * 11)


def riser(sec, top=4000):
    t = t_(sec)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t)); step = 2048
    for i in range(0, len(t), step):
        c = 300 + (top - 300) * (i / len(t)) ** 2
        out[i:i + step] = bp(n[i:i + step + 512], c * 0.7, c * 1.4)[: len(out[i:i + step])]
    tone = np.sin(2 * np.pi * np.cumsum(180 + 900 * (t / sec) ** 2) / SR) * 0.25
    return (out + tone) * (t / sec) ** 2.2


def impact(power=1.0):
    t = t_(2.2)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    crash = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 3.5) * 0.35
    return np.tanh((boom * 1.4 + crash) * power)


def whoosh(sec=0.45, up=True):
    t = t_(sec)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t)); step = 1024
    for i in range(0, len(t), step):
        p = i / len(t); c = 500 + 3500 * (p if up else 1 - p)
        out[i:i + step] = bp(n[i:i + step + 256], c * 0.6, c * 1.6)[: len(out[i:i + step])]
    return out * np.sin(np.pi * t / sec) ** 1.5 * 0.7


def bat_crack():
    """Ash on leather: a sharp broadband snap, a woody ring, a hollow knock."""
    t = t_(0.5)
    snap = bp(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t * 160) * 1.4
    ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(1180, 0.6), (2350, 0.35), (3520, 0.2)]) * np.exp(-t * 38)
    knock = np.sin(2 * np.pi * 420 * t) * np.exp(-t * 55) * 0.8
    return np.tanh((snap + ring + knock) * 1.6)


def tap():
    t = t_(0.06)
    return (np.sin(2 * np.pi * 1900 * t) * 0.5 + hp(rng.standard_normal(len(t)), 4000) * 0.3) * np.exp(-t * 120)


def blip(f=1400):
    t = t_(0.18)
    return np.sin(2 * np.pi * np.cumsum(f + 900 * t / 0.18) / SR) * np.exp(-t * 22) * 0.5


def ding():
    t = t_(1.4)
    x = sum(np.sin(2 * np.pi * f * t) * a * np.exp(-t * d) for f, a, d in [(1318.5, 0.6, 3.2), (2637, 0.25, 5), (3955, 0.1, 7)])
    y = sum(np.sin(2 * np.pi * f * t) * a * np.exp(-t * d) for f, a, d in [(1760, 0.55, 3), (3520, 0.2, 5)])
    i = int(0.12 * SR); y = np.concatenate([np.zeros(i), y[:-i]])
    return (x + y) * 0.6


def shimmer(sec=1.2):
    t = t_(sec)
    return sum(np.sin(2 * np.pi * hz(n) * t) for n in ["E6", "A6", "C7", "E7"]) * np.exp(-t * 2.5) * (1 - np.exp(-t * 40)) * 0.12


# ------------------------------------------------------------------ arrangement (cut 3)
E = TL["events"]
CHORDS = [("A2", ["A3", "C4", "E4", "B4"]), ("F2", ["F3", "A3", "C4", "E4"]), ("C3", ["C4", "E4", "G4", "D5"]), ("G2", ["G3", "B3", "D4", "A4"])]
ARP = {0: ["A4", "C5", "E5", "A5"], 1: ["F4", "A4", "C5", "F5"], 2: ["C5", "E5", "G5", "C6"], 3: ["G4", "B4", "D5", "G5"]}
music_bus_L = np.zeros(N); music_bus_R = np.zeros(N)

def mput(x, at, gain=1.0, pan=0.0, verb=0.0):
    i = int(at * SR)
    if i >= N: return
    x = x[: N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    music_bus_L[i:i + len(x)] += x * gl; music_bus_R[i:i + len(x)] += x * gr
    if verb:
        RL[i:i + len(x)] += x * gl * verb; RR[i:i + len(x)] += x * gr * verb

def kick_at(at, power=1.0, gain=0.9):
    put(kick(power), at, gain)
    i = int(at * SR); n = int(0.28 * SR)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.65 * np.exp(-np.arange(min(n, N - i)) / SR * 14))

def stamp():
    t = t_(0.25)
    thud = np.sin(2 * np.pi * np.cumsum(180 * np.exp(-t * 18) + 90) / SR) * np.exp(-t * 20)
    snap = bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 90) * 0.5
    b = np.pad(blip(1600), (0, max(0, len(t) - len(blip(1600)))))[: len(t)]
    return thud + snap + b * 0.6

def alert_tone():
    t = t_(0.5)
    a = np.sin(2 * np.pi * 880 * t) * np.exp(-t * 6) * (t < 0.2)
    b = np.sin(2 * np.pi * 622 * t) * np.exp(-(t - 0.2).clip(0) * 6) * (t >= 0.2)
    return (a + b) * 0.5

def key():
    t = t_(0.04)
    return bp(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 160) * 0.45

hook_end = TL["scenes"]["hook"][1]
# Hook: pulse, ticking hats, hits on the words, zips on the strikes, riser into the crack
for b in range(2):
    for q in range(4):
        at = b * BAR + q * BEAT
        mput(bass("A1", BEAT * 0.9) * (0.55 + 0.15 * b), at, 0.9)
        for e in range(2): put(hat(), at + e * BEAT / 2, 0.3 + 0.12 * b, 0.25)
for w in TL["hookWords"]:
    put(kick(0.8), w, 0.55); put(impact(0.4)[: int(0.5 * SR)], w, 0.3)
for k in range(3):
    put(whoosh(0.22, up=False), TL["strike"] + k * 0.1, 0.45, -0.3 + 0.3 * k)
put(riser(TL["batCrack"] - 2.6), 2.6, 0.6, 0, 0.3)
put(bat_crack(), TL["batCrack"], 1.0, 0, 0.35)

# Reveal: the drop
rv = TL["scenes"]["reveal"][0]
put(impact(1.1), rv, 0.95, 0, 0.5)
mput(pad(CHORDS[0][1], 4.2, 1800), rv, 0.55, 0, 0.6)
mput(shimmer(1.6), rv + 0.4, 1.0, 0.2, 0.8)
put(riser(1.2, 5000), rv + 2.8, 0.4)

# Groove under the feature scenes
g0, g1 = TL["groove"]
real0 = TL["scenes"]["real"][0]
t0 = g0
while t0 < g1 - 0.01:
    root, notes = CHORDS[int(round(t0 / BAR)) % 4]
    mput(pad(notes, BAR + 0.3), t0, 0.3, 0, 0.45)
    half = t0 >= real0  # last two bars: half-time, big hits on each word
    for q in range(4):
        at = t0 + q * BEAT
        if not half or q % 2 == 0: kick_at(at)
        if not half and q in (1, 3): put(clap(), at, 0.55, 0.05, 0.35)
        for s_ in range(4 if not half else 2):
            put(hat(open_=(s_ == 2 and q == 3)), at + s_ * BEAT / (4 if not half else 2) + (0.012 if s_ % 2 else 0), 0.2 if s_ % 2 else 0.3, 0.3)
        for e in range(2):
            mput(bass(root, BEAT / 2 * 0.95), at + e * BEAT / 2, 0.75)
    if t0 >= g0 + 2 * BAR and not half:
        arp = ARP[int(round(t0 / BAR)) % 4]
        for s_ in range(8):
            mput(pluck(arp[[0, 1, 2, 3, 2, 1, 2, 3][s_]]), t0 + s_ * BEAT / 2, 0.2, (-0.4 if s_ % 2 else 0.4), 0.5)
    t0 += BAR
for b in E["beats"]:
    put(impact(0.55)[: int(0.8 * SR)], b, 0.55, 0, 0.4); put(clap(), b, 0.6, 0, 0.4)

# Feature-scene transitions and actions
for name, (a, b) in TL["scenes"].items():
    if a >= g0 and name not in ("end",):
        put(whoosh(0.35), a - 0.18, 0.35, 0.25 * np.sin(a))
for x in E["land"]: put(kick(0.5), x, 0.35); put(blip(900), x, 0.3, 0.1, 0.3)
for x in E["taps"]: put(tap(), x, 0.75, 0.15)
for x in E["stamp"]: put(stamp(), x, 0.6, -0.1, 0.25)
for x in E["alert"]: put(alert_tone(), x, 0.6, 0, 0.3)
for i, x in enumerate(E["dings"]): put(ding(), x, 0.5, -0.5 + 0.5 * i, 0.4)
ty0, ty1 = E["typing"]
for k in range(int((ty1 - ty0) / 0.075)):
    put(key(), ty0 + k * 0.075 + rng.uniform(-0.01, 0.01), 0.5, 0.2)
c0, c1 = E["count"]
for k in range(10):
    put(blip(1000 + 120 * k)[: int(0.06 * SR)], c0 + (c1 - c0) * (1 - (1 - k / 10) ** 2), 0.25, 0.1)

# End card
en = TL["scenes"]["end"][0]
put(riser(1.4, 6000), en - 1.4, 0.45, 0, 0.3)
put(impact(1.15), en, 1.0, 0, 0.6)
end_pad = pad(["A3", "C4", "E4", "B4", "E5"], DUR - en, 2000)
end_pad *= np.linspace(1, 0, len(end_pad)) ** 0.7
mput(end_pad, en, 0.5, 0, 0.8)
mput(bass("A1", 3.0), en, 0.7)
put(shimmer(2.0), en + 0.5, 1.4, 0.1, 0.9)
put(ding() * 0.6, en + 1.6, 0.35, -0.1, 0.6)

# ------------------------------------------------------------------ mix
music_bus_L *= duck; music_bus_R *= duck
L += music_bus_L; R += music_bus_R
ir_t = t_(2.6)
for bus, out, seed in ((RL, L, 1), (RR, R, 2)):
    ir = np.random.default_rng(seed).standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4)
    ir = lp(hp(ir, 300), 6000); ir /= np.sqrt(np.sum(ir ** 2))
    out += signal.fftconvolve(bus, ir)[:N] * 0.6
mix = np.stack([L, R], axis=1)[: int(DUR * SR)]
mix = hp(mix.T, 28).T
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.25) * 0.89
mix /= np.max(np.abs(mix)) / 0.89
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else "music.wav", SR, (mix * 32767).astype(np.int16))
print("wrote", len(mix) / SR, "s")
