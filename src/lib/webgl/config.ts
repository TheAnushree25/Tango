/**
 * Every tunable of the stage. Scene lists at the bottom point at the generated assets in /public.
 * Atlas layout (image or video): the colour plate fills the top, and the strip below it holds
 * depth (left half, grayscale, white = near) and the mask or class map (right half).
 *
 * Class map grey levels: 1.0 = ball, 0.75 = star player, 0.5 = other players,
 * 0.25 = everything else (pitch lines, goal frame), 0 = nothing.
 */
export type Vec3 = [number, number, number];

export type SceneSpec = {
  id: string;
  kind: 'image' | 'video';
  src: string;
  atlasHeight: number;
  colorHeight: number;
  cols: number;
  rows: number;
  pointSize: number;
  depthScale: number;
  /** Added to every point. Atlases use the full 8-bit range for the figure, so the offset lives here. */
  depthBias?: number;
  emissive?: number;
  saturation?: number;
  segmentation: boolean;
  videoPosition: Vec3;
  terrainPosition: Vec3;
  terrainRotation: Vec3;
  terrainPitch?: number;
  terrainCoverage?: number;
  terrainBrightness?: number;
  terrainHeightMult?: number;
  depthFov?: number;
  audio?: string;
  audioVolume?: number;
  /** How loud the music plays during this scene. Leave it out for the normal level. */
  musicVolume?: number;
  /** JSON with the star player and ball positions per frame, for the look-at tracking. */
  tracking?: string;
  cameraType?: 'tv' | 'goal_cam' | 'follow' | 'close';
};

export const STAGE = {
  scene: { background: '#030c1d', fogDensity: 0.0075 },
  camera: {
    fov: 35,
    near: 1,
    far: 10000,
    position: [0, 0, 90] as Vec3,
    lookAt: [0, 0, 0] as Vec3,
    trackFollow: 1,
    trackHz: 0.6,
    minTerrainClearance: 24,
  },
  terrain: {
    dotPitch: 0.7,
    meshResolution: 128,
    brightness: 2.2,
    jitter: 0.65,
    minPointPx: 0.5,
    width: 500,
    depth: 700,
    ridgeCenter: 1.0,
    ridgeStrength: 1.5,
    ridgeFalloff: 100,
    noiseScale: 14,
    noiseOffset: [1.4, 0.9] as [number, number],
    heightMult: 8,
    heightOffset: 23,
    edgeFadePower: 10,
    coverage: 0.05,
  },
  ambient: { heightMin: 20, heightRange: 45, pointSizeRatio: 0.55, lift: 25 },
  colors: {
    low: [0.4, 0.4, 0.4] as Vec3,
    mid: [0.5, 0.5, 0.5] as Vec3,
    bright: [0.6, 0.6, 0.6] as Vec3,
    heightScale: 3,
    heightOffset: 0,
    fadeNear: 0,
    fadeFar: 400,
    baseAlpha: 0.75,
    discInner: 0.5,
    discOuter: 0.9,
  },
  tiers: {
    high: { dprMax: 2, ambientCount: 14500, pointSize: 300, cloudScale: 1 },
    medium: { dprMax: 1.5, ambientCount: 6500, pointSize: 300, cloudScale: 0.75 },
    low: { dprMax: 1, ambientCount: 2200, pointSize: 300, cloudScale: 0.5 },
  },
  post: {
    vignetteOffset: 0.84,
    vignetteDarkness: 1.0,
    pointerAmp: 0.1,
    pointerDamping: 0.06,
    fadeDuration: 0.8,
    cameraAnimDuration: 1.2,
    bloomStrength: 0.06,
    bloomRadius: 0.04,
    bloomThreshold: 0.01,
    parallaxAmp: 0.01,
    pointerRotAmp: 0.3,
    scrubSmoothing: 30,
    scrubSensitivity: 0.8,
  },
  cloud: {
    depthBias: 1,
    emissive: 0,
    depthSmoothRadius: 1,
    depthEdgeMax: 0.055,
    opacity: 1,
    pointSize: 7,
    maskRadius: 0.7,
    maskSmoothness: 0.5,
    alphaThreshold: 0.5,
    saturation: 1.1,
    field: {
      radius: 0.15,
      strength: 0.95,
      clear: 0.75,
      swirl: 0.35,
      pin: 0.006,
      damping: 0.2,
      moveScale: 0.05,
      growRate: 1.8,
      shrinkRate: 6,
    },
  },
  segmentation: {
    threshold: 0.12,
    // star, ball, team, other
    density: [1, 1, 0.9, 0.85] as [number, number, number, number],
    size: [1.3, 1.7, 1, 1] as [number, number, number, number],
    brightness: [1, 1.2, 1, 1] as [number, number, number, number],
  },
  ballTrail: { enabled: true, scale: 0.4, fadeSeconds: 0.03, intensity: 1.1, color: [1, 0.92, 0.7] as Vec3 },
  pointerStar: {
    enabled: true,
    size: 22,
    color: [1, 0.78, 0.28] as Vec3,
    glow: 0.9,
    fadeRange: [0.5, 0.95] as [number, number],
    orbit: { count: 3, radiusScale: 0.5, speed: 0.12 },
  },
};

/** Shown under the cursor when it rests on the figure: every point stands for somebody. */
export const FAN_NAMES = [
  'Ada', 'Alma', 'Amara', 'Andre', 'Anika', 'Arlo', 'Aya', 'Bea', 'Ben', 'Bruna', 'Caleb', 'Carmen', 'Cleo', 'Dante', 'Dara', 'Diego',
  'Dina', 'Eli', 'Elena', 'Emeka', 'Enzo', 'Esme', 'Farah', 'Felix', 'Flora', 'Gael', 'Gia', 'Hana', 'Hugo', 'Ines', 'Ivan', 'Jada',
  'Jonas', 'Jude', 'Kai', 'Kaya', 'Kofi', 'Lara', 'Leo', 'Lia', 'Luca', 'Luna', 'Maia', 'Marco', 'Mateo', 'Maya', 'Mila', 'Milan',
  'Mina', 'Nadia', 'Naomi', 'Nico', 'Nina', 'Noah', 'Noor', 'Oda', 'Omar', 'Otto', 'Paula', 'Pedro', 'Priya', 'Quinn', 'Rafa', 'Rania',
  'Remy', 'Rosa', 'Ruben', 'Sade', 'Sami', 'Sara', 'Selin', 'Sofia', 'Tariq', 'Tessa', 'Theo', 'Tomas', 'Uma', 'Vera', 'Vito', 'Wren',
  'Yara', 'Yuki', 'Zaid', 'Zoe',
];

const COVER_BASE = {
  kind: 'image' as const,
  atlasHeight: 1620,
  colorHeight: 1080,
  emissive: 0.05,
  saturation: 1,
  segmentation: false,
};

export const COVER: SceneSpec = {
  ...COVER_BASE,
  id: 'cover',
  src: '/webgl/hero_atlas.webp',
  cols: 640,
  rows: 420,
  pointSize: 7,
  depthScale: 29.2,
  depthBias: 70.4,
  videoPosition: [0, 5, -105],
  terrainPosition: [0, -32, 0],
  terrainRotation: [0, 0, 0],
  audio: '/audio/anthem',
};

const record = (i: number, audio: string, y: number): SceneSpec => ({
  ...COVER_BASE,
  id: `record-${i}`,
  src: `/webgl/record_${i}_atlas.webp`,
  cols: 640,
  rows: 420,
  pointSize: 8,
  depthScale: 29.2,
  depthBias: 21.4,
  videoPosition: [0, y, -80],
  terrainPosition: [0, -28, 0],
  terrainRotation: [0, 0, 0],
  terrainHeightMult: 28,
  depthFov: 0.1,
  audio,
  audioVolume: 0.5,
});

export const RECORD_SCENES: SceneSpec[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
  record(i, i % 2 ? '/audio/crowd2' : '/audio/crowd1', [0, 0, -3, 1, -3, 0, -3, -3, 0][i]),
);

const clip = (
  id: string,
  file: string,
  cameraType: SceneSpec['cameraType'],
  over: Partial<SceneSpec>,
): SceneSpec => ({
  id,
  kind: 'video',
  src: `/videos/${file}.mp4`,
  tracking: `/tracking/${file}.json`,
  atlasHeight: 1620,
  colorHeight: 1080,
  cols: 1440,
  rows: 810,
  pointSize: 4.5,
  depthScale: 50,
  saturation: 1.1,
  segmentation: true,
  videoPosition: [0, 8, -40],
  terrainPosition: [0, 18, -40],
  terrainRotation: [0.44, 0, 0],
  terrainPitch: 0.4,
  terrainCoverage: 0.05,
  terrainBrightness: 1.25,
  // Every clip carries commentary, so the music sits lower to keep the words clear.
  musicVolume: 0.3,
  cameraType,
  ...over,
});

const altCam = (id: string, file: string, cameraType: SceneSpec['cameraType'], over: Partial<SceneSpec> = {}): SceneSpec =>
  clip(id, file, cameraType, {
    atlasHeight: 1080,
    colorHeight: 720,
    cols: 540,
    rows: 280,
    pointSize: 7,
    depthFov: 0.1,
    terrainPosition: [0, -28, -40],
    terrainRotation: [0, 0, 0],
    terrainPitch: 0.42,
    terrainBrightness: 1.9,
    videoPosition: [0, 0, -50],
    ...over,
  });

export type GoalScene = SceneSpec & { alts: SceneSpec[] };

const goalScene = (main: SceneSpec, alts: SceneSpec[] = []): GoalScene => ({ ...main, alts });

/** One entry per goal in content.ts. Each play is rendered from the same 3D match, so the cameras agree. */
export const GOAL_SCENES: GoalScene[] = [
  goalScene(clip('g0', 'goal_0_tv', 'tv', { audio: '/audio/goal_0_call' }), [
    altCam('g0-goal', 'goal_0_goal', 'goal_cam', { audio: '/audio/goal_0_call' }),
    altCam('g0-follow', 'goal_0_follow', 'follow', { audio: '/audio/goal_0_call', videoPosition: [0, 2, -34] }),
  ]),
  goalScene(clip('g1', 'goal_1_tv', 'tv', { audio: '/audio/goal_1_call' }), []),
  goalScene(clip('g2', 'goal_2_tv', 'tv', { audio: '/audio/goal_2_call' }), [
    altCam('g2-goal', 'goal_2_goal', 'goal_cam', { audio: '/audio/goal_2_call' }),
  ]),
  goalScene(clip('g3', 'goal_3_tv', 'tv', { audio: '/audio/goal_3_call' }), [
    altCam('g3-follow', 'goal_3_follow', 'follow', { audio: '/audio/goal_3_call', videoPosition: [0, 2, -34] }),
  ]),
  goalScene(clip('g4', 'goal_4_tv', 'tv', { audio: '/audio/goal_4_call' }), []),
  goalScene(clip('g5', 'goal_5_tv', 'tv', { audio: '/audio/goal_5_call' }), []),
  goalScene(clip('g6', 'goal_6_tv', 'tv', { audio: '/audio/goal_6_call' }), [
    altCam('g6-goal', 'goal_6_goal', 'goal_cam', { audio: '/audio/goal_6_call' }),
  ]),
  goalScene(clip('g7', 'goal_7_tv', 'tv', { audio: '/audio/goal_7_call' }), [
    altCam('g7-goal', 'goal_7_goal', 'goal_cam', { audio: '/audio/goal_7_call' }),
    altCam('g7-follow', 'goal_7_follow', 'follow', { audio: '/audio/goal_7_call', videoPosition: [0, 2, -34] }),
  ]),
];

export const NOT_FOUND_SCENE: SceneSpec = {
  ...COVER_BASE,
  id: 'not-found',
  src: '/webgl/not_found_atlas.webp',
  cols: 640,
  rows: 420,
  pointSize: 4.5,
  depthScale: 29.2,
  depthBias: 70.4,
  videoPosition: [0, 5, -105],
  terrainPosition: [0, -32, 0],
  terrainRotation: [0, 0, 0],
  audio: '/audio/crowd1',
};
