// The match: pitch, goal, ball, 22 players and a scripted play, simulated at 30 Hz.
// Coordinates: x along the pitch (we always attack the goal at +52.5), z across it, y up. Metres.
import * as THREE from 'three';
import { blendPose, celebratePose, divePose, Humanoid, idlePose, kickPose, runPose } from './humanoid.js';

export const FPS = 30;
const GOAL_X = 52.5;
const GOAL_W = 7.32;
const GOAL_H = 2.44;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Catmull-Rom through timed waypoints [t, x, z]. */
function samplePath(points, t) {
  if (t <= points[0][0]) return [points[0][1], points[0][2]];
  const last = points[points.length - 1];
  if (t >= last[0]) return [last[1], last[2]];
  let i = 0;
  while (i < points.length - 2 && points[i + 1][0] <= t) i++;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return [cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])];
}

/* ------------------------------------------------------------------ the eight plays */
/**
 * star: the scorer's route. shotAt: moment of the strike. target: where the ball crosses the goal
 * line [z, y]. feed: the pass that starts it [from player index, at time, arrives at time].
 * celebrate: where the scorer runs afterwards.
 */
export const PLAYS = [
  { id: 0, seed: 11, away: 'teal', duration: 11, shotAt: 6.4, flight: 0.55, target: [-2.9, 1.55], star: [[0, 7, 13], [2, 11, 14], [3, 15, 13.5], [4.4, 22, 10.5], [5.6, 28, 7], [6.4, 31.5, 5.2]], feedFrom: [8, 3], feedAt: 2.2, feedArrive: 3, celebrate: [40, 26] },
  { id: 1, seed: 23, away: 'teal', duration: 10, shotAt: 5.6, flight: 0.42, target: [2.7, 0.9], star: [[0, 24, -10], [2, 27, -11], [3.4, 31, -9], [4.6, 34.5, -5], [5.6, 36.5, -1.8]], feedFrom: [36, 18], feedAt: 4.4, feedArrive: 5.3, celebrate: [46, -27] },
  { id: 2, seed: 37, away: 'teal', duration: 11, shotAt: 6.2, flight: 0.85, target: [-3.05, 2.05], star: [[0, 4, -6], [2.2, 10, -7], [3.8, 16, -8], [5.2, 22, -8.5], [6.2, 25.5, -8]], feedFrom: [12, 8], feedAt: 2.8, feedArrive: 3.6, celebrate: [30, -29] },
  { id: 3, seed: 41, away: 'crimson', duration: 10, shotAt: 5.8, flight: 0.34, target: [2.6, 0.5], star: [[0, 18, 6], [1.8, 22, 4], [3.4, 30, 1.6], [4.8, 37, 0.6], [5.8, 41.5, 0.3]], feedFrom: [14, -6], feedAt: 2.4, feedArrive: 3.3, celebrate: [47, 27] },
  { id: 4, seed: 53, away: 'crimson', duration: 10, shotAt: 6.0, flight: 0.24, target: [0.8, 0.7], star: [[0, 28, -3], [2, 33, -4], [4, 39, -3], [5.2, 42.5, -1.6], [6.0, 44.8, -0.6]], feedFrom: [48, 20], feedAt: 5.0, feedArrive: 5.95, celebrate: [40, -28] },
  { id: 5, seed: 67, away: 'navy', duration: 11, shotAt: 5.2, flight: 0.9, target: [3.05, 2.1], star: [[0, 24.8, 8.2], [2.6, 25, 8.2], [3.5, 25.2, 8.1], [4.6, 27, 7.2], [5.2, 28.8, 6.2]], freeKick: true, celebrate: [36, 28] },
  { id: 6, seed: 79, away: 'violet', duration: 10, shotAt: 6.0, flight: 0.5, target: [-2.8, 0.8], star: [[0, 12, 15], [1.6, 17, 14], [3.2, 24, 11], [4.4, 29, 6.5], [5.2, 31.5, 3], [6.0, 33.5, 0.5]], feedFrom: [6, 6], feedAt: 1.4, feedArrive: 2.3, celebrate: [42, 28] },
  { id: 7, seed: 97, away: 'mono', duration: 12, shotAt: 7.2, flight: 0.95, target: [-2.7, 1.9], star: [[0, -4, 3], [1.6, 1, 5], [3.2, 7, 2], [4.4, 12, 6], [5.6, 17, 2.5], [7.2, 22.5, 3.5]], feedFrom: [-12, -6], feedAt: 0.6, feedArrive: 1.4, celebrate: [30, 28] },
];

/* ------------------------------------------------------------------ static scene */
function groundStrip(x0, z0, x1, z1, w = 0.2) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * (w / 2), nz = (dx / len) * (w / 2);
  return [x0 + nx, 0.02, z0 + nz, x0 - nx, 0.02, z0 - nz, x1 + nx, 0.02, z1 + nz, x1 - nx, 0.02, z1 - nz];
}

function pitchLines() {
  const verts = [], idx = [];
  const add = (q) => {
    const b = verts.length / 3;
    verts.push(...q);
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  };
  const line = (x0, z0, x1, z1, w) => add(groundStrip(x0, z0, x1, z1, w));
  const arc = (cx, cz, r, a0, a1, n = 64) => {
    for (let i = 0; i < n; i++) {
      const t0 = mix(a0, a1, i / n), t1 = mix(a0, a1, (i + 1) / n);
      line(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r);
    }
  };
  const L = 52.5, W = 34;
  line(-L, -W, L, -W);
  line(-L, W, L, W);
  line(-L, -W, -L, W);
  line(L, -W, L, W);
  line(0, -W, 0, W);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  arc(0, 0, 0.22, 0, Math.PI * 2, 10);
  for (const s of [1, -1]) {
    const gx = s * L;
    line(gx, -20.16, gx - s * 16.5, -20.16);
    line(gx, 20.16, gx - s * 16.5, 20.16);
    line(gx - s * 16.5, -20.16, gx - s * 16.5, 20.16);
    line(gx, -9.16, gx - s * 5.5, -9.16);
    line(gx, 9.16, gx - s * 5.5, 9.16);
    line(gx - s * 5.5, -9.16, gx - s * 5.5, 9.16);
    arc(gx - s * 11, 0, 0.2, 0, Math.PI * 2, 10);
    const a = Math.acos(5.5 / 9.15);
    if (s > 0) arc(gx - 11, 0, 9.15, -a, a, 40);
    else arc(gx + 11, 0, 9.15, Math.PI - a, Math.PI + a, 40);
    for (const c of [-1, 1]) arc(gx, c * W, 1, s > 0 ? (c > 0 ? -Math.PI / 2 : Math.PI / 2) : c > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI * (c > 0 ? -1 : 1) : 0, 12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f5f4ef';
  x.fillRect(0, 0, 512, 256);
  const colors = ['#1a1a1a', '#d2b55d', '#1a1a1a', '#2f6fbd'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = (col + (row % 2) * 0.5) * 64 + 32, cy = 42 + row * 86;
      x.fillStyle = colors[(col + row) % colors.length];
      x.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        x.lineTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19);
      }
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Match {
  constructor(play) {
    this.play = play;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.duration = play.duration;
    this.frames = Math.round(play.duration * FPS);
    this.rand = rng(play.seed);

    this.classed = []; // [{ object, cls }]
    this.buildStatic();
    this.buildLights();
    this.buildPlayers();
    this.buildBall();
    this.simulate();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2c4a2a, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-30, 60, 40);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.0);
    fill.position.set(40, 40, -30);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff2d8, 0.9);
    rim.position.set(0, 30, -60);
    this.scene.add(rim);
  }

  buildStatic() {
    const white = new THREE.MeshBasicMaterial({ color: 0xf2f4f6, side: THREE.DoubleSide });
    this.lines = new THREE.Mesh(pitchLines(), white);
    this.scene.add(this.lines);
    this.classed.push({ object: this.lines, cls: 'other' });

    // Goal frame.
    const frame = new THREE.Group();
    const post = new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.35 });
    const cyl = (len) => new THREE.CylinderGeometry(0.06, 0.06, len, 12);
    const mk = (geo, x, y, z, rz = 0, rx = 0) => {
      const m = new THREE.Mesh(geo, post);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      frame.add(m);
      this.classed.push({ object: m, cls: 'other' });
    };
    mk(cyl(GOAL_H), GOAL_X, GOAL_H / 2, -GOAL_W / 2);
    mk(cyl(GOAL_H), GOAL_X, GOAL_H / 2, GOAL_W / 2);
    mk(cyl(GOAL_W), GOAL_X, GOAL_H, 0, 0, Math.PI / 2);
    this.scene.add(frame);

    // Net as line segments, so it can bulge when the ball hits it.
    this.netDepth = 2.0;
    this.netU = 34;
    this.netV = 14;
    const n = (this.netU + 1) * (this.netV + 1);
    this.netBase = new Float32Array(n * 3);
    let k = 0;
    for (let j = 0; j <= this.netV; j++) {
      for (let i = 0; i <= this.netU; i++) {
        const u = i / this.netU, v = j / this.netV;
        const z = (u - 0.5) * GOAL_W;
        const y = v * GOAL_H;
        const x = GOAL_X + mix(this.netDepth, this.netDepth * 0.5, v);
        this.netBase[k++] = x;
        this.netBase[k++] = y;
        this.netBase[k++] = z;
      }
    }
    const lines = [];
    const at = (i, j) => j * (this.netU + 1) + i;
    for (let j = 0; j <= this.netV; j++) for (let i = 0; i < this.netU; i++) lines.push(at(i, j), at(i + 1, j));
    for (let j = 0; j < this.netV; j++) for (let i = 0; i <= this.netU; i++) lines.push(at(i, j), at(i, j + 1));
    this.netPos = new THREE.BufferAttribute(this.netBase.slice(), 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.netPos);
    geo.setIndex(lines);
    this.net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab0b6 }));
    this.net.frustumCulled = false;
    this.scene.add(this.net);
    this.classed.push({ object: this.net, cls: 'other' });

    // The same net as thin ribbons. From behind the goal one-pixel lines sample into stray dashes,
    // while ribbons with real width come out as an even dotted mesh.
    this.netSegs = lines;
    const ribbonCount = lines.length / 2;
    this.netRibbonPos = new THREE.BufferAttribute(new Float32Array(ribbonCount * 12), 3);
    const ribbonIdx = [];
    for (let i = 0; i < ribbonCount; i++) {
      const b = i * 4;
      ribbonIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const ribbonGeo = new THREE.BufferGeometry();
    ribbonGeo.setAttribute('position', this.netRibbonPos);
    ribbonGeo.setIndex(ribbonIdx);
    this.netRibbons = new THREE.Mesh(ribbonGeo, new THREE.MeshBasicMaterial({ color: 0xc4cad0, side: THREE.DoubleSide }));
    this.netRibbons.frustumCulled = false;
    this.netRibbons.visible = false;
    this.scene.add(this.netRibbons);
    this.classed.push({ object: this.netRibbons, cls: 'other' });

    // Sides and roof of the net.
    const sv = [];
    for (let c = 0; c <= 8; c++) {
      const t = c / 8;
      for (const s of [-1, 1]) {
        const z = (s * GOAL_W) / 2;
        sv.push(GOAL_X, t * GOAL_H, z, GOAL_X + mix(this.netDepth, this.netDepth * 0.5, t), t * GOAL_H, z);
        sv.push(GOAL_X + t * this.netDepth * 0.5, GOAL_H * 0, z, GOAL_X + t * this.netDepth * 0.5, GOAL_H, z);
      }
      sv.push(GOAL_X + t * this.netDepth * 0.5, GOAL_H, -GOAL_W / 2, GOAL_X + t * this.netDepth * 0.5, GOAL_H, GOAL_W / 2);
    }
    const side = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)), new THREE.LineBasicMaterial({ color: 0x8f959b }));
    this.netSide = side;
    this.scene.add(side);
    this.classed.push({ object: side, cls: 'other' });

    // Corner flags give the far distance something to read against.
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xd2b55d, roughness: 0.5 });
    for (const [x, z] of [[52.5, 34], [52.5, -34], [-52.5, 34], [-52.5, -34]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), flagMat);
      m.position.set(x, 0.8, z);
      this.scene.add(m);
      this.classed.push({ object: m, cls: 'other' });
    }
  }

  buildPlayers() {
    const { play } = this;
    const r = this.rand;
    this.players = [];
    const addPlayer = (opts) => {
      const h = new Humanoid(opts);
      this.scene.add(h.root);
      const p = { ...opts, human: h, x: 0, z: 0, vx: 0, vz: 0, heading: 0, phase: r() * 6.28, track: [], yaw: 0 };
      this.players.push(p);
      h.meshes.forEach((m) => this.classed.push({ object: m, cls: opts.isStar ? 'star' : 'team', ball: false }));
      return p;
    };

    this.star = addPlayer({ kit: 'home', number: 10, skin: 0, seed: 1, height: 1.76, isStar: true, role: 'star' });
    // Team mates: fan out around the attack and support it.
    const mates = [[-6, -24], [2, -10], [-2, 14], [8, 22], [14, 0], [20, -22], [26, 20], [32, -12], [-16, 2], [-24, -16]];
    mates.forEach(([ox, oz], i) => addPlayer({ kit: 'home', number: [4, 8, 5, 7, 6, 11, 9, 15, 3, 2][i], skin: 1 + i, seed: 2 + i, height: 1.74 + r() * 0.14, role: 'mate', ox, oz }));
    // Opponents: a back line and a midfield that drop toward their goal.
    const backs = [[34, -18], [36, -7], [36, 7], [34, 18], [24, -14], [26, -3], [24, 6], [22, 16], [12, -8], [12, 8]];
    backs.forEach(([ox, oz], i) => addPlayer({ kit: play.away, number: 2 + i, skin: 2 + i * 2, seed: 3 + i, height: 1.74 + r() * 0.14, role: 'opp', ox, oz }));
    this.keeper = addPlayer({ kit: 'keeper', number: 1, skin: 3, seed: 7, height: 1.92, role: 'keeper' });

    if (play.freeKick) {
      // A defensive wall and a keeper on his line.
      const wall = this.players.filter((p) => p.role === 'opp').slice(0, 4);
      wall.forEach((p, i) => {
        p.role = 'wall';
        p.wallIndex = i;
      });
    }
  }

  buildBall() {
    const mat = new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), mat);
    this.scene.add(this.ball);
    this.classed.push({ object: this.ball, cls: 'ball' });
  }

  /* ---------------------------------------------------------------- the 30 Hz simulation */
  starPosAt(t) {
    return samplePath(this.play.star, t);
  }

  simulate() {
    const { play, players, star, keeper } = this;
    const dt = 1 / FPS;
    const N = this.frames;
    const r = rng(play.seed * 7);

    // -- ball route, keyed by frame
    const ballX = new Float32Array(N), ballY = new Float32Array(N), ballZ = new Float32Array(N);
    const shot = play.shotAt, arrive = shot + play.flight;
    const [tz, ty] = play.target;
    const hasFeed = !!play.feedFrom;
    const feedAt = play.feedAt ?? 0, feedArrive = play.feedArrive ?? 0;
    const [sx0, sz0] = this.starPosAt(shot);
    for (let f = 0; f < N; f++) {
      const t = f * dt;
      let x, y, z;
      if (t >= arrive) {
        // Inside the net: it slows on the netting, then drops and rolls.
        const a = t - arrive;
        const stop = Math.min(a, 0.22);
        x = GOAL_X + 0.1 + (1 - Math.exp(-stop * 12)) * 1.45;
        z = tz + (tz > 0 ? 1 : -1) * Math.min(a * 0.25, 0.4);
        const dropT = Math.max(0, a - 0.12);
        const bounce = Math.abs(Math.cos(dropT * 5.5)) * Math.exp(-dropT * 2.4);
        y = 0.115 + (ty - 0.115) * bounce;
      } else if (t >= shot) {
        const u = (t - shot) / play.flight;
        x = mix(sx0 + 0.3, GOAL_X + 0.1, u);
        // Curl: the ball bends toward the target during its flight.
        const curl = Math.sin(u * Math.PI) * (play.flight > 0.7 ? 2.4 : 0.6) * (tz > sz0 ? -1 : 1);
        z = mix(sz0, tz, u * u * 0.45 + u * 0.55) + curl;
        const peak = Math.max(0, (play.flight - 0.25) * 2.2);
        y = mix(0.115, ty, u) + Math.sin(u * Math.PI) * peak;
      } else if (play.freeKick && t < shot) {
        x = sx0 + 0.3;
        z = sz0;
        y = 0.115;
      } else if (hasFeed && t < feedArrive) {
        const [fx, fz] = play.feedFrom;
        const [rx, rz] = this.starPosAt(feedArrive);
        const carry = smooth((t - feedAt) / Math.max(0.01, feedArrive - feedAt));
        if (t < feedAt) {
          x = fx + Math.sin(t * 2) * 0.3 + t * 1.2;
          z = fz + Math.cos(t * 1.7) * 0.3;
          y = 0.115 + Math.abs(Math.sin(t * 5)) * 0.04;
        } else {
          const startX = fx + feedAt * 1.2 + Math.sin(feedAt * 2) * 0.3, startZ = fz + Math.cos(feedAt * 1.7) * 0.3;
          x = mix(startX, rx, carry);
          z = mix(startZ, rz, carry);
          y = 0.115 + Math.sin(carry * Math.PI) * 0.35;
        }
      } else {
        // Dribbling: a small touch ahead of the star each stride.
        const [px, pz] = this.starPosAt(t);
        const [qx, qz] = this.starPosAt(t + 0.1);
        const dx = qx - px, dz = qz - pz, len = Math.hypot(dx, dz) || 1;
        const touch = 0.55 + Math.abs(Math.sin(t * 5.2)) * 0.6;
        x = px + (dx / len) * touch;
        z = pz + (dz / len) * touch + Math.sin(t * 2.6) * 0.12;
        y = 0.115 + Math.abs(Math.sin(t * 5.2)) * 0.03;
      }
      ballX[f] = x;
      ballY[f] = y;
      ballZ[f] = z;
    }
    this.ballTrack = { x: ballX, y: ballY, z: ballZ };

    // -- star route: path, then a shot, then the celebration run
    const celebrateFrom = arrive + 0.25;
    const [cx, cz] = play.celebrate;
    const after = [[celebrateFrom, ...this.starPosAt(shot + 0.05)]];
    for (let i = 1; i <= 6; i++) {
      const u = i / 6;
      const [ax, az] = after[0].slice(1);
      after.push([celebrateFrom + u * (play.duration - celebrateFrom + 0.2), mix(ax, cx, smooth(u) * 0.55 + u * 0.45), mix(az, cz, u)]);
    }
    const starPath = [...play.star, [shot + 0.25, sx0 + 0.9, sz0 + 0.1], ...after.slice(1)];

    // -- everyone's positions, per frame
    const kickoff = (p) => {
      p.track = new Float32Array(N * 4); // x, z, speed, facing
    };
    players.forEach(kickoff);

    const sim = players.map((p) => ({ x: 0, z: 0, vx: 0, vz: 0 }));
    players.forEach((p, i) => {
      const s = sim[i];
      if (p.role === 'mate' || p.role === 'opp') {
        const [sx, sz] = this.starPosAt(0);
        s.x = clamp(p.ox + sx * 0.25, -50, 50);
        s.z = clamp(p.oz, -32, 32);
      }
      if (p.role === 'wall') {
        s.x = sx0 + 9.15 * 0.93;
        s.z = sz0 * 0.72 + (p.wallIndex - 1.5) * 0.6;
      }
      if (p.role === 'keeper') {
        s.x = GOAL_X - 1.0;
        s.z = 0;
      }
    });

    // The two players closest to the star press him, which reads as a real attack.
    for (let f = 0; f < N; f++) {
      const t = f * dt;
      const [bx, bz] = [ballX[f], ballZ[f]];
      const goalDone = t > arrive + 0.2;
      const [spx, spz] = samplePath(starPath, t);
      const nearOpp = players
        .map((p, i) => ({ i, d: p.role === 'opp' ? Math.hypot(sim[i].x - spx, sim[i].z - spz) : 1e9 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .map((o) => o.i);

      players.forEach((p, i) => {
        const s = sim[i];
        if (p.isStar) {
          const [ax, az] = samplePath(starPath, t + dt);
          s.vx = (ax - spx) / dt;
          s.vz = (az - spz) / dt;
          s.x = spx;
          s.z = spz;
        } else {
          let tx = s.x, tz2 = s.z, top = 5;
          if (p.role === 'mate') {
            tx = clamp(bx + p.ox * 0.55, -48, 49);
            tz2 = clamp(bz * 0.25 + p.oz, -31, 31);
            top = 7;
            if (goalDone) {
              tx = spx - 1.5 - (i % 3);
              tz2 = spz + ((i % 5) - 2) * 1.3;
              top = 8.2;
            }
          } else if (p.role === 'opp') {
            tx = clamp(bx * 0.72 + p.ox * 0.72 + 6, -48, 47);
            tz2 = clamp(bz * 0.4 + p.oz * 0.9, -30, 30);
            top = 6.6;
            if (!goalDone && nearOpp.includes(i)) {
              tx = bx + 1.2;
              tz2 = bz + (i % 2 ? 1 : -1) * 1.1;
              top = 7.8;
            }
            if (goalDone) {
              tx = s.x + 0.2;
              tz2 = s.z;
              top = 1.2;
            }
          } else if (p.role === 'wall') {
            tx = s.x;
            tz2 = s.z;
            top = 0.4;
          } else if (p.role === 'keeper') {
            tx = GOAL_X - 1.2;
            tz2 = clamp(bz * 0.25, -2.6, 2.6);
            top = 3.5;
          }
          const dx = tx - s.x, dz = tz2 - s.z, d = Math.hypot(dx, dz);
          const want = d > 0.25 ? Math.min(top, d * 1.6) : 0;
          const ax = d > 0.01 ? (dx / d) * want : 0, az = d > 0.01 ? (dz / d) * want : 0;
          const k = 1 - Math.exp(-dt * 3.2);
          s.vx += (ax - s.vx) * k;
          s.vz += (az - s.vz) * k;
          s.x += s.vx * dt;
          s.z += s.vz * dt;
        }
        // Soft separation so that nobody stands inside anybody.
        players.forEach((q, j) => {
          if (j >= i) return;
          const o = sim[j];
          const ddx = s.x - o.x, ddz = s.z - o.z, dd = Math.hypot(ddx, ddz);
          if (dd > 0.01 && dd < 1.0 && !p.isStar && p.role !== 'wall') {
            s.x += (ddx / dd) * (1.0 - dd) * 0.12;
            s.z += (ddz / dd) * (1.0 - dd) * 0.12;
          }
        });
        const speed = Math.hypot(s.vx, s.vz);
        // Runners face their direction of travel; everyone else watches the ball.
        const face = speed > 1.4 ? Math.atan2(s.vx, s.vz) : Math.atan2(bx - s.x, bz - s.z);
        p.track[f * 4] = s.x;
        p.track[f * 4 + 1] = s.z;
        p.track[f * 4 + 2] = speed;
        p.track[f * 4 + 3] = face;
      });
    }
    // Smooth the facing over time, handling the wrap around 2 pi.
    players.forEach((p) => {
      let yaw = p.track[3];
      for (let f = 0; f < N; f++) {
        const target = p.track[f * 4 + 3];
        let d = target - yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        yaw += d * (1 - Math.exp(-dt * 8));
        p.track[f * 4 + 3] = yaw;
      }
      // Stride phase is accumulated from the distance actually covered, so the feet match the ground.
      p.phases = new Float32Array(N);
      let ph = r() * 6.28;
      for (let f = 0; f < N; f++) {
        const sp = p.track[f * 4 + 2];
        ph += (sp / Math.max(1.5, 1.05 + sp * 0.22)) * dt * Math.PI * 2 * 0.5;
        p.phases[f] = ph;
      }
    });
    void star;
    void keeper;
  }

  /* ---------------------------------------------------------------- posing a frame */
  setFrame(f) {
    const { play, players } = this;
    const dt = 1 / FPS;
    const t = f * dt;
    const shot = play.shotAt, arrive = shot + play.flight;

    players.forEach((p, i) => {
      const x = p.track[f * 4], z = p.track[f * 4 + 1], sp = p.track[f * 4 + 2], yaw = p.track[f * 4 + 3];
      const h = p.human;
      h.root.position.set(x, 0, z);
      h.root.rotation.set(0, yaw, 0);

      const speedNorm = clamp((sp - 2) / 6, 0, 1);
      const run = runPose(p.phases[f], speedNorm);
      const idle = idlePose(t, i);
      let pose = blendPose(idle, run, smooth((sp - 0.5) / 1.6));

      if (p.isStar) {
        // The strike, timed so the foot meets the ball at shotAt.
        const kickStart = shot - 0.34, kickEnd = shot + 0.42;
        if (t > kickStart - 0.1 && t < kickEnd + 0.25) {
          const prog = clamp((t - kickStart) / (kickEnd - kickStart), 0, 1);
          const w = smooth((t - (kickStart - 0.1)) / 0.1) * (1 - smooth((t - kickEnd) / 0.25));
          pose = blendPose(pose, kickPose(prog), w);
        }
        if (t > arrive + 0.15) {
          const w = smooth((t - arrive - 0.15) / 0.45);
          pose = blendPose(pose, celebratePose(p.phases[f], speedNorm * 0.7, t, 1), w);
        }
      } else if (p.role === 'mate' && t > arrive + 0.5) {
        const w = smooth((t - arrive - 0.5) / 0.6);
        pose = blendPose(pose, celebratePose(p.phases[f], speedNorm * 0.7, t, i), w * (i % 2 ? 1 : 0.6));
      } else if (p.role === 'opp' && t > arrive + 0.7) {
        // Hands on hips, head down.
        const w = smooth((t - arrive - 0.7) / 0.8);
        pose = blendPose(pose, { ...idle, spinePitch: 0.24, neckPitch: 0.35, armAbL: 0.5, armAbR: 0.5, elbowL: 1.9, elbowR: 1.9, armL: -0.3, armR: -0.3 }, w);
      } else if (p.role === 'wall') {
        const w = smooth((t - (shot - 0.6)) / 0.3) * (1 - smooth((t - arrive - 0.6) / 0.4));
        const jump = Math.max(0, Math.sin(clamp((t - shot + 0.05) / 0.6, 0, 1) * Math.PI)) * 0.42;
        h.root.position.y = jump;
        pose = blendPose(pose, { ...idle, armL: 0.5, armR: 0.5, armAbL: -0.15, armAbR: -0.15, elbowL: 1.2, elbowR: 1.2, kneeL: jump > 0 ? 0.5 : 0.24, kneeR: jump > 0 ? 0.5 : 0.24 }, w);
      } else if (p.role === 'keeper') {
        const start = shot + 0.05, end = shot + Math.max(0.65, play.flight + 0.35);
        const dir = play.target[0] > 0 ? 1 : -1;
        if (t > start) {
          const prog = clamp((t - start) / (end - start), 0, 1);
          const dive = divePose(prog, dir);
          const w = smooth((t - start) / 0.12);
          pose = blendPose(pose, dive, w);
          // The whole body flies sideways and rotates toward horizontal, then lands.
          const lift = Math.sin(prog * Math.PI);
          const reach = Math.min(Math.abs(play.target[0]) - 0.3, 2.6) * smooth(prog / 0.7);
          h.root.position.z = z + dir * reach * Math.cos(yaw);
          h.root.position.x = x + dir * reach * Math.sin(yaw);
          h.root.position.y = lift * 0.55;
          h.root.rotation.z = (dir * Math.cos(yaw) > 0 ? -1 : 1) * 1.25 * smooth(prog / 0.55) * w;
        }
      }
      h.apply(pose);
    });

    // Ball: spins with its travel, and the net bulges where it lands.
    const bt = this.ballTrack;
    this.ball.position.set(bt.x[f], bt.y[f], bt.z[f]);
    const fp = Math.max(0, f - 1);
    const dx = bt.x[f] - bt.x[fp], dz = bt.z[f] - bt.z[fp];
    this.ball.rotation.z = -bt.x[f] / 0.115;
    this.ball.rotation.x = bt.z[f] / 0.115;
    void dx;
    void dz;

    const hit = t - arrive;
    const pos = this.netPos.array;
    const n = this.netBase.length / 3;
    for (let i = 0; i < n; i++) {
      const bx = this.netBase[i * 3], by = this.netBase[i * 3 + 1], bz = this.netBase[i * 3 + 2];
      let bulge = 0;
      if (hit > 0) {
        const d = Math.hypot(by - play.target[1], bz - play.target[0]);
        const wave = Math.exp(-d * d * 0.9) * Math.exp(-hit * 1.6) * Math.min(hit * 9, 1);
        bulge = wave * 0.85 * (1 + Math.sin(hit * 16) * 0.14);
      }
      pos[i * 3] = bx + bulge;
      pos[i * 3 + 1] = by;
      pos[i * 3 + 2] = bz;
    }
    this.netPos.needsUpdate = true;

    if (this.netRibbons.visible) {
      const out = this.netRibbonPos.array;
      const w = 0.006;
      for (let i = 0; i < this.netSegs.length; i += 2) {
        const a = this.netSegs[i] * 3, b = this.netSegs[i + 1] * 3;
        const dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const len = Math.hypot(dy, dz) || 1;
        const ny = (-dz / len) * w, nz = (dy / len) * w;
        const o = i * 6;
        out[o] = pos[a]; out[o + 1] = pos[a + 1] + ny; out[o + 2] = pos[a + 2] + nz;
        out[o + 3] = pos[a]; out[o + 4] = pos[a + 1] - ny; out[o + 5] = pos[a + 2] - nz;
        out[o + 6] = pos[b]; out[o + 7] = pos[b + 1] + ny; out[o + 8] = pos[b + 2] + nz;
        out[o + 9] = pos[b]; out[o + 10] = pos[b + 1] - ny; out[o + 11] = pos[b + 2] - nz;
      }
      this.netRibbonPos.needsUpdate = true;
    }
  }

  /** Goal cam looks straight through the net, so it gets the ribbons. Everything else keeps the lines. */
  setNetStyle(camType) {
    const ribbons = camType === 'goal_cam';
    this.netRibbons.visible = ribbons;
    this.net.visible = !ribbons;
    this.netSide.visible = !ribbons;
  }
}

/* ------------------------------------------------------------------ the cameras */
export function focusPoint(match, f) {
  const bt = match.ballTrack;
  const s = match.star;
  const fx = bt.x[f] * 0.6 + s.track[f * 4] * 0.4;
  const fz = bt.z[f] * 0.6 + s.track[f * 4 + 1] * 0.4;
  return [fx, fz];
}

/** Precomputes a smooth camera path for the whole clip, so it can look ahead like a real operator. */
export function buildCameraPath(match, type) {
  const N = match.frames;
  const raw = [];
  for (let f = 0; f < N; f++) raw.push(focusPoint(match, f));
  const smoothed = raw.map((_, f) => {
    let sx = 0, sz = 0, sw = 0;
    const span = type === 'follow' ? 14 : 34;
    for (let k = -span; k <= span; k++) {
      const q = raw[Math.max(0, Math.min(N - 1, f + k))];
      const w = Math.exp(-(k * k) / (2 * (span / 2.4) ** 2));
      sx += q[0] * w;
      sz += q[1] * w;
      sw += w;
    }
    return [sx / sw, sz / sw];
  });
  return smoothed;
}

export const CAMS = {
  /** High on the far stand, long lens, tracks along the touchline. */
  tv(match, path, f, camera) {
    const [fx, fz] = path[f];
    const cx = clamp(fx, -44, 44);
    camera.fov = 13.5;
    camera.position.set(cx - 2, 17.5, 62);
    camera.lookAt(fx, 0.8, fz * 0.8 + 1);
    return { near: 26, far: 110 };
  },
  /** Low behind the goal, looking back up the pitch through the net. */
  goal_cam(match, path, f, camera) {
    const [fx, fz] = path[f];
    camera.fov = 24;
    camera.position.set(GOAL_X + 5.6, 2.2, fz * 0.12);
    camera.lookAt(fx - 2, 1.0, fz * 0.6);
    return { near: 3, far: 80 };
  },
  /** Close on the scorer, a touch low, dollying with him on his open side. */
  follow(match, path, f, camera) {
    const s = match.star;
    const N = match.frames;
    let sx = 0, sz = 0, sy = 0, w = 0;
    for (let k = -8; k <= 8; k++) {
      const q = Math.max(0, Math.min(N - 1, f + k));
      const g = Math.exp(-(k * k) / 30);
      sx += s.track[q * 4] * g;
      sz += s.track[q * 4 + 1] * g;
      sy += s.track[q * 4 + 3] * g;
      w += g;
    }
    sx /= w;
    sz /= w;
    const yaw = sy / w;
    const orbit = yaw + 1.05;
    const dist = 4.9;
    camera.fov = 30;
    camera.position.set(sx + Math.sin(orbit) * dist, 1.1, sz + Math.cos(orbit) * dist);
    camera.lookAt(sx + Math.sin(yaw) * 0.5, 0.92, sz + Math.cos(yaw) * 0.5);
    return { near: 1.5, far: 60 };
  },
};
