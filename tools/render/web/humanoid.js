// A procedural footballer: lofted body parts on a simple skeleton. No external models.
// All lengths are metres. The character stands on y = 0 and faces +Z.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Lofts elliptical rings along local Y. rings: [y, rx, rz, (cx), (cz)] */
function loft(rings, radial = 18, capTop = true, capBottom = true) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const [y, rx, rz, cx = 0, cz = 0] = rings[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      pos.push(cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz);
      uv.push(j / radial, i / (n - 1));
    }
  }
  const row = radial + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (ring, flip) => {
    const center = pos.length / 3;
    const [y, , , cx = 0, cz = 0] = rings[ring];
    pos.push(cx, y, cz);
    uv.push(0.5, ring / (n - 1));
    for (let j = 0; j < radial; j++) {
      const a = ring * row + j, b = a + 1;
      if (flip) idx.push(center, b, a);
      else idx.push(center, a, b);
    }
  };
  if (capTop) cap(0, false);
  if (capBottom) cap(n - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ellipsoid(rx, ry, rz, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, seg - 4));
  g.scale(rx, ry, rz);
  return g;
}

/** Hair: a sphere cap with lumpy curls pushed out of it. */
function hairGeometry(seed) {
  const g = new THREE.SphereGeometry(1, 28, 20, 0, TAU, 0, Math.PI * 0.54);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 11 + seed) * Math.sin(y * 13 + seed * 2) * Math.sin(z * 12 + seed * 3);
    const r = 1 + n * 0.09;
    p.setXYZ(i, x * r * 0.104, y * r * 0.122 + 0.012, z * r * 0.116 - 0.008);
  }
  g.computeVertexNormals();
  return g;
}

/** Stripes, number and subtle cloth creases, drawn onto a canvas and wrapped around the torso. */
function shirtTexture(kit, number) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = kit.shirt;
  x.fillRect(0, 0, 512, 512);
  if (kit.stripe) {
    x.fillStyle = kit.stripe;
    const count = 10;
    for (let i = 0; i < count; i += 2) x.fillRect((i / count) * 512 + 12, 0, 512 / count - 2, 512);
  }
  if (kit.sash) {
    x.strokeStyle = kit.sash;
    x.lineWidth = 60;
    x.beginPath();
    x.moveTo(-40, 470);
    x.lineTo(300, 30);
    x.stroke();
  }
  // Creases: long soft darker strokes.
  x.globalAlpha = 0.09;
  x.strokeStyle = '#000';
  x.lineWidth = 12;
  let seed = number * 37 + 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 22; i++) {
    const px = rnd() * 512, py = rnd() * 512;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + (rnd() - 0.5) * 120, py + 60, px + (rnd() - 0.5) * 160, py + 130);
    x.stroke();
  }
  x.globalAlpha = 1;
  // Number on the back (u = 0.5 faces -Z) and small on the chest.
  x.fillStyle = kit.number;
  x.font = '900 150px Arial';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.save();
  x.translate(256, 268);
  x.scale(-1, -1);
  x.fillText(String(number), 0, 0);
  x.restore();
  x.font = '900 46px Arial';
  x.save();
  x.translate(40, 320);
  x.scale(-1, -1);
  x.fillText(String(number), 0, 0);
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const part = (mat, seg) => {
  const m = new THREE.Mesh(seg, mat);
  m.userData.classify = true;
  return m;
};

export const KITS = {
  home: { shirt: '#f3f5f8', stripe: '#6fb2ea', shorts: '#f1f3f6', socks: '#f1f3f6', boots: '#e8e2d2', number: '#1a2a55', sleeveTrim: '#6fb2ea' },
  homeDark: { shirt: '#10203f', stripe: null, sash: '#1f3f88', shorts: '#0d1a33', socks: '#10203f', boots: '#e8e2d2', number: '#d2b55d', sleeveTrim: '#2a56b8' },
  teal: { shirt: '#0f7f7a', stripe: null, sash: '#ee8a2c', shorts: '#0a4f4c', socks: '#0f7f7a', boots: '#111', number: '#fff', sleeveTrim: '#ee8a2c' },
  crimson: { shirt: '#b0223c', stripe: null, shorts: '#f1f3f6', socks: '#b0223c', boots: '#111', number: '#fff', sleeveTrim: '#f1f3f6' },
  navy: { shirt: '#172f70', stripe: '#a8d42e', shorts: '#172f70', socks: '#a8d42e', boots: '#fff', number: '#fff', sleeveTrim: '#a8d42e' },
  violet: { shirt: '#5a2aa3', stripe: null, shorts: '#e8bc3d', socks: '#5a2aa3', boots: '#111', number: '#e8bc3d', sleeveTrim: '#e8bc3d' },
  mono: { shirt: '#22262e', stripe: '#d9dde3', shorts: '#14171c', socks: '#22262e', boots: '#fff', number: '#fff', sleeveTrim: '#d9dde3' },
  keeper: { shirt: '#c8e02c', stripe: null, shorts: '#23272e', socks: '#c8e02c', boots: '#111', number: '#111', sleeveTrim: '#23272e' },
};

const SKINS = ['#c98d67', '#8d5a3c', '#e0ac87', '#a8714c', '#6d4430', '#d49b75'];

export class Humanoid {
  constructor({ kit, number, skin = 0, seed = 1, height = 1.8, isStar = false }) {
    this.root = new THREE.Group();
    this.isStar = isStar;
    this.scale = height / 1.8;
    this.root.scale.setScalar(this.scale);

    const k = KITS[kit];
    const mat = (color, rough = 0.78) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    const shirtMap = shirtTexture(k, number);
    const shirt = new THREE.MeshStandardMaterial({ map: shirtMap, roughness: 0.72 });
    const sleeve = mat(k.shirt);
    const trim = mat(k.sleeveTrim);
    const shorts = mat(k.shorts);
    const socks = mat(k.socks);
    const boots = mat(k.boots, 0.45);
    const skinMat = mat(SKINS[skin % SKINS.length], 0.6);
    const hair = mat(['#120e0c', '#1c120c', '#2b1a10', '#0d0d10'][seed % 4], 0.9);
    const dark = mat('#1a0f0c', 0.7);

    const joint = (parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    // -- skeleton
    this.pelvis = joint(this.root, 0, 0.98, 0);
    this.spine = joint(this.pelvis, 0, 0.06, 0);
    this.chest = joint(this.spine, 0, 0.27, 0);
    this.neck = joint(this.chest, 0, 0.245, 0.005);
    this.head = joint(this.neck, 0, 0.1, 0.012);
    this.shoulderL = joint(this.chest, 0.19, 0.19, 0);
    this.shoulderR = joint(this.chest, -0.19, 0.19, 0);
    this.elbowL = joint(this.shoulderL, 0, -0.31, 0);
    this.elbowR = joint(this.shoulderR, 0, -0.31, 0);
    this.wristL = joint(this.elbowL, 0, -0.27, 0);
    this.wristR = joint(this.elbowR, 0, -0.27, 0);
    this.hipL = joint(this.pelvis, 0.095, -0.03, 0);
    this.hipR = joint(this.pelvis, -0.095, -0.03, 0);
    this.kneeL = joint(this.hipL, 0, -0.46, 0);
    this.kneeR = joint(this.hipR, 0, -0.46, 0);
    this.ankleL = joint(this.kneeL, 0, -0.43, 0);
    this.ankleR = joint(this.kneeR, 0, -0.43, 0);

    // -- torso: the rings are written bottom-up, relative to the spine joint
    const torso = loft(
      [
        [-0.11, 0.156, 0.116], [-0.02, 0.15, 0.108], [0.08, 0.141, 0.1], [0.18, 0.148, 0.103], [0.28, 0.166, 0.112, 0, 0.004],
        [0.38, 0.186, 0.122, 0, 0.012], [0.45, 0.196, 0.118, 0, 0.008], [0.5, 0.18, 0.1, 0, 0], [0.54, 0.11, 0.08, 0, 0], [0.56, 0.062, 0.06, 0, 0.004],
      ],
      28,
    );
    this.spine.add(part(shirt, torso));

    const shortsBody = loft([[-0.2, 0.16, 0.122], [-0.12, 0.163, 0.122], [-0.05, 0.156, 0.116], [-0.02, 0.15, 0.112]], 22);
    this.pelvis.add(part(shorts, shortsBody));
    // Waistband.
    const band = part(trim, loft([[0.015, 0.155, 0.116], [0.04, 0.152, 0.112]], 22, false, false));
    this.pelvis.add(band);

    // -- neck and head
    this.neck.add(part(skinMat, loft([[-0.03, 0.056, 0.058], [0.05, 0.05, 0.052], [0.11, 0.05, 0.052]], 14)));
    const skull = part(skinMat, ellipsoid(0.092, 0.114, 0.103, 22));
    skull.position.y = 0.075;
    this.head.add(skull);
    const jaw = part(skinMat, ellipsoid(0.073, 0.06, 0.08, 16));
    jaw.position.set(0, 0.02, 0.018);
    this.head.add(jaw);
    const hairMesh = part(hair, hairGeometry(seed));
    hairMesh.position.y = 0.075;
    hairMesh.rotation.x = -0.4;
    this.head.add(hairMesh);
    const nose = part(skinMat, ellipsoid(0.014, 0.024, 0.02, 8));
    nose.position.set(0, 0.058, 0.103);
    this.head.add(nose);
    for (const s of [-1, 1]) {
      const ear = part(skinMat, ellipsoid(0.011, 0.024, 0.016, 8));
      ear.position.set(s * 0.092, 0.065, -0.005);
      this.head.add(ear);
      const eye = part(dark, ellipsoid(0.011, 0.006, 0.004, 8));
      eye.position.set(s * 0.035, 0.083, 0.097);
      this.head.add(eye);
      const brow = part(hair, ellipsoid(0.019, 0.0035, 0.005, 8));
      brow.position.set(s * 0.036, 0.101, 0.096);
      this.head.add(brow);
    }

    // -- arms
    const upperArm = loft([[0.03, 0.052, 0.056], [-0.04, 0.056, 0.06], [-0.15, 0.05, 0.053], [-0.31, 0.038, 0.04]], 14);
    const sleeveGeo = loft([[0.035, 0.062, 0.066], [-0.05, 0.064, 0.068], [-0.16, 0.058, 0.061], [-0.175, 0.056, 0.06]], 14);
    const trimGeo = loft([[-0.165, 0.058, 0.061], [-0.185, 0.056, 0.06]], 14, false, false);
    const forearm = loft([[0.02, 0.038, 0.04], [-0.07, 0.042, 0.044], [-0.18, 0.031, 0.033], [-0.27, 0.024, 0.026]], 12);
    const handGeo = ellipsoid(0.021, 0.055, 0.04, 10);
    for (const [shoulder, elbow, wrist] of [[this.shoulderL, this.elbowL, this.wristL], [this.shoulderR, this.elbowR, this.wristR]]) {
      shoulder.add(part(skinMat, upperArm));
      shoulder.add(part(sleeve, sleeveGeo));
      shoulder.add(part(trim, trimGeo));
      elbow.add(part(skinMat, forearm));
      const hand = part(skinMat, handGeo);
      hand.position.y = -0.05;
      wrist.add(hand);
    }

    // -- legs
    const thigh = loft([[0.03, 0.088, 0.1], [-0.1, 0.09, 0.104], [-0.26, 0.072, 0.084], [-0.46, 0.055, 0.06]], 16);
    const shortLeg = loft([[0.03, 0.102, 0.116], [-0.1, 0.108, 0.12], [-0.25, 0.112, 0.122], [-0.27, 0.112, 0.122]], 16);
    const shin = loft([[0.03, 0.052, 0.058], [-0.04, 0.054, 0.062], [-0.13, 0.058, 0.07, 0, -0.012], [-0.26, 0.047, 0.054, 0, -0.008], [-0.41, 0.034, 0.038], [-0.45, 0.036, 0.04]], 14);
    const kneeCap = ellipsoid(0.056, 0.06, 0.06, 12);
    const boot = loft(
      [
        [-0.03, 0.04, 0.05, 0, -0.012], [-0.07, 0.048, 0.098, 0, 0.036], [-0.095, 0.051, 0.138, 0, 0.066], [-0.115, 0.05, 0.142, 0, 0.068],
      ],
      16,
    );
    const stud = loft([[-0.115, 0.044, 0.126, 0, 0.066], [-0.125, 0.04, 0.114, 0, 0.066]], 12);
    for (const [hip, knee, ankle] of [[this.hipL, this.kneeL, this.ankleL], [this.hipR, this.kneeR, this.ankleR]]) {
      hip.add(part(skinMat, thigh));
      hip.add(part(shorts, shortLeg));
      knee.add(part(skinMat, kneeCap));
      knee.add(part(socks, shin));
      ankle.add(part(boots, boot));
      ankle.add(part(dark, stud));
    }

    this.meshes = [];
    this.root.traverse((o) => {
      if (o.isMesh) this.meshes.push(o);
    });
  }

  /**
   * pose: angles in radians.
   * Hips and shoulders: pitch (+ swings the limb forward), abduct (+ moves it away from the body).
   */
  apply(p) {
    this.pelvis.position.y = p.pelvisY ?? 0.98;
    this.pelvis.position.x = p.pelvisX ?? 0;
    this.pelvis.rotation.set(p.pelvisPitch ?? 0, p.pelvisYaw ?? 0, p.pelvisRoll ?? 0);
    this.spine.rotation.set(p.spinePitch ?? 0, p.spineYaw ?? 0, p.spineRoll ?? 0);
    this.chest.rotation.set(p.chestPitch ?? 0, p.chestYaw ?? 0, 0);
    this.neck.rotation.set(p.neckPitch ?? 0, p.neckYaw ?? 0, 0);

    this.hipL.rotation.set(-(p.hipL ?? 0), 0, p.hipAbL ?? 0.04, 'ZXY');
    this.hipR.rotation.set(-(p.hipR ?? 0), 0, -(p.hipAbR ?? 0.04), 'ZXY');
    this.kneeL.rotation.x = p.kneeL ?? 0.1;
    this.kneeR.rotation.x = p.kneeR ?? 0.1;
    this.ankleL.rotation.x = p.ankleL ?? 0;
    this.ankleR.rotation.x = p.ankleR ?? 0;

    this.shoulderL.rotation.set(-(p.armL ?? 0), 0, p.armAbL ?? 0.12, 'ZXY');
    this.shoulderR.rotation.set(-(p.armR ?? 0), 0, -(p.armAbR ?? 0.12), 'ZXY');
    this.elbowL.rotation.x = -(p.elbowL ?? 0.3);
    this.elbowR.rotation.x = -(p.elbowR ?? 0.3);
  }
}

const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Blends two pose objects field by field. */
export function blendPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) out[k] = mix(a[k] ?? DEFAULTS[k] ?? 0, b[k] ?? DEFAULTS[k] ?? 0, t);
  return out;
}

const DEFAULTS = { pelvisY: 0.98, kneeL: 0.1, kneeR: 0.1, elbowL: 0.3, elbowR: 0.3, armAbL: 0.12, armAbR: 0.12, hipAbL: 0.04, hipAbR: 0.04 };

/** Relaxed stance with a little weight shift, so nobody ever stands dead still. */
export function idlePose(time, seed = 0) {
  const s = Math.sin(time * 1.3 + seed), s2 = Math.sin(time * 0.7 + seed * 1.7);
  return {
    pelvisY: 0.955 + s * 0.006,
    pelvisRoll: s2 * 0.03,
    spinePitch: 0.14 + s * 0.012,
    chestPitch: 0.05,
    neckPitch: -0.05,
    hipL: 0.1 + s2 * 0.03,
    hipR: 0.08 - s2 * 0.03,
    kneeL: 0.24,
    kneeR: 0.24,
    ankleL: -0.12,
    ankleR: -0.12,
    hipAbL: 0.08,
    hipAbR: 0.08,
    armL: 0.08,
    armR: 0.08,
    armAbL: 0.2,
    armAbR: 0.2,
    elbowL: 0.55,
    elbowR: 0.55,
  };
}

/**
 * A run cycle driven by phase (radians). `speed` 0..1 goes from a jog to a sprint.
 * Knees fold in the swing phase; the lead leg extends just before it lands.
 */
export function runPose(phase, speed) {
  const s = Math.sin(phase);
  const leg = (ph) => {
    const swing = Math.sin(ph);
    const hip = 0.22 + swing * mix(0.5, 0.82, speed);
    const fold = Math.max(0, Math.sin(ph - 1.05));
    const knee = mix(0.28, 0.2, speed) + Math.pow(fold, 1.4) * mix(0.95, 1.65, speed) + Math.max(0, Math.sin(ph + 1.9)) * 0.22;
    const ankle = -0.2 + swing * 0.28;
    return { hip, knee, ankle };
  };
  const l = leg(phase);
  const r = leg(phase + Math.PI);
  const lean = mix(0.13, 0.3, speed);
  const armSwing = mix(0.42, 0.78, speed);
  return {
    pelvisY: mix(0.93, 0.91, speed) + Math.abs(Math.cos(phase)) * mix(0.03, 0.055, speed),
    pelvisPitch: lean * 0.45,
    pelvisYaw: s * mix(0.08, 0.14, speed),
    pelvisRoll: Math.cos(phase) * 0.035,
    spinePitch: lean,
    spineYaw: -s * mix(0.1, 0.2, speed),
    chestPitch: lean * 0.3,
    chestYaw: -s * 0.12,
    neckPitch: -lean * 0.9,
    hipL: l.hip,
    hipR: r.hip,
    kneeL: l.knee,
    kneeR: r.knee,
    ankleL: l.ankle,
    ankleR: r.ankle,
    hipAbL: 0.03,
    hipAbR: 0.03,
    armL: -s * armSwing + 0.05,
    armR: s * armSwing + 0.05,
    armAbL: 0.16,
    armAbR: 0.16,
    elbowL: mix(1.15, 1.5, speed) + s * 0.2,
    elbowR: mix(1.15, 1.5, speed) - s * 0.2,
  };
}

/** Right-footed strike. prog 0..1 runs from plant, through backswing and contact, to follow-through. */
export function kickPose(prog) {
  const back = smooth(prog / 0.4);
  const strike = smooth((prog - 0.36) / 0.2);
  const follow = smooth((prog - 0.56) / 0.44);
  const hipR = mix(mix(0.1, -0.85, back), 0.95, strike) + follow * 0.35;
  const kneeR = mix(mix(0.3, 1.5, back), 0.18, strike);
  const lean = mix(0.28, -0.12, strike);
  return {
    pelvisY: mix(0.93, 0.95, strike),
    pelvisPitch: lean * 0.5,
    pelvisYaw: mix(-0.35, 0.5, strike),
    pelvisRoll: mix(0.14, -0.1, strike),
    spinePitch: lean + follow * 0.08,
    spineYaw: mix(0.3, -0.5, strike),
    chestPitch: 0.05,
    neckPitch: 0.12,
    hipL: mix(0.32, 0.05, strike),
    kneeL: mix(0.48, 0.24, strike),
    ankleL: -0.25,
    hipR,
    kneeR,
    ankleR: mix(-0.1, -0.55, strike),
    hipAbL: 0.08,
    hipAbR: 0.06,
    armL: mix(0.5, -0.5, strike),
    armR: mix(-0.6, 0.5, strike),
    armAbL: mix(0.95, 0.65, strike),
    armAbR: mix(0.75, 1.0, strike),
    elbowL: 0.5,
    elbowR: 0.55,
  };
}

/** Arms flung wide, chest up, mouth open at the sky: the run after a goal. */
export function celebratePose(phase, speed, time, seed = 0) {
  const base = runPose(phase, speed);
  const shout = Math.sin(time * 2.2 + seed) * 0.07;
  return {
    ...base,
    pelvisPitch: base.pelvisPitch * 0.2,
    spinePitch: base.spinePitch * 0.15 - 0.1,
    spineYaw: base.spineYaw * 0.4,
    chestPitch: -0.14,
    chestYaw: base.chestYaw * 0.3,
    neckPitch: -0.3 + shout,
    armL: 0.2 + shout,
    armR: 0.2 - shout,
    armAbL: 1.42 + shout,
    armAbR: 1.42 - shout,
    elbowL: 0.28,
    elbowR: 0.28,
  };
}

/** Goalkeeper dive: dir +1 dives toward the keeper's own left. prog 0..1 */
export function divePose(prog, dir) {
  const lift = smooth(prog / 0.5);
  const fall = smooth((prog - 0.6) / 0.4);
  return {
    pelvisY: mix(0.93, 1.05, lift),
    pelvisRoll: 0,
    spinePitch: 0.08,
    chestPitch: 0,
    neckPitch: -0.1,
    hipL: 0.15 + lift * 0.3,
    hipR: 0.15 - lift * 0.2,
    kneeL: 0.45 - lift * 0.2,
    kneeR: 0.75 - lift * 0.3,
    armL: dir > 0 ? 0.3 : 0.2,
    armR: dir > 0 ? 0.2 : 0.3,
    armAbL: mix(0.3, 2.85, lift),
    armAbR: mix(0.3, 2.85, lift),
    elbowL: 0.18,
    elbowR: 0.18,
    ankleL: -0.35,
    ankleR: -0.35,
    hipAbL: 0.1,
    hipAbR: 0.1,
    fall,
  };
}
