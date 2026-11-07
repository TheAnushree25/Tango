// Renders a play into the atlas layout: colour on top, depth and class map underneath.
// In the page console (or from a driver script):
//   await R.preview(0, 'tv', 180)                  draws one frame on screen
//   await R.renderClip(0, 'tv')                    encodes goal_0_tv.mp4 and its tracking JSON
//   await R.renderAll()                            everything in the job list
import * as THREE from 'three';
import { buildCameraPath, CAMS, FPS, Match, PLAYS } from './match.js';

const statusEl = document.getElementById('status');

/** One socket carries everything, with a small window of frames in flight for flow control. */
const socket = new WebSocket(`ws://${location.host}/ws`);
socket.binaryType = 'arraybuffer';
const socketOpen = new Promise((res) => socket.addEventListener('open', res, { once: true }));
let inFlight = 0;
let releaseSlot = null;
let onDone = null;
let onBegun = null;
socket.addEventListener('message', (e) => {
  const text = String(e.data);
  if (text === 'ack') {
    inFlight--;
    releaseSlot?.();
    releaseSlot = null;
  } else if (text === 'begun') {
    onBegun?.();
  } else {
    onDone?.(JSON.parse(text));
  }
});
const sendJson = (o) => socket.send(JSON.stringify(o));
const log = (m) => {
  statusEl.textContent = m;
  socketOpen.then(() => sendJson({ type: 'log', text: m }));
};

const SIZES = {
  tv: { w: 1920, h: 1620, color: 1080 },
  goal_cam: { w: 1280, h: 1080, color: 720 },
  follow: { w: 1280, h: 1080, color: 720 },
};

/** Grey levels of the class map. The ball is brightest so blurry edges can never read as ball. */
const CLASS = { ball: 1.0, star: 0.75, team: 0.5, other: 0.25 };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(1);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);

const depthUniforms = { uNear: { value: 2 }, uFar: { value: 100 } };
const depthMat = (side = THREE.FrontSide) =>
  new THREE.ShaderMaterial({
    uniforms: depthUniforms,
    side,
    vertexShader: `varying float vD; void main(){ vec4 v = modelViewMatrix * vec4(position,1.0); vD = -v.z; gl_Position = projectionMatrix * v; }`,
    // Disparity: for a flat pitch this is exactly linear in image rows, so the ground stays a plane.
    fragmentShader: `uniform float uNear; uniform float uFar; varying float vD;
      void main(){ float d = (1.0/max(vD,0.001) - 1.0/uFar) / (1.0/uNear - 1.0/uFar); d = clamp(d, 0.0, 1.0); gl_FragColor = vec4(d,d,d,1.0); }`,
  });
const flatMat = (v, side = THREE.FrontSide) =>
  new THREE.ShaderMaterial({
    side,
    vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(${v.toFixed(3)},${v.toFixed(3)},${v.toFixed(3)},1.0); }`,
  });
const MAT_DEPTH = depthMat(THREE.DoubleSide);
const MAT_DEPTH_LINE = depthMat();
const MAT_CLASS = Object.fromEntries(Object.entries(CLASS).map(([k, v]) => [k, flatMat(v, THREE.DoubleSide)]));

function collect(match) {
  match.classed.forEach((c) => {
    c.colorMat = c.object.material;
  });
}

function setPass(match, pass, cam) {
  match.classed.forEach((c) => {
    if (pass === 'color') c.object.material = c.colorMat;
    else if (pass === 'depth') c.object.material = c.object.isLineSegments ? MAT_DEPTH_LINE : MAT_DEPTH;
    else c.object.material = MAT_CLASS[c.cls];
  });
  // A distant ball is only a few pixels: swell it in the data passes so that it survives compression.
  const swell = pass === 'color' ? 1 : cam === 'tv' ? 1.5 : 1.12;
  match.ball.scale.setScalar(swell);
}

function drawAtlas(match, camType, f, path) {
  const size = SIZES[camType];
  match.setNetStyle(camType);
  match.setFrame(f);
  const { near, far } = CAMS[camType](match, path, f, camera);
  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  depthUniforms.uNear.value = near;
  depthUniforms.uFar.value = far;

  const strip = size.h - size.color;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.w, size.h);
  renderer.clear(true, true, false);
  renderer.setScissorTest(true);

  const pass = (name, x, y, w, h) => {
    setPass(match, name, camType);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.clear(false, true, false);
    renderer.render(match.scene, camera);
  };
  pass('color', 0, strip, size.w, size.color);
  pass('depth', 0, 0, size.w / 2, strip);
  pass('class', size.w / 2, 0, size.w / 2, strip);
  setPass(match, 'color', camType);
  return { near, far };
}

function project(pos, near, far) {
  const v = pos.clone().project(camera);
  const view = pos.clone().applyMatrix4(camera.matrixWorldInverse);
  const d = -view.z;
  const disp = (1 / Math.max(d, 0.001) - 1 / far) / (1 / near - 1 / far);
  return [(v.x + 1) / 2, (1 - v.y) / 2, Math.max(0, Math.min(1, disp))];
}

/** Where the look-at should go on this frame. The ball only counts while it is safely in shot. */
function trackFrame(m, camType, f, near, far, player, ball) {
  const t = +(f / FPS).toFixed(3);
  const sp = new THREE.Vector3(m.star.track[f * 4], 1.0, m.star.track[f * 4 + 1]);
  const p = project(sp, near, far).map((v) => +v.toFixed(4));
  if (p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.02 && p[1] < 0.98) player.push([t, ...p]);
  if (camType === 'tv') {
    const b = project(m.ball.position, near, far).map((v) => +v.toFixed(4));
    if (b[0] > 0.1 && b[0] < 0.9 && b[1] > 0.1 && b[1] < 0.9) ball.push([t, ...b]);
  }
}

const cache = new Map();
function getMatch(i) {
  if (!cache.has(i)) {
    for (const m of cache.values()) {
      m.scene.traverse((o) => {
        o.geometry?.dispose?.();
      });
    }
    cache.clear();
    const m = new Match(PLAYS[i]);
    collect(m);
    cache.set(i, m);
  }
  return cache.get(i);
}

const R = {
  async preview(i, camType, f) {
    const size = SIZES[camType];
    renderer.setSize(size.w, size.h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    const m = getMatch(i);
    const path = buildCameraPath(m, camType);
    drawAtlas(m, camType, Math.min(f, m.frames - 1), path);
    log(`preview goal ${i} ${camType} frame ${f}/${m.frames}`);
    return { frames: m.frames };
  },

  async renderClip(i, camType, { crf } = {}) {
    const size = SIZES[camType];
    renderer.setSize(size.w, size.h, false);
    const m = getMatch(i);
    const path = buildCameraPath(m, camType);
    const name = `goal_${i}_${camType === 'goal_cam' ? 'goal' : camType}`;
    await socketOpen;
    const params = { w: size.w, h: size.h, fps: FPS, name: `${name}.mp4`, crf: crf ?? (camType === 'tv' ? 22 : 21) };
    await new Promise((res) => {
      onBegun = res;
      sendJson({ type: 'begin', params });
    });
    const gl = renderer.getContext();
    const buf = new Uint8Array(size.w * size.h * 4);
    const rgb = new Uint8Array(size.w * size.h * 3);
    const player = [], ball = [];
    const t0 = performance.now();
    for (let f = 0; f < m.frames; f++) {
      const { near, far } = drawAtlas(m, camType, f, path);
      gl.readPixels(0, 0, size.w, size.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      for (let a = 0, b = 0; a < buf.length; a += 4, b += 3) {
        rgb[b] = buf[a];
        rgb[b + 1] = buf[a + 1];
        rgb[b + 2] = buf[a + 2];
      }
      while (inFlight >= 3) await new Promise((res) => (releaseSlot = res));
      inFlight++;
      socket.send(rgb.buffer.slice(0));
      trackFrame(m, camType, f, near, far, player, ball);
      if (f % 15 === 0) {
        const sec = (performance.now() - t0) / 1000;
        statusEl.textContent = `${name} ${f}/${m.frames}  ${(f / Math.max(sec, 0.01)).toFixed(1)} fps`;
      }
    }
    while (inFlight > 0) await new Promise((res) => (releaseSlot = res));
    const summary = await new Promise((res) => {
      onDone = res;
      sendJson({ type: 'end' });
    });
    sendJson({ type: 'track', name: `${name}.json`, data: JSON.stringify({ player, ball }) });
    log(`done ${name}: ${summary.frames} frames, exit ${summary.code}, in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    return summary;
  },

  /** Review sheet: several moments of a play, colour plate only, drawn into a 2D canvas on the page. */
  sheet(i, camType, times) {
    const size = SIZES[camType];
    renderer.setSize(size.w, size.h, false);
    const m = getMatch(i);
    const path = buildCameraPath(m, camType);
    const list = times || [1, 3, m.play.shotAt - 0.5, m.play.shotAt + 0.1, m.play.shotAt + m.play.flight + 0.1, m.play.shotAt + m.play.flight + 2, m.duration - 0.5];
    const W = 400, H = 225, cols = 3;
    let c = document.getElementById('sheet');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'sheet';
      c.style.cssText = 'position:fixed;inset:0;width:100%;z-index:5;background:#000';
      document.body.appendChild(c);
    }
    c.width = W * cols;
    c.height = H * Math.ceil(list.length / cols);
    const x = c.getContext('2d');
    x.fillStyle = '#ff0';
    x.font = '12px monospace';
    list.forEach((t, n) => {
      const f = Math.max(0, Math.min(m.frames - 1, Math.round(t * FPS)));
      drawAtlas(m, camType, f, path);
      const gl = renderer.getContext();
      gl.finish();
      x.drawImage(renderer.domElement, 0, 0, size.w, size.color, (n % cols) * W, Math.floor(n / cols) * H, W, H);
      x.fillText(`g${i} ${camType} t=${t.toFixed(2)}`, (n % cols) * W + 6, Math.floor(n / cols) * H + 14);
    });
    return 'sheet';
  },

  /** Rebuilds the tracking JSON of a clip without touching its video. */
  async trackOnly(i, camType) {
    await socketOpen;
    const m = getMatch(i);
    const path = buildCameraPath(m, camType);
    const name = `goal_${i}_${camType === 'goal_cam' ? 'goal' : camType}`;
    const player = [], ball = [];
    for (let f = 0; f < m.frames; f++) {
      m.setFrame(f);
      const { near, far } = CAMS[camType](m, path, f, camera);
      camera.aspect = 16 / 9;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      trackFrame(m, camType, f, near, far, player, ball);
    }
    sendJson({ type: 'track', name: `${name}.json`, data: JSON.stringify({ player, ball }) });
    return { name, player: player.length, ball: ball.length };
  },

  async trackAll() {
    const out = [];
    for (const [i, cam] of R.jobs()) out.push(await R.trackOnly(i, cam));
    return out;
  },

  jobs() {
    return [
      [0, 'tv'], [0, 'goal_cam'], [0, 'follow'],
      [1, 'tv'],
      [2, 'tv'], [2, 'goal_cam'],
      [3, 'tv'], [3, 'follow'],
      [4, 'tv'],
      [5, 'tv'],
      [6, 'tv'], [6, 'goal_cam'],
      [7, 'tv'], [7, 'goal_cam'], [7, 'follow'],
    ];
  },

  async renderAll(from = 0) {
    const list = R.jobs();
    for (let j = from; j < list.length; j++) {
      const [i, cam] = list[j];
      log(`job ${j + 1}/${list.length}: goal ${i} ${cam}`);
      await R.renderClip(i, cam);
    }
    log('ALL DONE');
    return 'all done';
  },
};
window.R = R;
log('ready');
