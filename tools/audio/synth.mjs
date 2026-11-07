// Every sound on the site, synthesized from nothing: three tango-flavoured music loops, a wordless
// terrace chant, crowd beds, a matched roar for each goal, and two interface sounds. The goal sounds
// also carry the commentary, mixed in from the speech stems in tools/audio/commentary.
// usage: node tools/audio/synth.mjs [music|crowd|goals|ui] [goal number]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { COMMENTARY } from './commentary/script.mjs';

const SR = 44100;
const OUT = 'public/audio';
const TMP = 'tools/audio/work';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const TAU = Math.PI * 2;
const only = process.argv[2];

/* ------------------------------------------------------------------ helpers */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
const stereo = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

/** A plain biquad, processed in place. */
function biquad(buf, type, freq, q = 0.7, gainDb = 0) {
  const w = (TAU * freq) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = 1 + a * A; b1 = -2 * c; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * c; a2 = 1 - a / A; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

function noise(len, seed) {
  const r = rng(seed);
  const b = new Float32Array(len);
  for (let i = 0; i < len; i++) b[i] = r() * 2 - 1;
  return b;
}

/** Slow random curve between 0 and 1, by smoothing a few random knots. */
function drift(len, knotsPerSec, seed) {
  const r = rng(seed);
  const n = Math.max(2, Math.ceil((len / SR) * knotsPerSec) + 2);
  const k = Float32Array.from({ length: n }, () => r());
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const p = (i / len) * (n - 1), a = Math.floor(p), f = p - a;
    const u = f * f * (3 - 2 * f);
    out[i] = k[a] + (k[Math.min(n - 1, a + 1)] - k[a]) * u;
  }
  return out;
}

/** Schroeder reverb, parallel combs into series allpasses. Returns a new stereo pair (wet only). */
function reverb([L, R], seconds = 2.2, damp = 0.3) {
  const process = (input, offset) => {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => d + offset);
    const out = new Float32Array(input.length);
    for (const d of combs) {
      const fb = 10 ** ((-3 * d) / (seconds * SR));
      const line = new Float32Array(d);
      let idx = 0, lp = 0;
      for (let i = 0; i < input.length; i++) {
        const y = line[idx];
        lp = y * (1 - damp) + lp * damp;
        line[idx] = input[i] + lp * fb;
        out[i] += y / combs.length;
        idx = (idx + 1) % d;
      }
    }
    for (const d of [225 + offset, 556 + offset, 441 + offset]) {
      const line = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = line[idx];
        const y = -out[i] + b;
        line[idx] = out[i] + b * 0.5;
        out[i] = y;
        idx = (idx + 1) % d;
      }
    }
    return out;
  };
  return [process(L, 0), process(R, 23)];
}

function addInto(dest, src, gain = 1, at = 0) {
  for (let i = 0; i < src.length && i + at < dest.length; i++) dest[i + at] += src[i] * gain;
}

/** Peak normalises, then rounds the very top off with a soft curve. */
function master(pair, peak = 0.89) {
  let max = 1e-6;
  for (const ch of pair) for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]));
  const g = peak / max;
  for (const ch of pair) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * g * 1.08) * 0.95;
  return pair;
}

/** Folds the tail back over the start so the file loops with no click or gap. */
function loopFold(pair, loopSec, foldSec) {
  const n = Math.round(loopSec * SR), f = Math.round(foldSec * SR);
  return pair.map((ch) => {
    const out = ch.slice(0, n);
    for (let i = 0; i < f && n + i < ch.length; i++) {
      const u = i / f;
      out[i] = out[i] * Math.sqrt(u) + ch[n + i] * Math.sqrt(1 - u);
    }
    return out;
  });
}

function writeMp3(name, pair, bitrate = '128k') {
  const n = pair[0].length;
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.max(-1, Math.min(1, pair[0][i])) * 32767, i * 4);
    pcm.writeInt16LE(Math.max(-1, Math.min(1, pair[1][i])) * 32767, i * 4 + 2);
  }
  const raw = path.join(TMP, `${name}.pcm`);
  fs.writeFileSync(raw, pcm);
  const file = path.join(OUT, `${name}.mp3`);
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'libmp3lame', '-b:a', bitrate, file], { encoding: 'utf8' });
  fs.unlinkSync(raw);
  if (r.status !== 0) throw new Error(r.stderr.slice(-500));
  console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB  ${(n / SR).toFixed(1)}s`);
}

/* ------------------------------------------------------------------ instruments */
/** Writes a note into a stereo bus. */
function bandoneon(bus, t0, dur, midi, vel, pan, r) {
  const f = midiHz(midi);
  const start = Math.floor(t0 * SR), n = Math.floor((dur + 0.12) * SR);
  const phases = [0, 0];
  const det = [1 - 0.0016, 1 + 0.0016];
  const harmonics = [1, 0.62, 0.5, 0.33, 0.26, 0.17, 0.12, 0.08, 0.05, 0.03];
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  const offset = r() * 6.28;
  for (let i = 0; i < n && start + i < bus[0].length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.035) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 1) * (0.9 + 0.1 * Math.sin(t * 4.6 * TAU + offset));
    let s = 0;
    for (let v = 0; v < 2; v++) {
      phases[v] += (f * det[v]) / SR;
      for (let h = 0; h < harmonics.length; h++) s += Math.sin(TAU * phases[v] * (h + 1)) * harmonics[h];
    }
    s *= env * vel * 0.13;
    bus[0][start + i] += s * gl;
    bus[1][start + i] += s * gr;
  }
}

function violin(bus, t0, dur, midi, vel, pan) {
  const f = midiHz(midi);
  const start = Math.floor(t0 * SR), n = Math.floor((dur + 0.25) * SR);
  let phase = 0;
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && start + i < bus[0].length; i++) {
    const t = i / SR;
    const vibDepth = Math.min(1, Math.max(0, (t - 0.18) / 0.35)) * 0.006;
    phase += (f * (1 + Math.sin(t * 5.6 * TAU) * vibDepth)) / SR;
    const env = Math.min(1, t / 0.09) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.25) : 1);
    let s = 0;
    for (let h = 1; h <= 8; h++) s += Math.sin(TAU * phase * h) / h ** 1.15;
    s *= env * vel * 0.16;
    bus[0][start + i] += s * gl;
    bus[1][start + i] += s * gr;
  }
}

function piano(bus, t0, midi, vel, pan) {
  const f = midiHz(midi);
  const start = Math.floor(t0 * SR), n = Math.floor(1.6 * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && start + i < bus[0].length; i++) {
    const t = i / SR;
    let s = 0;
    for (let h = 1; h <= 7; h++) {
      const stretch = h * Math.sqrt(1 + 0.0004 * h * h);
      s += (Math.sin(TAU * f * stretch * t) * Math.exp(-t * (1.9 + h * 0.8))) / h ** 1.1;
    }
    s *= Math.min(1, t / 0.002) * vel * 0.2;
    bus[0][start + i] += s * gl;
    bus[1][start + i] += s * gr;
  }
}

function bass(bus, t0, midi, vel) {
  const f = midiHz(midi);
  const start = Math.floor(t0 * SR), n = Math.floor(0.9 * SR);
  for (let i = 0; i < n && start + i < bus[0].length; i++) {
    const t = i / SR;
    const e = Math.exp(-t * 4.6) * Math.min(1, t / 0.004);
    const s = (Math.sin(TAU * f * t) + 0.42 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 7) + 0.18 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 11)) * e * vel * 0.36;
    bus[0][start + i] += s;
    bus[1][start + i] += s;
  }
}

/* ------------------------------------------------------------------ music: three loops */
const MINOR = [0, 2, 3, 5, 7, 8, 11];
function chordTones(root, kind) {
  if (kind === 'm') return [root, root + 3, root + 7];
  if (kind === 'M') return [root, root + 4, root + 7];
  if (kind === '7') return [root, root + 4, root + 7, root + 10];
  return [root, root + 3, root + 6];
}

function composeTango({ name, tonic, bpm, seed, feel, bars = 32 }) {
  const beat = 60 / bpm, barLen = beat * 4;
  const total = bars * barLen;
  const dry = stereo(total + 4);
  const r = rng(seed);
  const t = tonic;
  // i, V7, i, iv, VI, III, iv, V7 family: the classic minor-key walk of the form.
  const form = [
    [t, 'm'], [t, 'm'], [t + 7, '7'], [t + 7, '7'], [t + 7, '7'], [t + 7, '7'], [t, 'm'], [t, 'm'],
    [t + 5, 'm'], [t + 5, 'm'], [t, 'm'], [t, 'm'], [t + 8, 'M'], [t + 7, '7'], [t, 'm'], [t + 7, '7'],
    [t + 3, 'M'], [t + 3, 'M'], [t + 10, '7'], [t + 10, '7'], [t + 3, 'M'], [t + 8, 'M'], [t + 2, 'd'], [t + 7, '7'],
    [t, 'm'], [t + 5, 'm'], [t + 8, 'M'], [t + 7, '7'], [t + 5, 'm'], [t + 7, '7'], [t, 'm'], [t + 7, '7'],
  ];

  // The bandoneon line walks chord tones and neighbours, breathing every four bars.
  let melodyNote = t + 24 + 7;
  const scale = (m) => {
    const pc = ((m - t) % 12 + 12) % 12;
    return MINOR.includes(pc);
  };
  for (let b = 0; b < bars; b++) {
    const [root, kind] = form[b % form.length];
    const bt = b * barLen;
    const tones = chordTones(root, kind);
    const section = Math.floor(b / 8) % 4;

    // Bass: the marcato on 1 and 3, with a sincopa pick-up in lively bars.
    bass(dry, bt, root - 12 + (root > t + 5 ? -12 : 0), 0.95);
    bass(dry, bt + beat * 2, tones[2] - 24 + (root > t + 5 ? 0 : 12) - 12, 0.75);
    if (feel === 'sincopa' || b % 4 === 3) bass(dry, bt + beat * 3.5, root - 12, 0.5);

    // Piano: offbeat stabs in a 3-3-2 pattern.
    const hits = feel === 'sincopa' ? [0, 1.5, 3] : b % 2 ? [0, 1.5, 3] : [1, 3];
    for (const h of hits) {
      tones.forEach((tn, i) => piano(dry, bt + h * beat + i * 0.006, tn + 12, 0.55 + r() * 0.2, -0.25));
    }

    // Bandoneon melody: phrases of 3 to 7 notes, longer at the end of the phrase.
    if (section !== 2 || b % 2 === 0) {
      const rhythm = b % 4 === 3 ? [[0, 2.5]] : r() > 0.5 ? [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]] : [[0, 0.75], [0.75, 0.25], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]];
      for (const [pos, len] of rhythm) {
        const options = [];
        for (let o = -1; o <= 2; o++) for (const tn of tones) options.push(tn + o * 12);
        for (let d = -2; d <= 2; d++) if (scale(melodyNote + d)) options.push(melodyNote + d);
        options.sort((x, y) => Math.abs(x - melodyNote) - Math.abs(y - melodyNote));
        const picked = options[Math.floor(r() * Math.min(5, options.length))];
        melodyNote = Math.max(t + 17, Math.min(t + 36, picked));
        bandoneon(dry, bt + pos * beat, len * beat * 0.96, melodyNote, 0.85, 0.12, r);
      }
    } else {
      // Sustained bellows chords while the violin takes over.
      tones.forEach((tn) => bandoneon(dry, bt, barLen * 0.94, tn + 12, 0.45, 0.2, r));
    }

    // Violin: enters on the second half, floating above in long lines.
    if (section >= 1) {
      const top = tones[Math.floor(r() * tones.length)] + 24 + (r() > 0.5 ? 12 : 0);
      const v = section === 3 ? 0.8 : 0.55;
      violin(dry, bt, beat * 2.2, top, v, -0.35);
      if (r() > 0.4) violin(dry, bt + beat * 2, beat * 2, top + (r() > 0.5 ? 2 : -1), v * 0.9, -0.35);
    }
  }

  const wet = reverb(dry, 2.4, 0.42);
  const mixL = new Float32Array(dry[0].length), mixR = new Float32Array(dry[1].length);
  for (let i = 0; i < mixL.length; i++) {
    mixL[i] = dry[0][i] * 0.82 + wet[0][i] * 1.05;
    mixR[i] = dry[1][i] * 0.82 + wet[1][i] * 1.05;
  }
  biquad(mixL, 'hp', 45);
  biquad(mixR, 'hp', 45);
  biquad(mixL, 'lp', 7000);
  biquad(mixR, 'lp', 7000);
  writeMp3(name, master(loopFold([mixL, mixR], total, 3)), '128k');
}

/* ------------------------------------------------------------------ crowd */
/** Formant bands that make broadband noise read as thousands of voices. */
function voices(len, seed, level = 1) {
  const bands = [[320, 1.1, 0.8], [640, 1.3, 1.0], [1150, 1.6, 0.85], [2300, 1.9, 0.5], [3900, 2.2, 0.25]];
  const out = new Float32Array(len);
  bands.forEach(([f, q, g], i) => {
    const b = biquad(noise(len, seed + i * 17 + 3), 'bp', f, q);
    const wob = drift(len, 0.9, seed + i * 31 + 5);
    for (let k = 0; k < len; k++) out[k] += b[k] * g * (0.55 + wob[k] * 0.9);
  });
  for (let k = 0; k < len; k++) out[k] *= level;
  return out;
}

/** Stadium whistles and shouts, sparsely scattered through a bus. */
function terraceDetail(pair, sec, seed, density = 0.5) {
  const r = rng(seed);
  const count = Math.floor(sec * density);
  for (let c = 0; c < count; c++) {
    const at = Math.floor(r() * sec * SR);
    const kind = r();
    const pan = r();
    const len = Math.floor((0.25 + r() * 0.7) * SR);
    const f0 = kind > 0.72 ? 1700 + r() * 1400 : 240 + r() * 420;
    const vol = kind > 0.72 ? 0.018 + r() * 0.02 : 0.05 + r() * 0.05;
    let ph = 0;
    for (let i = 0; i < len && at + i < pair[0].length; i++) {
      const t = i / len;
      const env = Math.sin(t * Math.PI) ** 1.5;
      const bend = kind > 0.72 ? 1 + Math.sin(t * 9) * 0.015 : 1 - t * 0.28;
      ph += (f0 * bend) / SR;
      const s = (Math.sin(TAU * ph) + 0.4 * Math.sin(TAU * ph * 2) + (kind > 0.72 ? 0 : 0.3 * Math.sin(TAU * ph * 3))) * env * vol;
      pair[0][at + i] += s * (1 - pan);
      pair[1][at + i] += s * pan;
    }
  }
}

function crowdBed(name, sec, seed, level) {
  const fold = 3;
  const len = Math.floor((sec + fold) * SR);
  const L = voices(len, seed, level), R = voices(len, seed + 1000, level);
  const swell = drift(len, 0.18, seed + 7);
  for (let i = 0; i < len; i++) {
    const g = 0.55 + swell[i] * 0.6;
    L[i] *= g;
    R[i] *= g;
  }
  const pair = [L, R];
  terraceDetail(pair, sec + fold, seed + 9, 0.7);
  const wet = reverb(pair, 3.2, 0.55);
  for (let i = 0; i < len; i++) {
    L[i] = L[i] * 0.7 + wet[0][i] * 0.8;
    R[i] = R[i] * 0.7 + wet[1][i] * 0.8;
  }
  writeMp3(name, master(loopFold(pair, sec, fold), 0.6), '96k');
}

/** The cover's bed: a wordless terrace chant over a slow bass drum. */
function terraceChant(name, sec, seed) {
  const fold = 3;
  const total = sec + fold;
  const pair = stereo(total);
  const n = pair[0].length;
  const bedL = voices(n, seed, 0.55), bedR = voices(n, seed + 99, 0.55);
  addInto(pair[0], bedL);
  addInto(pair[1], bedR);
  const beat = 0.62;
  // Each sung note is many detuned voices through vowel formants, so it reads as a crowd, not a synth.
  const melody = [62, 65, 67, 69, 69, 67, 65, 62, 60, 62, 65, 67, 65, 62, 60, 57];
  const r = rng(seed + 3);
  const dur = beat * 1.9;
  for (let bar = 0; bar * dur * melody.length < total; bar++) {
    melody.forEach((m, i) => {
      const t0 = bar * dur * melody.length + i * dur;
      const start = Math.floor(t0 * SR), len = Math.floor(dur * 1.08 * SR);
      const voicesCount = 14;
      const note = new Float32Array(len);
      for (let v = 0; v < voicesCount; v++) {
        const octave = v % 3 === 0 ? -12 : 0;
        const f = midiHz(m + octave) * (1 + (r() - 0.5) * 0.018);
        const phase0 = r() * 6;
        for (let k = 0; k < len; k++) {
          const t = k / SR;
          const p = TAU * f * t + phase0 + Math.sin(t * (4 + v * 0.3)) * 0.1;
          note[k] += (Math.sin(p) + 0.6 * Math.sin(2 * p) + 0.42 * Math.sin(3 * p) + 0.26 * Math.sin(4 * p) + 0.16 * Math.sin(5 * p)) / voicesCount;
        }
      }
      biquad(note, 'bp', 720, 1.1);
      for (let k = 0; k < len; k++) {
        const t = k / len;
        const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.2);
        if (start + k < n) {
          pair[0][start + k] += note[k] * env * 1.7;
          pair[1][start + k] += note[k] * env * 1.7;
        }
      }
    });
  }
  // The bombo: a deep drum on the half note.
  for (let t = 0; t < total; t += beat * 2) {
    const start = Math.floor(t * SR), len = Math.floor(0.5 * SR);
    for (let k = 0; k < len && start + k < n; k++) {
      const u = k / SR;
      const s = Math.sin(TAU * (58 - u * 42) * u) * Math.exp(-u * 8.5) * 0.5;
      pair[0][start + k] += s;
      pair[1][start + k] += s;
    }
  }
  const wet = reverb(pair, 3.4, 0.5);
  for (let i = 0; i < n; i++) {
    pair[0][i] = pair[0][i] * 0.62 + wet[0][i] * 0.9;
    pair[1][i] = pair[1][i] * 0.62 + wet[1][i] * 0.9;
  }
  writeMp3(name, master(loopFold(pair, sec, fold), 0.62), '96k');
}

/** A clip's sound: pressure builds through the attack, a thump on the strike, the roar on the goal. */
function goalBed({ duration, shotAt, flight, seed }) {
  const len = Math.floor(duration * SR);
  const arrive = shotAt + flight;
  const L = voices(len, seed, 1), R = voices(len, seed + 1000, 1);
  const Lb = voices(len, seed + 2000, 1), Rb = voices(len, seed + 3000, 1);
  biquad(Lb, 'hp', 500);
  biquad(Rb, 'hp', 500);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const build = 0.32 + 0.42 * Math.min(1, t / shotAt) ** 2;
    const hush = t > shotAt - 0.12 && t < arrive ? 1 - 0.3 * Math.sin(((t - shotAt + 0.12) / (arrive - shotAt + 0.12)) * Math.PI) : 1;
    const up = Math.min(1, Math.max(0, (t - arrive) / 0.35));
    const roar = up * up * (3 - 2 * up) * 2.5 * (1 - 0.3 * Math.min(1, Math.max(0, (t - arrive - 1.6) / (duration - arrive - 1.6))));
    const g = build * hush + roar;
    // The start and end of the clip fade so the loop never clicks.
    const edge = Math.min(1, t / 0.25) * Math.min(1, (duration - t) / 0.45);
    L[i] = (L[i] * g + Lb[i] * roar * 0.8) * edge;
    R[i] = (R[i] * g + Rb[i] * roar * 0.8) * edge;
  }
  const pair = [L, R];
  terraceDetail(pair, duration, seed + 5, 1.1);
  // Strike: a low thump with a short leather slap on top.
  const hitAt = Math.floor(shotAt * SR);
  const n2 = Math.floor(0.22 * SR);
  const slap = biquad(noise(n2, seed + 11), 'bp', 2400, 1.0);
  for (let k = 0; k < n2 && hitAt + k < len; k++) {
    const u = k / SR;
    const s = Math.sin(TAU * (130 - u * 300) * u) * Math.exp(-u * 26) * 1.6 + slap[k] * Math.exp(-u * 60) * 1.4;
    L[hitAt + k] += s;
    R[hitAt + k] += s;
  }
  const wet = reverb(pair, 2.8, 0.5);
  for (let i = 0; i < len; i++) {
    L[i] = L[i] * 0.72 + wet[0][i] * 0.85;
    R[i] = R[i] * 0.72 + wet[1][i] * 0.85;
  }
  return master(pair, 0.8);
}

/* ------------------------------------------------------------------ commentary */
const STEMS = 'tools/audio/commentary/stems';
const CLEARANCE = 0.05; // The least gap between two lines.
const TAIL = 0.3; // Speech has to finish this long before the clip ends.
const MAX_TEMPO = 1.2; // Lines may be sped up this much to fit, before it starts to sound hurried.
const CLEAR_DB = 7; // The crowd is held this far below the words, so the quiet build-up is left alone...
const DUCK_LIMIT_DB = 9; // ...and the roar never drops by more than this, so the goal still feels huge.

function readStem(file, tempo = 1) {
  const filter = tempo === 1 ? [] : ['-af', `atempo=${tempo.toFixed(3)}`];
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-v', 'error', '-i', file, ...filter, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(r.stderr.toString().slice(-300));
  return new Float32Array(new Uint8Array(r.stdout).buffer);
}

/** Cuts the silence off both ends, so a line's timing means when the words really start and stop. */
function trimSpeech(x) {
  const win = Math.round(0.01 * SR);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const floor = peak * 0.035;
  const loudAt = (i) => {
    let e = 0;
    for (let k = i; k < Math.min(x.length, i + win); k++) e = Math.max(e, Math.abs(x[k]));
    return e > floor;
  };
  let a = 0, b = x.length - win;
  while (a < x.length - win && !loudAt(a)) a += win;
  while (b > a && !loudAt(b)) b -= win;
  const pad = Math.round(0.015 * SR);
  const out = x.slice(Math.max(0, a - pad), Math.min(x.length, b + win + pad));
  const fade = Math.round(0.006 * SR);
  for (let i = 0; i < fade && i < out.length; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

/** The close microphone of a commentary box. The more excited the line, the louder and harder it is driven. */
function broadcastVoice(x, ex) {
  biquad(x, 'hp', 105, 0.8);
  biquad(x, 'peak', 240, 1.0, -2);
  biquad(x, 'peak', 3100, 1.0, 3.5);
  biquad(x, 'peak', 6000, 1.2, 1.5);
  // A fast compressor holds the words level, so quiet consonants survive over the crowd.
  let env = 0, peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const atk = Math.exp(-1 / (0.004 * SR)), rel = Math.exp(-1 / (0.09 * SR));
  const threshold = peak * 0.22;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    env = a > env ? atk * env + (1 - atk) * a : rel * env + (1 - rel) * a;
    if (env > threshold) x[i] *= (threshold / env) ** (1 - 1 / 3.5);
  }
  // Level by the loudness of the speech itself, ignoring the gaps between words.
  let sum = 0, active = 0;
  peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (const v of x) if (Math.abs(v) > peak * 0.1) { sum += v * v; active++; }
  const rms = Math.sqrt(sum / Math.max(1, active));
  const targetDb = -17 + Math.max(0, ex - 0.6) * 4.5;
  const gain = 10 ** (targetDb / 20) / Math.max(rms, 1e-6);
  const drive = 1 + Math.max(0, ex - 1) * 0.7;
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * gain * drive) / drive;
  return x;
}

/** Puts one take's lines on the clip's timeline, nudging or tightening them so they never overlap. */
function layoutTake(lines, stemName, { duration, shotAt, flight }, report) {
  const placed = lines.map((line, i) => {
    const file = path.join(STEMS, `${stemName}_${i}.wav`);
    const dry = trimSpeech(readStem(file));
    return { ...line, file, len: dry.length / SR, tempo: 1 };
  });
  const net = shotAt + flight;
  placed.forEach((l) => {
    if (l.at === 'net') l.start = net + 0.02;
    else if (l.end === 'strike') l.start = shotAt + 0.03 - l.len;
    else l.start = l.at;
  });
  // Right to left: each line has until the next one starts, or until the clip's tail.
  for (let i = placed.length - 1; i >= 0; i--) {
    const l = placed[i];
    const limit = i === placed.length - 1 ? duration - TAIL : placed[i + 1].start - CLEARANCE;
    if (l.start + l.len > limit) {
      const fixed = l.at === 'net' || l.end === 'strike';
      if (!fixed) l.start = Math.max(i ? placed[i - 1].start + placed[i - 1].len + CLEARANCE : 0.25, limit - l.len);
      if (l.start + l.len > limit) {
        l.tempo = Math.min(MAX_TEMPO, l.len / Math.max(0.2, limit - l.start));
        l.len /= l.tempo;
      }
    }
  }
  placed.forEach((l, i) => {
    const limit = i === placed.length - 1 ? duration - TAIL : placed[i + 1].start - CLEARANCE;
    const over = l.start + l.len - limit;
    report.push(`  ${l.start.toFixed(2).padStart(5)} to ${(l.start + l.len).toFixed(2).padStart(5)}  x${l.tempo.toFixed(2)}  ${over > 0.01 ? `OVERLAP ${over.toFixed(2)}s  ` : ''}${l.text}`);
  });
  return placed;
}

/** One pass of a clip: the voice on top, with the crowd dropping out of its way. */
function mixTake(bed, lines, stemName, play, report) {
  const n = bed[0].length;
  const voice = new Float32Array(n);
  const placed = layoutTake(lines, stemName, play, report);
  for (const l of placed) {
    const x = broadcastVoice(trimSpeech(readStem(l.file, l.tempo)), l.ex);
    addInto(voice, x, 1, Math.floor(l.start * SR));
  }
  // A short room around the voice stops it sitting apart from the stadium.
  const wet = reverb([voice, voice], 0.5, 0.55);
  const level = (read) => {
    const out = new Float32Array(n);
    const k = Math.exp(-1 / (0.06 * SR));
    let e = 0;
    for (let i = 0; i < n; i++) {
      e = k * e + (1 - k) * read(i) ** 2;
      out[i] = Math.sqrt(e);
    }
    return out;
  };
  const voiceLevel = level((i) => voice[i]);
  const crowdLevel = level((i) => (bed[0][i] + bed[1][i]) / 2);
  const look = Math.round(0.08 * SR);
  const floor = 10 ** (-DUCK_LIMIT_DB / 20);
  const clear = 10 ** (-CLEAR_DB / 20);
  // The crowd slides down just ahead of the words, and comes back up slowly once they stop.
  const atk = Math.exp(-1 / (0.03 * SR)), rel = Math.exp(-1 / (0.4 * SR));
  const duck = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const v = voiceLevel[Math.min(n - 1, i + look)];
    const want = v > 0.003 ? Math.max(floor, Math.min(1, (v * clear) / Math.max(crowdLevel[i], 1e-6))) : 1;
    const k = want < g ? atk : rel;
    g = k * g + (1 - k) * want;
    duck[i] = g;
  }
  // How far each line stands above the crowd, printed for the same reason as the timings.
  const rmsDb = (read, a, b) => {
    let e = 0;
    for (let i = a; i < b; i++) e += read(i) ** 2;
    return 10 * Math.log10(e / Math.max(1, b - a) + 1e-12);
  };
  report.push(`  levels: ${placed.map((l) => {
    const a = Math.floor(l.start * SR), b = Math.min(n, Math.floor((l.start + l.len) * SR));
    return `${rmsDb((i) => voice[i], a, b).toFixed(0)}/${rmsDb((i) => bed[0][i] * duck[i], a, b).toFixed(0)}dB`;
  }).join('  ')}  (voice/crowd)`);
  return bed.map((ch, c) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = ch[i] * duck[i] + voice[i] + wet[c][i] * 0.08;
    return out;
  });
}

/** The finished sound of a goal: the live call on the first pass of the clip, the replay call on the second. */
function goalSound(name, play, index) {
  const bed = goalBed(play);
  const takes = COMMENTARY[index];
  const spoken = takes && ['live', 'replay'].every((take) => takes[take].every((_, i) => fs.existsSync(path.join(STEMS, `g${index}_${take}_${i}.wav`))));
  if (!spoken) {
    writeMp3(name, bed, '96k');
    return;
  }
  const report = [`${name}`, ' live']; // Printed so the timing of every line can be checked.
  const live = mixTake(bed, takes.live, `g${index}_live`, play, report);
  report.push(' replay');
  const replay = mixTake(bed, takes.replay, `g${index}_replay`, play, report);
  console.log(report.join('\n'));
  const pair = live.map((ch, c) => {
    const out = new Float32Array(ch.length * 2);
    out.set(ch, 0);
    out.set(replay[c], ch.length);
    return out;
  });
  writeMp3(name, master(pair, 0.89), '128k');
}

/* ------------------------------------------------------------------ interface */
function uiSounds() {
  // Hover: a soft high tick with a slight downward glide.
  {
    const pair = stereo(0.16);
    const n = pair[0].length;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (2100 - t * 3800) / SR;
      const s = Math.sin(TAU * ph) * Math.exp(-t * 38) * 0.42 + Math.sin(TAU * ph * 2.01) * Math.exp(-t * 60) * 0.12;
      pair[0][i] = s;
      pair[1][i] = s;
    }
    const wet = reverb(pair, 0.6, 0.4);
    for (let i = 0; i < n; i++) {
      pair[0][i] += wet[0][i] * 0.35;
      pair[1][i] += wet[1][i] * 0.35;
    }
    writeMp3('hover', master(pair, 0.8), '96k');
  }
  // Bar: an airy whoosh that opens as the gold arc moves round.
  {
    const sec = 1.3;
    const pair = stereo(sec);
    const n = pair[0].length;
    for (let c = 0; c < 2; c++) {
      const nz = noise(n, 44 + c);
      let lp = 0, bp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const f = 300 + 3600 * Math.sin(t * Math.PI) ** 1.6;
        const g = 2 * Math.sin((Math.PI * f) / SR);
        lp += g * bp;
        const hp = nz[i] - lp - 0.45 * bp;
        bp += g * hp;
        pair[c][i] = bp * Math.sin(t * Math.PI) ** 2 * 0.5;
      }
    }
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const shimmer = Math.sin(TAU * (880 + t * 220) * t) * Math.sin((t / sec) * Math.PI) ** 3 * 0.05;
      pair[0][i] += shimmer;
      pair[1][i] += shimmer;
    }
    const wet = reverb(pair, 1.4, 0.4);
    for (let i = 0; i < n; i++) {
      pair[0][i] = pair[0][i] * 0.8 + wet[0][i] * 0.5;
      pair[1][i] = pair[1][i] * 0.8 + wet[1][i] * 0.5;
    }
    writeMp3('bar', master(pair, 0.8), '96k');
  }
}

/* ------------------------------------------------------------------ run */
// Timings must match the plays in tools/render/web/match.js.
const PLAYS = [
  { duration: 11, shotAt: 6.4, flight: 0.55 },
  { duration: 10, shotAt: 5.6, flight: 0.42 },
  { duration: 11, shotAt: 6.2, flight: 0.85 },
  { duration: 10, shotAt: 5.8, flight: 0.34 },
  { duration: 10, shotAt: 6.0, flight: 0.24 },
  { duration: 11, shotAt: 5.2, flight: 0.9 },
  { duration: 10, shotAt: 6.0, flight: 0.5 },
  { duration: 12, shotAt: 7.2, flight: 0.95 },
];

if (!only || only === 'ui') uiSounds();
const oneGoal = process.argv[3];
if (!only || only === 'goals') PLAYS.forEach((p, i) => {
  if (oneGoal === undefined || Number(oneGoal) === i) goalSound(`goal_${i}_call`, { ...p, seed: 700 + i * 13 }, i);
});
if (!only || only === 'crowd') {
  crowdBed('crowd1', 24, 101, 0.9);
  crowdBed('crowd2', 28, 202, 1.0);
  terraceChant('anthem', 38, 303);
}
if (!only || only === 'music') {
  composeTango({ name: 'music_1', tonic: 50, bpm: 92, seed: 2024, feel: 'marcato' });
  composeTango({ name: 'music_2', tonic: 57, bpm: 104, seed: 777, feel: 'sincopa' });
  composeTango({ name: 'music_3', tonic: 52, bpm: 84, seed: 31337, feel: 'marcato' });
}
console.log('done');
