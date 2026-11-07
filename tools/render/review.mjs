// Builds a contact sheet from rendered clips, one row per clip, for quick visual review.
// usage: node tools/render/review.mjs out.jpg clipA:1,3,5 clipB:2,4
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
const [out, ...specs] = process.argv.slice(2);
const W = 420;
const comps = [];
let row = 0, maxCols = 0;
const tmp = 'tools/render/_review.jpg';
for (const spec of specs) {
  const [name, times] = spec.split(':');
  const list = times.split(',').map(Number);
  maxCols = Math.max(maxCols, list.length);
  for (let i = 0; i < list.length; i++) {
    spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(list[i]), '-i', `public/videos/${name}.mp4`, '-frames:v', '1', tmp]);
    const raw = fs.readFileSync(tmp); // read through a buffer: sharp caches by file name
    const meta = await sharp(raw).metadata();
    const colorH = Math.round(meta.height * (2 / 3));
    const buf = await sharp(raw).extract({ left: 0, top: 0, width: meta.width, height: colorH }).resize(W, Math.round((W * 9) / 16)).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="20"><text x="4" y="14" font-size="12" fill="#ff0" font-family="Arial">${name} t=${list[i]}</text></svg>`);
    comps.push({ input: buf, left: i * W, top: row * 236 }, { input: label, left: i * W, top: row * 236 });
  }
  row++;
}
await sharp({ create: { width: W * maxCols, height: 236 * row, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
fs.unlinkSync(tmp);
console.log('ok', out);
