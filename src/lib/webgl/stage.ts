import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FAN_NAMES, STAGE, type SceneSpec, type Vec3 } from './config';
import {
  CLOUD_FRAG,
  CLOUD_VERT,
  DUST_FRAG,
  DUST_VERT,
  FULLSCREEN_VERT,
  STAR_FRAG,
  STAR_VERT,
  TERRAIN_FRAG,
  TERRAIN_VERT,
  TRAIL_ADD_FRAG,
  TRAIL_DECAY_FRAG,
  VIGNETTE_FRAG,
} from './shaders';

type TierName = keyof typeof STAGE.tiers;

function pickTier(renderer: THREE.WebGLRenderer): TierName {
  const coarse = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2;
  if (coarse) return window.devicePixelRatio >= 3 ? 'medium' : 'low';
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (info) {
    const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)).toLowerCase();
    if (/rtx|rx [67]\d{3}|radeon pro|apple m[234] (pro|max|ultra)/i.test(name)) return 'high';
    if (/gtx|rx 5\d{3}|iris xe|vega|apple m/i.test(name)) return 'medium';
  }
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  return max >= 16384 ? 'high' : max >= 8192 ? 'medium' : 'low';
}

/** Value noise and its fractal sum, for the terrain relief. */
const hash = (n: number) => {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
};
function valueNoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (6 * fx - 15) + 10);
  const uy = fy * fy * fy * (fy * (6 * fy - 15) + 10);
  const a = hash(ix + 113 * iy), b = hash(ix + 1 + 113 * iy), c = hash(ix + (iy + 1) * 113), d = hash(ix + 1 + (iy + 1) * 113);
  return a + (b - a) * ux + (c - a) * uy + (d - b - c + a) * ux * uy;
}
function fractal(x: number, y: number) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < 6; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

function terrainGeometry(heightMult: number) {
  const t = STAGE.terrain;
  const n = Math.max(2, t.meshResolution);
  const pos = new Float32Array(n * n * 3);
  let total = 0;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const u = col / (n - 1), v = row / (n - 1);
      const ridgeDist = Math.abs(v - t.ridgeCenter);
      const h =
        (fractal(u * t.noiseScale + t.noiseOffset[0], v * t.noiseScale + t.noiseOffset[1]) * heightMult +
          Math.exp(-ridgeDist * ridgeDist * t.ridgeFalloff) * t.ridgeStrength +
          t.heightOffset) *
        Math.max(1 - Math.pow(2 * Math.abs(u - 0.5), t.edgeFadePower), 0.1);
      pos[i * 3] = (u - 0.5) * t.width;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = (v - 0.5) * t.depth;
      total += h;
    }
  }
  const mean = total / (n * n);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= mean;
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const a = row * n + col, b = a + 1, c = a + n, d = c + 1;
      index[k++] = a; index[k++] = c; index[k++] = b;
      index[k++] = b; index[k++] = c; index[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

/**
 * One point per atlas sample. Each point also wanders a little inside its own grid cell: a perfect
 * lattice beats against the pixel grid into moire fringes, and this breaks them up without moving
 * the texture lookup, so the picture stays sharp.
 */
function gridGeometry(cols: number, rows: number, jitter = 0.32) {
  const count = cols * rows;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const cellX = 1 / (cols - 1), cellY = 1 / (rows - 1);
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / (cols - 1), v = y / (rows - 1);
      pos[i * 3] = u - 0.5 + rand() * jitter * cellX;
      pos[i * 3 + 1] = v - 0.5 + rand() * jitter * cellY;
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

type TrackLayer = { times: Float32Array; data: Float32Array; count: number; start: number; end: number };
type Tracks = { player: TrackLayer | null; ball: TrackLayer | null };

function buildTrack(frames: number[][] | undefined): TrackLayer | null {
  if (!frames?.length) return null;
  const n = frames.length;
  const times = new Float32Array(n), data = new Float32Array(n * 3);
  frames.forEach((f, i) => {
    times[i] = f[0];
    data[i * 3] = f[1];
    data[i * 3 + 1] = f[2];
    data[i * 3 + 2] = f[3];
  });
  return { times, data, count: n, start: times[0], end: times[n - 1] };
}

function sampleTrack(t: TrackLayer, time: number, out: Float32Array) {
  const { times, data, count } = t;
  const put = (i: number) => {
    out[0] = data[i * 3];
    out[1] = data[i * 3 + 1];
    out[2] = data[i * 3 + 2];
  };
  if (count === 1 || time <= times[0]) return put(0);
  if (time >= times[count - 1]) return put(count - 1);
  let lo = 0, hi = count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo];
  const f = span > 1e-6 ? (time - times[lo]) / span : 0;
  for (let c = 0; c < 3; c++) out[c] = data[lo * 3 + c] + (data[hi * 3 + c] - data[lo * 3 + c]) * f;
}

type LoadedAsset = {
  spec: SceneSpec;
  texture: THREE.Texture;
  video: HTMLVideoElement | null;
  stripFrac: number;
  colorFrac: number;
  aspect: number;
  texW: number;
  texH: number;
  tracks: Tracks;
  dispose: () => void;
};

const easeCubicOut = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type StageEvents = {
  /** iOS only allows motion sensors after a tap, so the UI has to offer one. */
  onGyroNeedsPermission?: () => void;
  onSceneReady?: (spec: SceneSpec) => void;
  onFirstScene?: () => void;
  onSceneChanged?: (spec: SceneSpec) => void;
  onAudio?: (src: string | undefined, volume: number, musicVolume?: number) => void;
};

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private tierName: TierName;
  private tier: (typeof STAGE.tiers)[TierName];
  private pixelRatio: number;

  private terrain: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private terrainHeightMult = STAGE.terrain.heightMult;
  private dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private cloud: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private cloudCols = 0;
  private cloudRows = 0;
  private star: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private trailTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private trailIndex = 0;
  private trailScene = new THREE.Scene();
  private trailCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private trailDecay: THREE.ShaderMaterial | null = null;
  private trailPass: ShaderPass | null = null;
  private trailSizeScale = 1;

  private pickTarget = new THREE.WebGLRenderTarget(160, 90, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  private pickPixels = new Uint8Array(9 * 9 * 4);
  private pickHit = false;
  private pickLast = -Infinity;

  private lookAt = new THREE.Vector3();
  private basePos = new THREE.Vector3();
  private baseLook = new THREE.Vector3();
  private cameraAnim: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromLook: THREE.Vector3; toLook: THREE.Vector3; t: number } | null = null;

  private pointer = { x: 0, y: 0 };
  private pointerSmooth = { x: 0, y: 0 };
  private fieldPointer = { x: 0, y: 0 };
  private fieldScale = 0;
  private lastPointerMove = 0;
  private pointerEverMoved = false;
  private pointerClient = { x: 0, y: 0 };
  private orbitAngle = 0;
  private nameEl: HTMLDivElement | null = null;
  private nameShown = false;
  private cursorHidden = false;

  private fade = 0;
  private fadeDir: 'in' | 'out' | 'none' = 'none';
  private transitioning = false;
  private allowShow = false;
  private hasShownScene = false;
  private current: LoadedAsset | null = null;
  private pending: LoadedAsset | null = null;
  private loadToken = 0;
  private wanted: SceneSpec | null = null;

  private wheelActive = false;
  private dragActive = false;
  private dragStartX = 0;
  private dragSpeed = 0;
  private scrubTarget = 0;
  private scrubSmooth = 0;
  private scrubLastSet = 0;
  private seeking = false;
  private wheelTimer: ReturnType<typeof setTimeout> | null = null;

  private trackMix = 0;
  private trackPos = new Float32Array(3);
  private trackVel = new Float32Array(3);
  private trackReady = false;
  private trackWorld = new THREE.Vector3();
  private tmpA = new Float32Array(3);
  private tmpB = new Float32Array(3);

  private raf = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private lowFpsTime = 0;
  private disposed = false;
  private frameDirty = true;
  private events: StageEvents;

  constructor(canvas: HTMLCanvasElement, events: StageEvents = {}) {
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);

    this.tierName = pickTier(this.renderer);
    this.tier = STAGE.tiers[this.tierName];
    this.pixelRatio = Math.min(window.devicePixelRatio, this.tier.dprMax);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    const c = STAGE.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, window.innerWidth / window.innerHeight, c.near, c.far);
    this.basePos.set(...c.position);
    this.baseLook.set(...c.lookAt);
    this.lookAt.copy(this.baseLook);
    this.camera.position.copy(this.basePos);
    this.scene.add(this.camera);

    this.group.position.set(0, 0, 0);
    this.scene.add(this.group);

    this.terrain = this.makeTerrain();
    this.group.add(this.terrain);
    this.dust = this.makeDust();
    this.group.add(this.dust);
    this.cloud = this.makeCloud();
    this.group.add(this.cloud);
    this.star = this.makeStar();
    this.scene.add(this.star);

    const { composer, trailPass } = this.makeComposer();
    this.composer = composer;
    this.trailPass = trailPass;
    if (STAGE.ballTrail.enabled) this.makeTrail();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    this.setupGyro();

    this.tick();
  }

  /** On phones, tilting the device stands in for the mouse. */
  private gyroListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private setupGyro() {
    const coarseOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
    if (!coarseOnly || typeof DeviceOrientationEvent === 'undefined') return;
    let base: { beta: number; gamma: number } | null = null;
    const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
    this.gyroListener = (e) => {
      if (e.beta === null || e.gamma === null) return;
      if (!base) base = { beta: e.beta, gamma: e.gamma };
      if (this.dragActive) return;
      this.pointer.x = clamp1((e.gamma - base.gamma) / 25);
      this.pointer.y = clamp1(-(e.beta - base.beta) / 25);
    };
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof ask === 'function') this.events.onGyroNeedsPermission?.();
    else window.addEventListener('deviceorientation', this.gyroListener);
  }

  async requestGyro() {
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    try {
      const granted = !ask || (await ask.call(DeviceOrientationEvent)) === 'granted';
      if (granted && this.gyroListener) window.addEventListener('deviceorientation', this.gyroListener);
      return granted;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ construction */

  private fieldUniforms() {
    return {
      uCursor: { value: new THREE.Vector2(9999, 9999) },
      uFieldRadius: { value: 0 },
      uFieldPower: { value: 0 },
      uFieldClear: { value: STAGE.cloud.field.clear },
      uFieldSwirl: { value: STAGE.cloud.field.swirl },
      uFieldPin: { value: STAGE.cloud.field.pin },
      uHidePinned: { value: 0 },
    };
  }

  private colorUniforms() {
    const col = STAGE.colors;
    return {
      uFogColor: { value: new THREE.Color(STAGE.scene.background) },
      uFogDensity: { value: STAGE.scene.fogDensity },
      uLow: { value: new THREE.Vector3(...col.low) },
      uMid: { value: new THREE.Vector3(...col.mid) },
      uHigh: { value: new THREE.Vector3(...col.bright) },
      uHeightScale: { value: col.heightScale },
      uHeightOffset: { value: col.heightOffset },
      uFadeNear: { value: col.fadeNear },
      uFadeFar: { value: col.fadeFar },
      uBaseAlpha: { value: 0 },
    };
  }

  private makeTerrain() {
    const t = STAGE.terrain;
    const mat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        ...this.colorUniforms(),
        ...this.fieldUniforms(),
        uDotPitch: { value: t.dotPitch },
        uCoverage: { value: t.coverage },
        uJitter: { value: t.jitter },
        uBrightness: { value: t.brightness },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uAspect: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(terrainGeometry(t.heightMult), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  private makeDust() {
    const count = this.tier.ambientCount;
    const t = STAGE.terrain, a = STAGE.ambient;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * t.width;
      pos[i * 3 + 1] = Math.random() * a.heightRange + a.heightMin;
      pos[i * 3 + 2] = (Math.random() - 0.5) * t.depth;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        ...this.colorUniforms(),
        ...this.fieldUniforms(),
        uPointSize: { value: this.tier.pointSize * a.pointSizeRatio },
        uMinPointPx: { value: t.minPointPx },
        uDisc: { value: new THREE.Vector2(STAGE.colors.discInner, STAGE.colors.discOuter) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
  }

  private makeCloud() {
    const c = STAGE.cloud, s = STAGE.segmentation;
    const mat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        ...this.fieldUniforms(),
        uAtlas: { value: null },
        uStrip: { value: 1 / 3 },
        uColor: { value: 2 / 3 },
        uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1620) },
        uDepthScale: { value: 50 },
        uDepthBias: { value: c.depthBias },
        uDepthFov: { value: 0 },
        uDepthSmooth: { value: c.depthSmoothRadius },
        uDepthEdgeMax: { value: c.depthEdgeMax },
        uPointSize: { value: c.pointSize },
        uSizeScale: { value: 1 },
        uScatter: { value: 0 },
        uSegOn: { value: 0 },
        uSegThreshold: { value: s.threshold },
        uBallOnly: { value: 0 },
        uSegDensity: { value: new THREE.Vector4(...s.density) },
        uSegSize: { value: new THREE.Vector4(...s.size) },
        uSegBright: { value: new THREE.Vector4(...s.brightness) },
        uOpacity: { value: 0 },
        uAlphaThreshold: { value: c.alphaThreshold },
        uEmissive: { value: c.emissive },
        uMaskRadius: { value: c.maskRadius },
        uMaskSmoothness: { value: c.maskSmoothness },
        uSaturation: { value: c.saturation },
      },
      transparent: true,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    this.cloudCols = 2;
    this.cloudRows = 2;
    const points = new THREE.Points(gridGeometry(2, 2), mat);
    points.visible = false;
    points.frustumCulled = false;
    points.renderOrder = 5;
    return points;
  }

  private makeStar() {
    const s = STAGE.pointerStar;
    const n = s.orbit.count;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aIndex', new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => i), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uNdc: { value: new THREE.Vector2() },
        uSize: { value: s.size * this.pixelRatio },
        uColor: { value: new THREE.Vector3(...s.color) },
        uOpacity: { value: 0 },
        uGlow: { value: s.glow },
        uOrbitRadius: { value: 0 },
        uOrbitAngle: { value: 0 },
        uCount: { value: n },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 999;
    points.visible = false;
    return points;
  }

  private makeComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, stencilBuffer: false });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));

    let trailPass: ShaderPass | null = null;
    if (STAGE.ballTrail.enabled) {
      trailPass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          tTrail: { value: null },
          uIntensity: { value: STAGE.ballTrail.intensity },
          uColor: { value: new THREE.Vector3(...STAGE.ballTrail.color) },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: TRAIL_ADD_FRAG,
      });
      composer.addPass(trailPass);
    }

    const p = STAGE.post;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), p.bloomStrength, p.bloomRadius, p.bloomThreshold));

    const vignette = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uOffset: { value: p.vignetteOffset },
        uDarkness: { value: p.vignetteDarkness },
        uColor: { value: new THREE.Color(STAGE.scene.background) },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: VIGNETTE_FRAG,
    });
    composer.addPass(vignette);
    return { composer, trailPass };
  }

  private makeTrail() {
    const scale = Math.max(0.1, Math.min(1, STAGE.ballTrail.scale));
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false };
    this.trailTargets = [new THREE.WebGLRenderTarget(w, h, opts), new THREE.WebGLRenderTarget(w, h, opts)];
    this.trailDecay = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: TRAIL_DECAY_FRAG,
      uniforms: { tPrev: { value: null }, uDecay: { value: 0.9 } },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.trailDecay);
    quad.frustumCulled = false;
    this.trailScene.add(quad);
    this.trailSizeScale = scale / this.pixelRatio;
  }

  /* ------------------------------------------------------------------ public API */

  /** Lets the wanted scene fade in. Until this is called scenes load but stay invisible. */
  allow() {
    this.allowShow = true;
  }

  /** Fades the current scene out and blocks showing anything until allow() is called again. */
  hide() {
    this.allowShow = false;
    this.fadeDir = 'out';
    this.transitioning = true;
  }

  /** Jumps to fully hidden, used when leaving the home route while the canvas is hidden too. */
  hideNow() {
    this.allowShow = false;
    this.fade = 0;
    this.fadeDir = 'none';
    this.current?.video?.pause();
    this.applyFade();
  }

  show(spec: SceneSpec) {
    if (this.wanted?.id === spec.id && (this.current?.spec.id === spec.id || this.pending?.spec.id === spec.id)) {
      // Same scene as before, for example coming back from a text page: just fade it in again.
      if (this.current?.spec.id === spec.id && this.fadeDir !== 'in') {
        this.fadeDir = 'in';
        this.transitioning = true;
        this.current.video?.play().catch(() => {});
        this.frameDirty = true;
      }
      return;
    }
    this.wanted = spec;
    this.transitioning = true;
    this.fadeDir = 'out';
    this.wheelActive = false;
    this.dragActive = false;
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    this.pending?.dispose();
    this.pending = null;

    const token = ++this.loadToken;
    this.load(spec)
      .then((asset) => {
        if (token !== this.loadToken || this.disposed) return asset.dispose();
        this.pending = asset;
      })
      .catch((err) => {
        console.error('[stage] scene failed to load', spec.src, err);
      });
  }

  /** A clip that is running by itself. Null on a still scene, during a scrub, or while it buffers. */
  get runningClip() {
    const video = this.current?.video;
    if (!video || video.paused || video.readyState < 3) return null;
    return { time: video.currentTime, length: video.duration };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    if (this.gyroListener) window.removeEventListener('deviceorientation', this.gyroListener);
    this.current?.dispose();
    this.pending?.dispose();
    this.nameEl?.remove();
    document.body.style.cursor = '';
    this.renderer.dispose();
  }

  /* ------------------------------------------------------------------ asset loading */

  private async load(spec: SceneSpec): Promise<LoadedAsset> {
    const atlasH = spec.atlasHeight, colorH = spec.colorHeight;
    const stripFrac = (atlasH - colorH) / atlasH;
    const colorFrac = colorH / atlasH;

    if (spec.kind === 'image') {
      const texture = await new THREE.TextureLoader().loadAsync(spec.src);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const img = texture.image as HTMLImageElement;
      return {
        spec,
        texture,
        video: null,
        stripFrac,
        colorFrac,
        aspect: img.width / (img.height * colorFrac),
        texW: img.width,
        texH: img.height,
        tracks: { player: null, ball: null },
        dispose: () => texture.dispose(),
      };
    }

    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.setAttribute('playsinline', '');
    const ready = new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        video.removeEventListener('canplaythrough', done);
        video.removeEventListener('loadeddata', onData);
        resolve();
      };
      const onData = () => {
        // Slow connections never reach canplaythrough, so accept the first frame after a moment.
        setTimeout(done, 1500);
      };
      const timer = setTimeout(done, 8000);
      video.addEventListener('canplaythrough', done, { once: true });
      video.addEventListener('loadeddata', onData, { once: true });
      video.addEventListener('error', () => reject(new Error(`video error: ${spec.src}`)), { once: true });
    });
    video.src = spec.src;
    video.load();

    const tracksPromise: Promise<Tracks> = spec.tracking
      ? fetch(spec.tracking)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => ({ player: buildTrack(j?.player), ball: buildTrack(j?.ball) }))
          .catch(() => ({ player: null, ball: null }))
      : Promise.resolve({ player: null, ball: null });

    await ready;
    const tracks = await tracksPromise;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return {
      spec,
      texture,
      video,
      stripFrac,
      colorFrac,
      aspect: video.videoWidth / (video.videoHeight * colorFrac) || 16 / 9,
      texW: video.videoWidth || 1920,
      texH: video.videoHeight || 1620,
      tracks,
      dispose: () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
        texture.dispose();
      },
    };
  }

  private swapIn(asset: LoadedAsset) {
    this.current?.dispose();
    this.current = asset;
    this.pending = null;
    const { spec } = asset;
    const u = this.cloud.material.uniforms;

    const scale = spec.kind === 'video' ? this.tier.cloudScale : 1;
    const cols = Math.max(2, Math.round(spec.cols * scale));
    const rows = Math.max(2, Math.round(spec.rows * scale));
    if (cols !== this.cloudCols || rows !== this.cloudRows) {
      this.cloud.geometry.dispose();
      this.cloud.geometry = gridGeometry(cols, rows);
      this.cloudCols = cols;
      this.cloudRows = rows;
    }

    u.uAtlas.value = asset.texture;
    u.uStrip.value = asset.stripFrac;
    u.uColor.value = asset.colorFrac;
    u.uTexel.value.set(1 / asset.texW, 1 / asset.texH);
    u.uDepthScale.value = spec.depthScale;
    u.uDepthBias.value = spec.depthBias ?? STAGE.cloud.depthBias;
    u.uDepthFov.value = spec.depthFov ?? 0;
    // Thinner grids get proportionally bigger points, so coverage stays the same on every tier.
    u.uPointSize.value = (spec.pointSize * spec.cols) / cols;
    u.uEmissive.value = spec.emissive ?? STAGE.cloud.emissive;
    u.uSaturation.value = spec.saturation ?? STAGE.cloud.saturation;
    u.uSegOn.value = spec.segmentation ? 1 : 0;
    u.uScatter.value = spec.kind === 'image' ? 1 : 0;

    this.group.position.set(...spec.videoPosition);
    this.terrain.position.set(...spec.terrainPosition);
    this.terrain.rotation.set(...(spec.terrainRotation as Vec3));
    this.cloud.rotation.set(0, 0, 0);

    const hm = spec.terrainHeightMult ?? STAGE.terrain.heightMult;
    if (hm !== this.terrainHeightMult) {
      this.terrain.geometry.dispose();
      this.terrain.geometry = terrainGeometry(hm);
      this.terrainHeightMult = hm;
    }
    const tu = this.terrain.material.uniforms;
    tu.uDotPitch.value = spec.terrainPitch ?? STAGE.terrain.dotPitch;
    tu.uCoverage.value = spec.terrainCoverage ?? STAGE.terrain.coverage;
    tu.uBrightness.value = spec.terrainBrightness ?? STAGE.terrain.brightness;

    this.fitCloud();

    this.trackReady = false;
    this.trackMix = 0;
    if (asset.video) {
      asset.video.currentTime = 0;
      asset.video.play().catch(() => {});
    }
    // The goal sounds are timed to their clips, so they start with the picture.
    this.events.onAudio?.(spec.audio, spec.audioVolume ?? 1, spec.musicVolume);
    this.fadeDir = 'in';
    if (!this.hasShownScene) {
      this.hasShownScene = true;
      this.events.onFirstScene?.();
    }
    this.events.onSceneChanged?.(spec);
    this.frameDirty = true;
  }

  /** Sizes the cloud plane so its colour area would cover the screen at the camera's look-at distance. */
  private fitCloud() {
    if (!this.current) return;
    const dist = this.basePos.distanceTo(this.baseLook);
    const visibleH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visibleW = visibleH * this.camera.aspect;
    let w = visibleW;
    let h = visibleW / this.current.aspect;
    if (h < visibleH) {
      h = visibleH;
      w = visibleH * this.current.aspect;
    }
    this.cloud.scale.set(w, h, 1);
  }

  /* ------------------------------------------------------------------ input */

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.resizeTrail();
    this.fitCloud();
  };

  private resizeTrail() {
    if (!this.trailTargets) return;
    const scale = STAGE.ballTrail.scale;
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    this.trailTargets[0].setSize(w, h);
    this.trailTargets[1].setSize(w, h);
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.pointerClient.x = e.clientX;
    this.pointerClient.y = e.clientY;
    this.pointerEverMoved = true;
    this.lastPointerMove = performance.now();
    this.hideName();
    if (this.dragActive && this.current?.video) this.dragSpeed = ((e.clientX - this.dragStartX) / window.innerWidth) * 5;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.hideName();
    this.lastPointerMove = performance.now();
    const video = this.current?.video;
    if (!video || this.fade <= 0) return;
    if ((e.target as HTMLElement)?.closest?.('a, button, [role="button"], .js-hover-sound')) return;
    this.dragActive = true;
    this.dragStartX = e.clientX;
    this.dragSpeed = 0;
    this.beginScrub(video);
  };

  private onPointerUp = () => {
    if (!this.dragActive) return;
    this.dragActive = false;
    this.dragSpeed = 0;
    this.seeking = false;
    if (!this.wheelActive) this.current?.video?.play().catch(() => {});
  };

  private beginScrub(video: HTMLVideoElement) {
    this.scrubTarget = video.currentTime;
    this.scrubLastSet = video.currentTime;
    this.scrubSmooth = video.currentTime;
    video.pause();
    video.addEventListener('seeked', this.onSeeked);
  }

  private onSeeked = () => {
    const video = this.current?.video;
    if (!video) return;
    this.seeking = false;
    this.scrubLastSet = video.currentTime;
    this.frameDirty = true;
  };

  /** The wheel never scrolls this page. It scrubs the running clip back and forth. */
  private onWheel = (e: WheelEvent) => {
    const video = this.current?.video;
    if (!video?.duration || window.location.pathname.replace(/\/$/, '') !== '') return;
    e.preventDefault();
    if (!this.wheelActive) {
      this.wheelActive = true;
      this.beginScrub(video);
    }
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      this.wheelActive = false;
      video.removeEventListener('seeked', this.onSeeked);
      this.seeking = false;
      if (!this.dragActive) video.play().catch(() => {});
    }, 300);
    const delta = e.deltaMode === 1 ? e.deltaY * (100 / 3) : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
    const next = this.scrubTarget + (delta / 100) * (1 / 30) * STAGE.post.scrubSensitivity;
    this.scrubTarget = Math.max(0, Math.min(video.duration, next));
  };

  private showName() {
    if (!this.nameEl) {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: '50',
        padding: '6px 14px',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
        fontSize: '11px',
        fontWeight: '500',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        opacity: '0',
        transition: 'opacity 0.3s ease',
      });
      document.body.appendChild(el);
      this.nameEl = el;
    }
    this.nameEl.textContent = FAN_NAMES[Math.floor(Math.random() * FAN_NAMES.length)];
    this.nameEl.style.left = `${this.pointerClient.x}px`;
    this.nameEl.style.top = `${this.pointerClient.y}px`;
    this.nameEl.style.opacity = '1';
    this.nameShown = true;
  }

  private hideName() {
    if (this.nameEl && this.nameShown) {
      this.nameEl.style.opacity = '0';
      this.nameShown = false;
    }
  }

  private setCursorHidden(hidden: boolean) {
    if (hidden === this.cursorHidden) return;
    this.cursorHidden = hidden;
    document.body.style.cursor = hidden ? 'none' : '';
  }

  /* ------------------------------------------------------------------ frame */

  private applyFade() {
    const f = this.fade;
    const u = this.cloud.material.uniforms;
    u.uOpacity.value = f * STAGE.cloud.opacity;
    this.cloud.visible = f > 0.001 && !!this.current;
    const alpha = STAGE.colors.baseAlpha * f;
    this.terrain.material.uniforms.uBaseAlpha.value = alpha;
    this.dust.material.uniforms.uBaseAlpha.value = alpha;
  }

  /** Renders the visible cloud alone at low resolution to find out if the cursor is on the figure. */
  private pickUnderCursor() {
    if (!this.cloud.visible) return false;
    const fields = this.cloud.material.uniforms;
    const radius = fields.uFieldRadius.value, power = fields.uFieldPower.value, hide = fields.uHidePinned.value;
    fields.uFieldRadius.value = 0;
    fields.uFieldPower.value = 0;
    fields.uHidePinned.value = 0;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.pickTarget);
    this.renderer.clear(true, true, false);
    this.renderOnlyCloud();
    const px = Math.round(((this.pointer.x + 1) / 2) * 160), py = Math.round(((this.pointer.y + 1) / 2) * 90);
    const x = Math.max(0, Math.min(151, px - 4)), y = Math.max(0, Math.min(81, py - 4));
    this.renderer.readRenderTargetPixels(this.pickTarget, x, y, 9, 9, this.pickPixels);
    this.renderer.setRenderTarget(prev);
    fields.uFieldRadius.value = radius;
    fields.uFieldPower.value = power;
    fields.uHidePinned.value = hide;
    const p = this.pickPixels;
    for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 4 || p[i] > 4 || p[i + 1] > 4 || p[i + 2] > 4) return true;
    return false;
  }

  private renderOnlyCloud() {
    const t = this.terrain.visible, d = this.dust.visible, s = this.star.visible;
    this.terrain.visible = false;
    this.dust.visible = false;
    this.star.visible = false;
    this.renderer.render(this.scene, this.camera);
    this.terrain.visible = t;
    this.dust.visible = d;
    this.star.visible = s;
  }

  private updateField(dt: number) {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const f = STAGE.cloud.field;
    const mats = [this.terrain.material, this.dust.material, this.cloud.material];
    if (!fine) {
      mats.forEach((m) => {
        m.uniforms.uFieldPower.value = 0;
        m.uniforms.uHidePinned.value = 0;
      });
      this.star.material.uniforms.uOpacity.value = 0;
      this.star.visible = false;
      return;
    }
    const now = performance.now();
    const isImage = !!this.current && !this.current.video;
    const resting = now - this.lastPointerMove >= 90;
    const damping = resting ? f.damping * 12 : f.damping;
    const k = 1 - Math.exp(-60 * damping * dt);
    this.fieldPointer.x += (this.pointer.x - this.fieldPointer.x) * k;
    this.fieldPointer.y += (this.pointer.y - this.fieldPointer.y) * k;

    if (isImage && this.fade > 0.5) {
      if (now - this.pickLast >= 90) {
        this.pickLast = now;
        this.pickHit = this.pickUnderCursor();
      }
    } else {
      this.pickHit = false;
      this.pickLast = -Infinity;
    }

    const target = this.pointerEverMoved ? (this.pickHit && resting && !this.dragActive ? 1 : f.moveScale) : 0;
    const rate = target > this.fieldScale ? f.growRate : f.shrinkRate;
    this.fieldScale += (target - this.fieldScale) * (1 - Math.exp(-rate * dt));

    const radius = f.radius * this.fieldScale;
    mats.forEach((m) => {
      m.uniforms.uCursor.value.set(this.fieldPointer.x, this.fieldPointer.y);
      m.uniforms.uFieldRadius.value = radius;
      m.uniforms.uFieldPower.value = f.strength;
    });

    const s = STAGE.pointerStar;
    if (s.enabled) {
      const range = Math.max(s.fadeRange[1] - s.fadeRange[0], 1e-4);
      const t = Math.max(0, Math.min(1, (this.fieldScale - s.fadeRange[0]) / range));
      const opacity = this.pickHit ? t * t * (3 - 2 * t) : 0;
      this.orbitAngle = (this.orbitAngle + dt * s.orbit.speed * Math.PI * 2) % (Math.PI * 2);
      const su = this.star.material.uniforms;
      su.uNdc.value.set(this.fieldPointer.x, this.fieldPointer.y);
      su.uOrbitRadius.value = radius * s.orbit.radiusScale;
      su.uOrbitAngle.value = this.orbitAngle;
      su.uOpacity.value = opacity;
      this.star.visible = opacity > 0.002;
      const hide = opacity > 0.5 ? 1 : 0;
      mats.forEach((m) => (m.uniforms.uHidePinned.value = hide));
    }

    // After a second of rest on the figure, the point under the cursor introduces itself.
    if (isImage && this.pickHit && !this.dragActive && this.hasShownScene) {
      if (this.pointerEverMoved && !this.nameShown && now - this.lastPointerMove >= 1000) this.showName();
    } else if (this.nameShown) {
      this.hideName();
    }
    this.setCursorHidden(this.nameShown);
  }

  private updateTracking(dt: number) {
    const asset = this.current;
    let weight = 0;
    let sum0 = 0, sum1 = 0, sum2 = 0;
    if (asset?.video) {
      const time = asset.video.currentTime;
      const add = (layer: TrackLayer | null) => {
        if (!layer) return;
        const off = time < layer.start ? layer.start - time : time > layer.end ? time - layer.end : 0;
        const w = off <= 0.25 ? 1 : Math.max(0, 1 - (off - 0.25) / 0.75);
        if (w <= 0) return;
        sampleTrack(layer, time, this.tmpA);
        sum0 += this.tmpA[0] * w;
        sum1 += this.tmpA[1] * w;
        sum2 += this.tmpA[2] * w;
        weight += w;
      };
      add(asset.tracks.player);
      add(asset.tracks.ball);
    }
    const target = weight > 0 ? Math.min(1, weight) : 0;
    this.trackMix += (target - this.trackMix) * (1 - Math.exp(-2.5 * dt));

    let valid = false;
    if (weight > 0) {
      const tx = sum0 / weight, ty = sum1 / weight, tz = sum2 / weight;
      this.tmpB[0] = tx;
      this.tmpB[1] = ty;
      this.tmpB[2] = tz;
      if (!this.trackReady) {
        this.trackPos.set(this.tmpB);
        this.trackVel.fill(0);
        this.trackReady = true;
      } else {
        // A critically damped spring keeps the look-at from twitching when the ball is struck.
        const step = Math.min(dt, 1 / 30);
        const hz = STAGE.camera.trackHz;
        for (let c = 0; c < 3; c++) {
          const w0 = 2 * Math.PI * (c === 2 ? hz * 0.5 : hz);
          this.trackVel[c] += (w0 * w0 * (this.tmpB[c] - this.trackPos[c]) - 2 * w0 * this.trackVel[c]) * step;
          this.trackPos[c] += this.trackVel[c] * step;
        }
      }
    }
    if (this.trackReady && this.trackMix > 0.001 && asset) {
      const u = this.cloud.material.uniforms;
      this.trackWorld.set(this.trackPos[0] - 0.5, 0.5 - this.trackPos[1], this.trackPos[2] * u.uDepthScale.value + u.uDepthBias.value);
      this.cloud.updateWorldMatrix(true, false);
      this.cloud.localToWorld(this.trackWorld);
      valid = true;
    }
    return valid;
  }

  private tmpRight = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private tmpOffset = new THREE.Vector3();
  private tmpN = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private worldUp = new THREE.Vector3(0, 1, 0);

  private updateCamera(dt: number, tracked: boolean) {
    const p = STAGE.post;
    const pos = this.tmpP.copy(this.basePos);
    this.lookAt.copy(this.baseLook);
    if (this.cameraAnim) {
      const a = this.cameraAnim;
      a.t += dt / p.cameraAnimDuration;
      const e = easeCubicOut(a.t);
      pos.lerpVectors(a.fromPos, a.toPos, e);
      this.lookAt.lerpVectors(a.fromLook, a.toLook, e);
      if (a.t >= 1) this.cameraAnim = null;
    }

    const tx = this.transitioning ? 0 : this.pointer.x;
    const ty = this.transitioning ? 0 : this.pointer.y;
    this.pointerSmooth.x += (tx - this.pointerSmooth.x) * p.pointerDamping;
    this.pointerSmooth.y += (ty - this.pointerSmooth.y) * p.pointerDamping;

    this.camera.position.copy(pos);
    this.camera.lookAt(this.lookAt);
    this.tmpRight.setFromMatrixColumn(this.camera.matrix, 0);
    this.tmpUp.setFromMatrixColumn(this.camera.matrix, 1);
    this.camera.updateMatrix();
    this.tmpRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.tmpUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

    if (tracked) this.lookAt.lerp(this.trackWorld, Math.min(1, STAGE.camera.trackFollow) * this.trackMix);

    this.tmpOffset.copy(pos).sub(this.lookAt);
    this.tmpOffset.applyAxisAngle(this.worldUp, -this.pointerSmooth.x * p.pointerRotAmp);
    this.tmpOffset.applyAxisAngle(this.tmpRight, this.pointerSmooth.y * p.pointerRotAmp);
    pos.copy(this.lookAt).add(this.tmpOffset);
    pos.addScaledVector(this.tmpRight, this.pointerSmooth.x * p.pointerAmp);
    pos.addScaledVector(this.tmpUp, this.pointerSmooth.y * p.pointerAmp);

    // Never let the orbit dip the camera through the ground.
    const clearance = STAGE.camera.minTerrainClearance;
    if (clearance > 0) {
      this.terrain.updateWorldMatrix(true, false);
      this.terrain.getWorldPosition(this.tmpV);
      this.terrain.getWorldQuaternion(this.tmpQ);
      this.tmpN.set(0, 1, 0).applyQuaternion(this.tmpQ).normalize();
      const above = this.tmpOffset.copy(pos).sub(this.tmpV).dot(this.tmpN);
      if (above < clearance && Math.abs(this.tmpN.y) > 0.001) pos.y += (clearance - above) / this.tmpN.y;
    }

    this.camera.position.copy(pos);
    this.camera.lookAt(this.lookAt);

    const amp = p.parallaxAmp;
    this.cloud.rotation.set(this.pointerSmooth.y * amp, -this.pointerSmooth.x * amp, 0);

    const tu = this.terrain.material.uniforms;
    tu.uViewport.value.set(this.renderer.domElement.width || 1, this.renderer.domElement.height || 1);
    tu.uAspect.value = this.camera.aspect;
  }

  private updateFade(dt: number) {
    const dur = STAGE.post.fadeDuration;
    if (this.fadeDir === 'out') {
      this.fade = Math.max(0, this.fade - dt / dur);
      if (this.fade <= 0) this.fadeDir = 'none';
    } else if (this.fadeDir === 'in') {
      this.fade = Math.min(1, this.fade + dt / dur);
      if (this.fade >= 1) {
        this.fadeDir = 'none';
        this.transitioning = false;
        if (this.current) this.events.onSceneReady?.(this.current.spec);
      }
    }
    if (this.allowShow && this.pending && this.fade <= 0.01 && this.fadeDir !== 'out') this.swapIn(this.pending);
    this.applyFade();
  }

  private updateScrub(dt: number) {
    const video = this.current?.video;
    if (!video?.duration) return;
    if (this.dragActive) this.scrubTarget = Math.max(0, Math.min(video.duration, this.scrubTarget + this.dragSpeed * dt));
    if (this.wheelActive || this.dragActive) {
      this.scrubSmooth += (this.scrubTarget - this.scrubSmooth) * (1 - Math.exp(-STAGE.post.scrubSmoothing * dt));
      if (Math.abs(this.scrubTarget - this.scrubSmooth) < 1 / 120) this.scrubSmooth = this.scrubTarget;
      if (!this.seeking && Math.abs(this.scrubSmooth - this.scrubLastSet) > 1 / 120) {
        this.seeking = true;
        video.currentTime = this.scrubSmooth;
      }
    }
  }

  private updateTrail(dt: number) {
    if (!this.trailTargets || !this.trailDecay || !this.trailPass) return;
    const useTrail = !!this.current?.video && this.cloud.visible;
    const read = this.trailTargets[this.trailIndex], write = this.trailTargets[1 - this.trailIndex];
    this.trailDecay.uniforms.tPrev.value = read.texture;
    this.trailDecay.uniforms.uDecay.value = useTrail ? Math.exp(-dt / Math.max(STAGE.ballTrail.fadeSeconds, 0.001)) : 0;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(write);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.trailScene, this.trailCamera);
    if (useTrail) {
      const u = this.cloud.material.uniforms;
      const size = u.uSizeScale.value;
      u.uBallOnly.value = 1;
      u.uSizeScale.value = this.trailSizeScale;
      this.renderOnlyCloud();
      u.uBallOnly.value = 0;
      u.uSizeScale.value = size;
    }
    this.renderer.setRenderTarget(prev);
    this.trailIndex = 1 - this.trailIndex;
    this.trailPass.uniforms.tTrail.value = this.trailTargets[this.trailIndex].texture;
  }

  /** Drops the pixel ratio a step at a time if the GPU cannot hold a usable frame rate. */
  private adaptQuality(dt: number) {
    if (dt > 1 / 26) this.lowFpsTime += dt;
    else this.lowFpsTime = Math.max(0, this.lowFpsTime - dt * 0.5);
    if (this.lowFpsTime > 2.5 && this.pixelRatio > 0.75) {
      this.lowFpsTime = 0;
      this.pixelRatio = Math.max(0.75, this.pixelRatio * 0.8);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(window.innerWidth, window.innerHeight);
      this.star.material.uniforms.uSize.value = STAGE.pointerStar.size * this.pixelRatio;
      this.trailSizeScale = STAGE.ballTrail.scale / this.pixelRatio;
    }
  }

  private tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsed += dt;

    // Nothing is on screen and nothing is coming: skip the GPU work entirely.
    const idle = this.fade <= 0 && this.fadeDir === 'none' && !(this.allowShow && this.pending);
    if (idle && !this.frameDirty) return;
    this.frameDirty = false;

    this.updateFade(dt);
    this.updateField(dt);
    const tracked = this.updateTracking(dt);
    this.updateCamera(dt, tracked);
    this.updateScrub(dt);
    this.updateTrail(dt);
    this.adaptQuality(dt);
    this.composer.render(dt);
  };
}
