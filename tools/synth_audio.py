#!/usr/bin/env python3
"""Bloom Bubbles — all audio synthesized locally with numpy. No AI audio,
no downloads. 44.1kHz 16-bit mono WAVs. Music loops are exactly periodic
(integer-sample event grids, envelopes end before the seam).
"""
import math
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "audio", "wav")
os.makedirs(OUT, exist_ok=True)

SR = 44100
rng = np.random.default_rng(20261122)


def write(name, data, peak_db=-3.0):
    data = np.asarray(data, dtype=np.float64)
    peak = np.max(np.abs(data)) + 1e-12
    target = 10 ** (peak_db / 20.0)
    data = np.clip(data * (target / peak), -1.0, 1.0)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype(np.int16).tobytes())
    print("wrote", path, f"{len(data)/SR:.2f}s")


def env(n, attack=0.005, decay=None):
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / attack)
    if decay is None:
        decay = n / SR
    d = np.exp(-t / max(decay, 1e-4))
    return a * d


def sine(freq, dur, amp=0.5, decay=0.15):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return amp * np.sin(2 * np.pi * freq * t) * env(n, decay=decay)


def tri(freq, dur, amp=0.4, decay=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = (freq * t) % 1.0
    wave_ = 4 * np.abs(ph - 0.5) - 1.0
    return amp * wave_ * env(n, decay=decay)


def noise_burst(dur, amp=0.5, cutoff=3000):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    # simple one-pole lowpass
    alpha = cutoff / (cutoff + SR)
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += alpha * (x[i] - acc)
        y[i] = acc
    return amp * y * env(n, attack=0.001, decay=dur / 4)


def sweep(f0, f1, dur, amp=0.4, decay=None):
    n = int(dur * SR)
    t = np.arange(n) / SR
    phase = 2 * np.pi * (f0 * t + (f1 - f0) * t * t / (2 * dur))
    return amp * np.sin(phase) * env(n, decay=decay or dur / 2)


def mix_at(base, sig, start_s):
    i = int(start_s * SR)
    end = min(len(base), i + len(sig))
    base[i:end] += sig[: end - i]
    return base


def mix(*sigs):
    n = max(len(s) for s in sigs)
    out = np.zeros(n)
    for s in sigs:
        out[:len(s)] += s
    return out


# ------------------------------------------------------------------ SFX --

# shoot: quick upward chirp + soft air puff
write("sfx_shoot.wav", mix(sweep(320, 900, 0.16, 0.45), noise_burst(0.10, 0.12, 5000)))

# pop: bright "bloop" — sine drop + noise snap
write("sfx_pop.wav",
      mix(sweep(700, 180, 0.14, 0.55, decay=0.06), noise_burst(0.05, 0.35, 6000)))

# bounce: short woody tick
write("sfx_bounce.wav", mix(sine(220, 0.07, 0.5, decay=0.03), noise_burst(0.03, 0.15, 2500)))

# click: UI tap
write("sfx_click.wav", sine(880, 0.06, 0.4, decay=0.025))

# falling cluster: soft descending whistle
write("sfx_fall.wav", sweep(900, 300, 0.35, 0.35, decay=0.18))

# new row arrives: low thud
write("sfx_row.wav", mix(sine(110, 0.22, 0.6, decay=0.09), noise_burst(0.08, 0.2, 800)))

# mission complete: bright two-note chime
m = np.zeros(int(0.7 * SR))
m = mix_at(m, tri(880, 0.25, 0.45, 0.12), 0.0)
m = mix_at(m, tri(1318, 0.4, 0.45, 0.2), 0.12)
write("sfx_mission.wav", m)

# win jingle: C E G C' arpeggio, cheerful
w = np.zeros(int(1.4 * SR))
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
    w = mix_at(w, tri(f, 0.35, 0.45, 0.18), i * 0.13)
    w = mix_at(w, tri(f * 2, 0.2, 0.12, 0.1), i * 0.13)
write("sfx_win.wav", w)

# lose sting: descending minor phrase
L = np.zeros(int(1.1 * SR))
for i, f in enumerate([392.0, 329.63, 261.63, 196.0]):
    L = mix_at(L, tri(f, 0.3, 0.4, 0.15), i * 0.18)
write("sfx_lose.wav", L)

# ---------------------------------------------------------------- music --
# 8-second loop, 120 BPM, 16 eighth-notes. Pentatonic melody + soft bass.
# All events on an exact sample grid so the loop wraps cleanly.

BEAT = 0.5  # 120 BPM
LOOP = 8.0
N = int(LOOP * SR)


def note(freq, start_beat, beats, amp=0.3, kind="tri"):
    n = int(beats * BEAT * SR)
    fn = tri if kind == "tri" else sine
    sig = fn(freq, beats * BEAT, amp, decay=beats * BEAT * 0.9)
    # fade the very tail to zero to keep the seam clean
    tail = int(0.02 * SR)
    sig[-tail:] *= np.linspace(1, 0, tail)
    return int(start_beat * BEAT * SR), sig


def build_music(melody, bass, name):
    buf = np.zeros(N)
    for freq, start, beats in melody:
        i, sig = note(freq, start, beats, 0.28)
        buf[i:i + len(sig)] += sig
    for freq, start, beats in bass:
        i, sig = note(freq, start, beats, 0.22, kind="sine")
        buf[i:i + len(sig)] += sig
    # gentle pad: two detuned sines on the tonic, whole loop
    t = np.arange(N) / SR
    pad = 0.05 * np.sin(2 * np.pi * 261.63 * t) + 0.04 * np.sin(2 * np.pi * 329.63 * t)
    buf += pad
    write(name, buf, peak_db=-6.0)


# menu: slow, dreamy (C major pentatonic, half notes)
build_music(
    [(523.25, 0, 2), (659.25, 2, 2), (783.99, 4, 2), (659.25, 6, 2),
     (587.33, 8, 2), (523.25, 10, 2), (659.25, 12, 2), (783.99, 14, 2)],
    [(130.81, 0, 4), (98.0, 4, 4), (130.81, 8, 4), (196.0, 12, 4)],
    "bgm_menu.wav",
)

# game: bouncier eighth-note melody
build_music(
    [(523.25, 0, 1), (659.25, 1, 1), (783.99, 2, 1), (659.25, 3, 1),
     (587.33, 4, 1), (659.25, 5, 1), (783.99, 6, 1), (1046.5, 7, 1),
     (783.99, 8, 1), (659.25, 9, 1), (587.33, 10, 1), (523.25, 11, 1),
     (587.33, 12, 1), (659.25, 13, 1), (587.33, 14, 1), (523.25, 15, 1)],
    [(130.81, 0, 2), (130.81, 2, 2), (98.0, 4, 2), (98.0, 6, 2),
     (130.81, 8, 2), (130.81, 10, 2), (146.83, 12, 2), (196.0, 14, 2)],
    "bgm_game.wav",
)

print("audio done")
