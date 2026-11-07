// Builds a labelled contact sheet of the generated images for visual review.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || 'tools/atlas/src';
const out = process.argv[3] || 'tools/atlas/contact.jpg';
const files = fs.readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f) && !f.includes('test')).sort();
const W = 400, H = 229, cols = 3, rows = Math.ceil(files.length / cols);
const comps = [];
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(path.join(dir, files[i])).resize(W, H, { fit: 'contain', background: '#222' }).toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="${H}"><text x="6" y="18" font-size="15" fill="#ff0" font-family="Arial">${files[i]}</text></svg>`);
  const left = (i % cols) * W, top = Math.floor(i / cols) * H;
  comps.push({ input: buf, left, top }, { input: label, left, top });
}
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
console.log(files.length, 'images ->', out);
