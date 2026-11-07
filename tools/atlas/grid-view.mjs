// Writes a preview of a source image with a labelled pixel grid, for placing retouch patches.
import sharp from 'sharp';
const [name, x0 = 0, y0 = 0, w = 1344, h = 768, outW = 900] = process.argv.slice(2);
const X = +x0, Y = +y0, W = +w, H = +h, OW = +outW, s = OW / W, OH = Math.round(H * s);
const crop = await sharp(`tools/atlas/src/${name}.png`).removeAlpha().extract({ left: X, top: Y, width: W, height: H }).resize(OW, OH).toBuffer();
let svg = `<svg width="${OW}" height="${OH}">`;
const step = W > 700 ? 100 : 50;
for (let gx = Math.ceil(X / step) * step; gx < X + W; gx += step) {
  const px = (gx - X) * s;
  svg += `<line x1="${px}" y1="0" x2="${px}" y2="${OH}" stroke="#ff0" stroke-opacity=".35"/><text x="${px + 2}" y="11" font-size="11" fill="#ff0" font-family="Arial">${gx}</text>`;
}
for (let gy = Math.ceil(Y / step) * step; gy < Y + H; gy += step) {
  const py = (gy - Y) * s;
  svg += `<line x1="0" y1="${py}" x2="${OW}" y2="${py}" stroke="#0ff" stroke-opacity=".35"/><text x="2" y="${py - 2}" font-size="11" fill="#0ff" font-family="Arial">${gy}</text>`;
}
svg += '</svg>';
await sharp(crop).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(`tools/atlas/grid_${name}.jpg`);
console.log('ok');
