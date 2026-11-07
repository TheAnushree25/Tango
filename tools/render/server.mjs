// Local render server for the procedural match: serves the render page plus three.js, and pipes
// raw frames from the browser's WebGL canvas into ffmpeg.
//   node tools/render/server.mjs 8790  ->  open http://localhost:8790/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { WebSocketServer } from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_VIDEO = path.join(ROOT, 'public', 'videos');
const OUT_TRACK = path.join(ROOT, 'public', 'tracking');
fs.mkdirSync(OUT_VIDEO, { recursive: true });
fs.mkdirSync(OUT_TRACK, { recursive: true });
const PORT = Number(process.argv[2] || 8790);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };

let ff = null, log = '', frames = 0;
const readBody = (req) => new Promise((res, rej) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => res(Buffer.concat(chunks)));
  req.on('error', rej);
});

function begin(q) {
  const w = q.get('w'), h = q.get('h'), fps = q.get('fps') || '30', crf = q.get('crf') || '21';
  const name = path.basename(q.get('name') || 'out.mp4');
  const args = [
    '-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', fps, '-i', 'pipe:0',
    '-vf', 'vflip,scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-profile:v', 'high',
    // A short keyframe interval and no B-frames keep scrubbing with the wheel responsive.
    '-x264-params', 'keyint=8:min-keyint=1:bframes=0:scenecut=0',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', path.join(OUT_VIDEO, name),
  ];
  log = '';
  frames = 0;
  ff = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  ff.stderr.on('data', (d) => { log = (log + d).slice(-3000); });
  console.log('encode begin', name, w, h, fps, 'crf', crf);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname), q = url.searchParams;
  const send = (code, body, type = 'text/plain') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  };
  try {
    if (req.method === 'POST' && p === '/track') {
      const b = await readBody(req);
      fs.writeFileSync(path.join(OUT_TRACK, path.basename(q.get('name'))), b);
      return send(200, 'saved');
    }
    if (req.method === 'POST' && p === '/still') {
      const b = await readBody(req);
      fs.writeFileSync(path.join(HERE, 'stills', path.basename(q.get('name'))), b);
      return send(200, 'saved');
    }
    if (req.method === 'POST' && p === '/ff/begin') {
      await readBody(req);
      if (ff) return send(409, 'encoder busy');
      begin(q);
      return send(200, 'ok');
    }
    if (req.method === 'POST' && p === '/ff/frame') {
      if (!ff) return send(409, 'no encoder');
      await new Promise((resolve) => {
        req.on('data', (c) => { if (!ff.stdin.write(c)) { req.pause(); ff.stdin.once('drain', () => req.resume()); } });
        req.on('end', resolve);
        req.on('error', resolve);
      });
      frames++;
      return send(200, String(frames));
    }
    if (req.method === 'POST' && p === '/ff/end') {
      await readBody(req);
      if (!ff) return send(409, 'no encoder');
      const proc = ff;
      ff = null;
      proc.stdin.end();
      const code = await new Promise((r) => proc.on('exit', r));
      console.log('encode end', frames, 'frames, exit', code);
      return send(code === 0 ? 200 : 500, `frames ${frames} exit ${code}\n${log.slice(-500)}`);
    }
    if (req.method === 'POST' && p === '/log') {
      console.log('[page]', (await readBody(req)).toString());
      return send(200, 'ok');
    }
    let file;
    if (p.startsWith('/three/')) file = path.join(ROOT, 'node_modules', 'three', p.slice('/three/'.length));
    else file = path.join(HERE, 'web', p === '/' ? 'index.html' : p.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(500, String(e));
  }
});

// Frames travel over one WebSocket: in the desktop app's browser pane every HTTP request costs about
// two seconds, which would cap the render at half a frame per second.
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 * 1024 });
wss.on('connection', (ws) => {
  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      if (!ff) return;
      if (ff.stdin.write(data)) ws.send('ack');
      else ff.stdin.once('drain', () => ws.send('ack'));
      frames++;
      return;
    }
    const msg = JSON.parse(data.toString());
    if (msg.type === 'begin') {
      if (ff) {
        ff.stdin.end();
        ff = null;
      }
      begin(new URLSearchParams(msg.params));
      ws.send('begun');
    } else if (msg.type === 'end') {
      const proc = ff;
      ff = null;
      proc.stdin.end();
      const code = await new Promise((r) => proc.on('exit', r));
      console.log('encode end', frames, 'frames, exit', code);
      ws.send(JSON.stringify({ done: true, code, frames }));
    } else if (msg.type === 'track') {
      fs.writeFileSync(path.join(OUT_TRACK, path.basename(msg.name)), msg.data);
    } else if (msg.type === 'log') {
      console.log('[page]', msg.text);
    }
  });
});

server.listen(PORT, 'localhost', () => console.log('render server on http://localhost:' + PORT));
