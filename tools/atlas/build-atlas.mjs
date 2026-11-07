// Turns one photo into the atlas the point cloud reads: colour on top, depth + matte strip below.
//
//   node tools/atlas/build-atlas.mjs            builds every entry in JOBS (skips finished analysis)
//   node tools/atlas/build-atlas.mjs hero       builds only entries whose name contains "hero"
//   node tools/atlas/build-atlas.mjs --compose  re-composes from cached matte and depth (fast)
//
// Analysis is cached in tools/atlas/work/<name>/ because the models take minutes per image on CPU.
// Models: BiRefNet (matte) and Depth Anything V2 (depth), ONNX, run locally on the CPU.
import ort from 'onnxruntime-node';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// The folder holding birefnet/model.onnx and depth/model.onnx. Only needed when analysing new images.
const MODELS = process.env.MODELS_DIR || 'tools/atlas/models';
const WORK = 'tools/atlas/work';
const SRC = 'tools/atlas/src';
const OUT = 'public/webgl';
const ATLAS_W = 1920, COLOR_H = 1080, STRIP_H = 540;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
const THREADS = Number(process.env.ORT_THREADS || 6);

/**
 * Each job: source image, output atlas, the depth range the figure is mapped into, and how the
 * figure sits in the frame (zoom about the centre, then shift, in fractions of the frame).
 * `patch` lists [cx, cy, rx, ry] ellipses in source pixels, inpainted before use. They remove the
 * brand-like marks image generators like to draw on sportswear.
 */
const JOBS = [
  { name: 'hero_a', out: 'hero_atlas', depth: [0.02, 0.98], zoom: 1.06, dx: -0.012, dy: 0.018, flip: true, patch: [] },
  { name: 'rec_0', out: 'record_0_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_1', out: 'record_1_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_2', out: 'record_2_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_3', out: 'record_3_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_4', out: 'record_4_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_5', out: 'record_5_atlas', depth: [0.02, 0.98], zoom: 1, dx: -0.03, dy: 0.02, patch: [] },
  { name: 'rec_6', out: 'record_6_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_7', out: 'record_7_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0.02, patch: [] },
  { name: 'rec_8', out: 'record_8_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0, patch: [] },
  { name: 'err404', out: 'not_found_atlas', depth: [0.02, 0.98], zoom: 1, dx: 0, dy: 0, patch: [] },
];

const args = process.argv.slice(2);
const composeOnly = args.includes('--compose');
const filter = args.find((a) => !a.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });

const overridesPath = 'tools/atlas/patches.json';
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

async function toTensor(input, w, h) {
  const raw = await sharp(input).removeAlpha().resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  const t = new Float32Array(3 * w * h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) t[c * w * h + i] = (raw[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  return t;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Edge-aware smoothing, so depth noise flattens while limbs keep crisp edges. */
function guidedFilter(I, p, r, eps, w, h) {
  const mI = boxBlur(I, w, h, r), mP = boxBlur(p, w, h, r);
  const ip = new Float32Array(w * h), ii = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { ip[i] = I[i] * p[i]; ii[i] = I[i] * I[i]; }
  const mIp = boxBlur(ip, w, h, r), mII = boxBlur(ii, w, h, r);
  const a = new Float32Array(w * h), b = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const cov = mIp[i] - mI[i] * mP[i], v = mII[i] - mI[i] * mI[i];
    a[i] = cov / (v + eps);
    b[i] = mP[i] - a[i] * mI[i];
  }
  const mA = boxBlur(a, w, h, r), mB = boxBlur(b, w, h, r);
  const q = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) q[i] = mA[i] * I[i] + mB[i];
  return q;
}

/** Extends a value field past the edge of its valid region so nothing samples the background. */
function pullPush(val, wgt, w, h) {
  const levels = [{ w, h, v: Float32Array.from(val, (d, i) => d * wgt[i]), g: Float32Array.from(wgt) }];
  while (levels.at(-1).w > 2 && levels.at(-1).h > 2) {
    const p = levels.at(-1), nw = Math.ceil(p.w / 2), nh = Math.ceil(p.h / 2);
    const v = new Float32Array(nw * nh), g = new Float32Array(nw * nh);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x, j = (y >> 1) * nw + (x >> 1);
      v[j] += p.v[i];
      g[j] += p.g[i];
    }
    levels.push({ w: nw, h: nh, v, g });
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const p = levels[l], q = levels[l + 1];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      if (p.g[i] >= 0.999) continue;
      const j = (y >> 1) * q.w + (x >> 1);
      if (q.g[j] > 1e-6) { p.v[i] += (q.v[j] / q.g[j]) * (1 - Math.min(1, p.g[i])); p.g[i] = 1; }
    }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = levels[0].v[i] / Math.max(levels[0].g[i], 1e-3);
  return out;
}

async function analyze(job, input, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const meta = await sharp(input).metadata();
  const maskFile = path.join(dir, 'mask.png');
  if (!fs.existsSync(maskFile)) {
    const t0 = Date.now(), S = 1024;
    const session = await ort.InferenceSession.create(`${MODELS}/birefnet/model.onnx`, { executionProviders: ['cpu'], graphOptimizationLevel: 'basic', intraOpNumThreads: THREADS });
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', await toTensor(input, S, S), [1, 3, S, S]) });
    const logits = out[session.outputNames.at(-1)].data;
    await session.release();
    const m = Buffer.alloc(S * S);
    for (let i = 0; i < S * S; i++) m[i] = Math.round(255 / (1 + Math.exp(-logits[i])));
    await sharp(m, { raw: { width: S, height: S, channels: 1 } }).resize(meta.width, meta.height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('b-w').png().toFile(maskFile);
    console.log(job.name, 'matte', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const depthFile = path.join(dir, 'depth.f32');
  if (!fs.existsSync(depthFile)) {
    const t0 = Date.now();
    const aspect = meta.width / meta.height, LONG = 1190;
    const snap = (x) => Math.max(14, Math.round(x / 14) * 14);
    const dw = aspect >= 1 ? snap(LONG) : snap(LONG * aspect), dh = aspect >= 1 ? snap(LONG / aspect) : snap(LONG);
    const session = await ort.InferenceSession.create(`${MODELS}/depth/model.onnx`, { executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: THREADS });
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', await toTensor(input, dw, dh), [1, 3, dh, dw]) });
    const tensor = out[session.outputNames[0]];
    await session.release();
    fs.writeFileSync(depthFile, Buffer.from(Float32Array.from(tensor.data).buffer));
    fs.writeFileSync(path.join(dir, 'depth.json'), JSON.stringify({ w: tensor.dims.at(-1), h: tensor.dims.at(-2) }));
    console.log(job.name, 'depth', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
}

/** Inpaints ellipses with a feathered pull-push fill from the surrounding pixels. */
function inpaint(rgb, w, h, patches) {
  if (!patches?.length) return rgb;
  const weight = new Float32Array(w * h).fill(1);
  const feather = new Float32Array(w * h);
  for (const [cx, cy, rx, ry] of patches) {
    for (let y = Math.max(0, Math.floor(cy - ry - 8)); y <= Math.min(h - 1, Math.ceil(cy + ry + 8)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx - 8)); x <= Math.min(w - 1, Math.ceil(cx + rx + 8)); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d <= 1.12) weight[y * w + x] = 0;
        feather[y * w + x] = Math.max(feather[y * w + x], 1 - Math.min(1, Math.max(0, (d - 0.9) / 0.35)));
      }
    }
  }
  const out = Buffer.from(rgb);
  for (let c = 0; c < 3; c++) {
    const ch = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) ch[i] = rgb[i * 3 + c];
    const filled = pullPush(ch, weight, w, h);
    const soft = boxBlur(boxBlur(filled, w, h, 5), w, h, 3);
    for (let i = 0; i < w * h; i++) if (feather[i] > 0) out[i * 3 + c] = Math.max(0, Math.min(255, ch[i] * (1 - feather[i]) + soft[i] * feather[i]));
  }
  return out;
}

async function compose(job, input, dir) {
  const meta = await sharp(input).metadata();
  const w = meta.width, h = meta.height;
  const rgb0 = await sharp(input).removeAlpha().raw().toBuffer();
  const rgb = inpaint(rgb0, w, h, overrides[job.name]?.patch || job.patch);
  const mask = await sharp(path.join(dir, 'mask.png')).toColourspace('b-w').raw().toBuffer();

  // Depth: robustly normalise inside the figure only, then map into this job's range.
  const dInfo = JSON.parse(fs.readFileSync(path.join(dir, 'depth.json'), 'utf8'));
  const raw = new Float32Array(fs.readFileSync(path.join(dir, 'depth.f32')).buffer.slice(0));
  const maskD = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).resize(dInfo.w, dInfo.h, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
  const inside = [];
  for (let i = 0; i < raw.length; i++) if (maskD[i] > 200) inside.push(raw[i]);
  if (!inside.length) throw new Error(job.name + ': empty matte');
  inside.sort((a, b) => a - b);
  const lo = inside[Math.floor(inside.length * 0.01)], hi = inside[Math.floor(inside.length * 0.99)];
  const [dLo, dHi] = overrides[job.name]?.depth || job.depth;
  const norm = new Float32Array(raw.length);
  const valid = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = Math.min(1, Math.max(0, (raw[i] - lo) / Math.max(hi - lo, 1e-6)));
    norm[i] = dLo + (dHi - dLo) * v;
    valid[i] = maskD[i] > 200 ? 1 : 0;
  }
  const pushed = pullPush(norm, valid, dInfo.w, dInfo.h);
  const blurred = boxBlur(boxBlur(pushed, dInfo.w, dInfo.h, 24), dInfo.w, dInfo.h, 12);
  const filled = new Float32Array(norm.length);
  for (let i = 0; i < norm.length; i++) filled[i] = valid[i] ? norm[i] : blurred[i] > 0.01 ? blurred[i] : dLo;
  const guide = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).resize(dInfo.w, dInfo.h, { fit: 'fill' }).greyscale().raw().toBuffer();
  const I = Float32Array.from(guide, (v) => v / 255);
  const smooth = guidedFilter(I, filled, 4, 0.01, dInfo.w, dInfo.h);
  const depth8 = Buffer.alloc(dInfo.w * dInfo.h);
  for (let i = 0; i < depth8.length; i++) depth8[i] = Math.round(Math.min(1, Math.max(0, smooth[i])) * 255);

  // Keep colour only inside the matte, so the atlas compresses to almost nothing outside the figure.
  const cut = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) if (mask[i] > 8) { cut[i * 3] = rgb[i * 3]; cut[i * 3 + 1] = rgb[i * 3 + 1]; cut[i * 3 + 2] = rgb[i * 3 + 2]; }

  // Frame placement: fit inside the plate, then apply the job's zoom and shift.
  // Pixels are copied by hand: sharp may hand back 3 or 4 channels depending on the pipeline.
  const place = async (buf, channels, W, H) => {
    const zoom = overrides[job.name]?.zoom ?? job.zoom ?? 1;
    const dx = overrides[job.name]?.dx ?? job.dx ?? 0, dy = overrides[job.name]?.dy ?? job.dy ?? 0;
    const base = Math.min(W / w, H / h) * zoom;
    const sw = Math.round(w * base), sh = Math.round(h * base);
    const pipeline = sharp(buf, { raw: { width: w, height: h, channels } });
    if (job.flip) pipeline.flop();
    const { data, info } = await pipeline
      .resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = Math.round((W - sw) / 2 + dx * W), py = Math.round((H - sh) / 2 + dy * H);
    const out = Buffer.alloc(W * H * 3);
    const n = info.channels;
    for (let y = 0; y < sh; y++) {
      const ty = y + py;
      if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < sw; x++) {
        const tx = x + px;
        if (tx < 0 || tx >= W) continue;
        const si = (y * sw + x) * n, di = (ty * W + tx) * 3;
        out[di] = data[si];
        out[di + 1] = n >= 3 ? data[si + 1] : data[si];
        out[di + 2] = n >= 3 ? data[si + 2] : data[si];
      }
    }
    return out;
  };

  const depthFull = await sharp(depth8, { raw: { width: dInfo.w, height: dInfo.h, channels: 1 } }).resize(w, h, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
  const color = await place(cut, 3, ATLAS_W, COLOR_H);
  const depthStrip = await place(depthFull, 1, ATLAS_W / 2, STRIP_H);
  const maskStrip = await place(mask, 1, ATLAS_W / 2, STRIP_H);

  const H_TOTAL = COLOR_H + STRIP_H;
  const atlasBuf = Buffer.alloc(ATLAS_W * H_TOTAL * 3);
  color.copy(atlasBuf, 0);
  for (let y = 0; y < STRIP_H; y++) {
    const row = (COLOR_H + y) * ATLAS_W * 3;
    depthStrip.copy(atlasBuf, row, y * (ATLAS_W / 2) * 3, (y + 1) * (ATLAS_W / 2) * 3);
    maskStrip.copy(atlasBuf, row + (ATLAS_W / 2) * 3, y * (ATLAS_W / 2) * 3, (y + 1) * (ATLAS_W / 2) * 3);
  }
  const file = path.join(OUT, `${job.out}.webp`);
  await sharp(atlasBuf, { raw: { width: ATLAS_W, height: H_TOTAL, channels: 3 } }).webp({ quality: 95, smartSubsample: true, effort: 5 }).toFile(file);
  console.log(job.name, '->', file, (fs.statSync(file).size / 1024).toFixed(0) + 'KB', 'depth', dLo, dHi);
}

for (const job of JOBS) {
  if (filter && !job.name.includes(filter)) continue;
  const input = path.join(SRC, `${job.name}.png`);
  if (!fs.existsSync(input)) { console.log('missing', input); continue; }
  const dir = path.join(WORK, job.name);
  if (!composeOnly) await analyze(job, input, dir);
  await compose(job, input, dir);
}
console.log('done');
process.exit(0);
