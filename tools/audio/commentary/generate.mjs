// Speaks the commentary in script.mjs with Chatterbox (MIT licence), locally on the CPU, and writes one
// stem per line into ./stems. tools/audio/synth.mjs then mixes those stems into the goal sounds.
//
// This folder has its own package.json, because the speech libraries are close to 1 GB:
//   npm run assets:install && npm run assets:voice
// The model is about 1.5 GB. Set MODELS_DIR to keep it somewhere that is not synced.
//
// A line is only spoken again when its text or setting has changed, so editing one line is quick.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { env, AutoProcessor, ChatterboxModel, Tensor } from '@huggingface/transformers';
import { COMMENTARY } from './script.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEMS = path.join(HERE, 'stems');
const REFERENCE = path.join(HERE, 'reference.wav');
const MANIFEST = path.join(STEMS, 'manifest.json');
const SR = 24000;

fs.mkdirSync(STEMS, { recursive: true });
if (process.env.MODELS_DIR) env.cacheDir = process.env.MODELS_DIR;
env.allowLocalModels = false;
// Speech takes a while on the CPU, so leave the rest of the machine responsive.
try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const jobs = [];
COMMENTARY.forEach((goal, g) => {
  for (const take of ['live', 'replay']) {
    goal[take].forEach((line, i) => {
      const id = `g${g}_${take}_${i}`;
      const key = `${line.ex}|${line.text}`;
      if (manifest[id] !== key || !fs.existsSync(path.join(STEMS, `${id}.wav`))) jobs.push({ id, key, ...line });
    });
  }
});
console.log(`${jobs.length} lines to speak`);
if (!jobs.length) process.exit(0);

function decode(file) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return new Float32Array(new Uint8Array(r.stdout).buffer);
}

function writeWav(file, f32) {
  const pcm = Buffer.alloc(f32.length * 2);
  for (let i = 0; i < f32.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

const MODEL = 'onnx-community/chatterbox-ONNX';
const processor = await AutoProcessor.from_pretrained(MODEL);
const model = await ChatterboxModel.from_pretrained(MODEL, {
  device: 'cpu',
  dtype: { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q4', conditional_decoder: 'fp32' },
});
const reference = decode(REFERENCE);
const speaker = await model.encode_speech(new Tensor('float32', reference, [1, reference.length]));

for (const job of jobs) {
  const started = Date.now();
  const wave = await model.generate({
    ...processor.tokenizer(job.text),
    ...speaker,
    exaggeration: job.ex,
    max_new_tokens: 300,
    repetition_penalty: 1.2,
  });
  writeWav(path.join(STEMS, `${job.id}.wav`), wave.data);
  manifest[job.id] = job.key;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(job.id, `${(wave.data.length / SR).toFixed(2)}s of speech in ${((Date.now() - started) / 1000).toFixed(0)}s:`, job.text);
}
process.exit(0);
