// FLUX through a free Hugging Face Space (anonymous, no account). Fictional subjects only.
// usage: node tools/atlas/gen-flux.mjs <out> <w> <h> <seed> <space:schnell|dev|merged|zimage> "<prompt>"
import { Client } from '@gradio/client';
import fs from 'node:fs';
import path from 'node:path';
const [out, W, H, seed, which, prompt] = process.argv.slice(2);
fs.mkdirSync(path.dirname(out), { recursive: true });
const t0 = Date.now();
const S = {
  schnell: ['black-forest-labs/FLUX.1-schnell', '/infer', { prompt, seed: +seed, randomize_seed: false, width: +W, height: +H, num_inference_steps: 4 }],
  dev: ['black-forest-labs/FLUX.1-dev', '/infer', { prompt, seed: +seed, randomize_seed: false, width: +W, height: +H, guidance_scale: 3.5, num_inference_steps: 24 }],
  merged: ['multimodalart/FLUX.1-merged', '/infer', { prompt, seed: +seed, randomize_seed: false, width: +W, height: +H, guidance_scale: 3.5, num_inference_steps: 8 }],
  zimage: ['Tongyi-MAI/Z-Image-Turbo', '/generate', { prompt, resolution: `${W}x${H}`, seed: +seed, steps: 8, shift: 3, random_seed: false }],
}[which];
try {
  const app = await Client.connect(S[0]);
  const res = await app.predict(S[1], S[2]);
  const d = res.data?.[0];
  const item = Array.isArray(d) ? (d[0]?.image || d[0]) : d;
  const u = item?.url || item?.path;
  if (!u) throw new Error('no url: ' + JSON.stringify(res.data).slice(0, 300));
  const r = await fetch(u);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok', which, ((Date.now() - t0) / 1000).toFixed(1) + 's', out);
} catch (e) { console.log('fail', which, String(e.message || JSON.stringify(e)).slice(0, 400)); process.exit(1); }
process.exit(0);
