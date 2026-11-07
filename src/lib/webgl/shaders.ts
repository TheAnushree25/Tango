/* All GLSL for the stage. Three.js compiles these as GLSL ES 3.00, so derivatives are available. */

/**
 * Cursor force field, shared by the cloud, the ambient dust and the terrain stipple.
 * Works in aspect-corrected NDC so the void is round on any window shape. It maps the disc around
 * the cursor onto an annulus (leaving a hole), and adds a little vortex so it feels like liquid.
 */
export const FIELD_GLSL = /* glsl */ `
  vec2 cursorField(
    vec2 ndc, vec2 cursor, float aspect,
    float radius, float power, float clearRatio, float swirl, float pinRadius,
    vec2 seed, out float glow, out float pinned
  ) {
    glow = 0.0;
    pinned = 0.0;
    if (power <= 0.0 || radius <= 0.0) return vec2(0.0);

    vec2 delta = vec2((ndc.x - cursor.x) * aspect, ndc.y - cursor.y);
    float dist = length(delta);
    if (dist >= radius) return vec2(0.0);

    float pin = min(pinRadius, radius * 0.5);
    if (dist <= pin) {
      pinned = 1.0;
      return vec2(0.0);
    }

    vec2 dir;
    if (dist > 1e-5) {
      dir = delta / dist;
    } else {
      float angle = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
      dir = vec2(cos(angle), sin(angle));
      dist = 1e-5;
    }

    float hole = max(radius * clamp(clearRatio, 0.0, 0.95), pin);
    float area = (dist * dist - pin * pin) * (radius * radius - hole * hole) / max(radius * radius - pin * pin, 1e-6);
    float pushedTo = sqrt(hole * hole + max(area, 0.0));

    float t = dist / radius;
    float rim = 1.0 - smoothstep(0.55, 1.0, t);
    glow = rim * clamp(power, 0.0, 1.0);

    vec2 tangent = vec2(-dir.y, dir.x);
    float twist = sin(t * 3.14159265) * swirl * radius * rim * power;
    vec2 push = dir * (pushedTo - dist) * rim * power + tangent * twist;
    return vec2(push.x / aspect, push.y);
  }
`;

const CLASS_GLSL = /* glsl */ `
  // The class map is stored as grey levels, which survive video chroma subsampling.
  // The ball is the brightest level, so the blurred edge of something else can never read as ball.
  // Returns a one-hot vector: star, ball, team, other.
  vec4 classOf(float v, float threshold) {
    float ball = step(0.875, v);
    float star = step(0.625, v) * (1.0 - ball);
    float team = step(0.375, v) * (1.0 - step(0.625, v));
    float other = step(threshold, v) * (1.0 - step(0.375, v));
    return vec4(star, ball, team, other);
  }
  float stableNoise(vec2 p) {
    vec3 q = fract(vec3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
`;

export const CLOUD_VERT = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uStrip;
  uniform float uColor;
  uniform vec2 uTexel;
  uniform float uDepthScale;
  uniform float uDepthBias;
  uniform float uDepthFov;
  uniform float uDepthSmooth;
  uniform float uDepthEdgeMax;
  uniform float uPointSize;
  uniform float uSizeScale;
  uniform float uScatter;

  uniform float uSegOn;
  uniform float uSegThreshold;
  uniform float uBallOnly;
  uniform vec4 uSegDensity;
  uniform vec4 uSegSize;
  uniform vec4 uSegBright;

  uniform vec2 uCursor;
  uniform float uFieldRadius;
  uniform float uFieldPower;
  uniform float uFieldClear;
  uniform float uFieldSwirl;
  uniform float uFieldPin;
  uniform float uHidePinned;

  attribute vec2 aUv;

  varying vec2 vColorUv;
  varying vec2 vMaskUv;
  varying vec2 vGridUv;
  varying float vGlow;
  varying float vSize;
  varying float vBright;

  ${FIELD_GLSL}
  ${CLASS_GLSL}

  void cull() {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }

  void main() {
    vec2 depthUv = vec2(aUv.x * 0.5, aUv.y * uStrip);
    vec2 maskUv = vec2(0.5 + aUv.x * 0.5, aUv.y * uStrip);
    vColorUv = vec2(aUv.x, uStrip + aUv.y * uColor);
    vMaskUv = maskUv;
    vGridUv = aUv;

    // Classify first: a rejected point then pays for one texture fetch instead of six.
    float m = texture2D(uAtlas, maskUv).r;
    vec4 cls = classOf(m, uSegThreshold);

    float sizeMul = 1.0;
    vBright = 1.0;
    if (uSegOn > 0.5) {
      sizeMul = dot(uSegSize, cls);
      vBright = dot(uSegBright, cls);
    }
    if (uBallOnly > 0.5) {
      if (cls.y < 0.5) { cull(); return; }
    } else if (uSegOn > 0.5 && stableNoise(aUv * 4096.0) >= dot(uSegDensity, cls)) {
      cull();
      return;
    }

    float depth = dot(texture2D(uAtlas, depthUv).rgb, vec3(0.299, 0.587, 0.114));

    // Smooth depth only among neighbours of the same class, and drop points that straddle a
    // discontinuity, otherwise they get flung along the view axis and read as streaks.
    if (uDepthSmooth > 0.0 && uSegOn > 0.5) {
      vec2 stepUv = uTexel * uDepthSmooth;
      float total = depth, weight = 1.0, lo = depth, hi = depth;
      for (int i = 0; i < 4; i++) {
        vec2 off = i == 0 ? vec2(stepUv.x, 0.0) : i == 1 ? vec2(-stepUv.x, 0.0) : i == 2 ? vec2(0.0, stepUv.y) : vec2(0.0, -stepUv.y);
        vec4 clsN = classOf(texture2D(uAtlas, maskUv + off).r, uSegThreshold);
        if (dot(cls, clsN) > 0.5) {
          float d = dot(texture2D(uAtlas, depthUv + vec2(off.x * 0.5, off.y)).rgb, vec3(0.299, 0.587, 0.114));
          total += d;
          weight += 1.0;
          lo = min(lo, d);
          hi = max(hi, d);
        }
      }
      if (uDepthEdgeMax > 0.0 && hi - lo > uDepthEdgeMax) { cull(); return; }
      depth = total / weight;
    }

    vec3 outward = vec3(0.0, 0.0, 1.0);
    if (uDepthFov > 0.0) {
      outward = normalize(vec3((aUv - 0.5) * 2.0 * tan(radians(uDepthFov * 0.5)), 1.0));
    }
    vec3 pos = position + outward * (depth * uDepthScale + uDepthBias);

    // The silhouette dissolves: points near the edge of a figure flake off and hang in the air.
    // A power curve keeps most of them close, and throws only a few well clear of the body.
    if (uScatter > 0.0) {
      vec2 e = uTexel * 9.0;
      vec2 slope = vec2(
        texture2D(uAtlas, maskUv + vec2(e.x, 0.0)).r - texture2D(uAtlas, maskUv - vec2(e.x, 0.0)).r,
        texture2D(uAtlas, maskUv + vec2(0.0, e.y)).r - texture2D(uAtlas, maskUv - vec2(0.0, e.y)).r
      );
      float steep = length(slope);
      float a = stableNoise(aUv * 4096.0 + 11.0);
      if (steep > 0.25 && a > 0.8) {
        float b = stableNoise(aUv * 2048.0 + 37.0);
        float reach = pow((a - 0.8) / 0.2, 3.0) * 0.03 * uScatter;
        vec2 away = -slope / steep + (vec2(b, a) - 0.5) * 0.9;
        pos.xy += away * reach * vec2(0.5625, 1.0);
        pos.z += (b - 0.5) * reach * 160.0;
      }
    }

    vec4 view = modelViewMatrix * vec4(pos, 1.0);
    float camDist = -view.z;
    vec4 clip = projectionMatrix * view;

    float glow = 0.0;
    float pinned = 0.0;
    if (clip.w > 0.0) {
      float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
      clip.xy += cursorField(clip.xy / clip.w, uCursor, aspect, uFieldRadius, uFieldPower, uFieldClear, uFieldSwirl, uFieldPin, aUv, glow, pinned) * clip.w;
    }
    vGlow = glow;

    gl_Position = clip;

    float size = uPointSize * (50.0 / max(camDist, 0.01)) * sizeMul * uSizeScale * (1.0 + glow * 0.45);
    size = clamp(size, 0.5, 32.0);
    gl_PointSize = size;
    vSize = size;

    if (uHidePinned > 0.5 && pinned > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

export const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uOpacity;
  uniform float uAlphaThreshold;
  uniform float uEmissive;
  uniform float uMaskRadius;
  uniform float uMaskSmoothness;
  uniform float uSaturation;
  uniform float uSegOn;
  uniform float uSegThreshold;

  varying vec2 vColorUv;
  varying vec2 vMaskUv;
  varying vec2 vGridUv;
  varying float vGlow;
  varying float vSize;
  varying float vBright;

  void main() {
    float m = texture2D(uAtlas, vMaskUv).r;
    // In a class map any level above the threshold is fully present, in a plain matte the value is alpha.
    float coverage = uSegOn > 0.5 ? smoothstep(uSegThreshold, uSegThreshold + 0.06, m) : m;
    if (coverage < uAlphaThreshold) discard;

    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float r = length(c);
    if (r > 1.0) discard;

    vec3 tex = texture2D(uAtlas, vColorUv).rgb;
    float luma = dot(tex, vec3(0.299, 0.587, 0.114));
    vec3 col = mix(vec3(luma), tex, uSaturation) * (1.0 + uEmissive) * (1.0 + vGlow * 0.9) * vBright;

    // At 2-3 px a hard disc fills its whole quad. Feathering the rim by one pixel keeps it round.
    float feather = clamp(2.0 / max(vSize, 1.0), 0.04, 1.0);
    float edge = 1.0 - smoothstep(1.0 - feather, 1.0, r);

    float vignette = 1.0 - smoothstep(uMaskRadius - uMaskSmoothness, uMaskRadius, length(vGridUv - 0.5));
    gl_FragColor = vec4(col, edge * coverage * uOpacity * vignette);
  }
`;

export const TERRAIN_VERT = /* glsl */ `
  uniform float uDotPitch;
  varying float vHeight;
  varying float vDepth;
  varying vec2 vGrid;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vDepth = -view.z;
    vHeight = position.y;
    vGrid = position.xz / max(uDotPitch, 1e-4);
    gl_Position = projectionMatrix * view;
  }
`;

/** The ground is a real surface, stippled per pixel: dots keep their place and never crawl or moire. */
export const TERRAIN_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform float uHeightScale;
  uniform float uHeightOffset;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uBaseAlpha;
  uniform float uBrightness;
  uniform float uCoverage;
  uniform float uJitter;

  uniform vec2 uCursor;
  uniform float uFieldRadius;
  uniform float uFieldPower;
  uniform float uFieldClear;
  uniform float uFieldSwirl;
  uniform float uFieldPin;
  uniform float uHidePinned;
  uniform vec2 uViewport;
  uniform float uAspect;

  varying float vHeight;
  varying float vDepth;
  varying vec2 vGrid;

  ${FIELD_GLSL}

  vec2 cellRandom(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
  }

  void main() {
    vec2 grid = vGrid;
    vec2 gx = dFdx(grid);
    vec2 gy = dFdy(grid);

    // Walk the cursor offset back through the lattice so the stipple flows around the void.
    float glow = 0.0;
    float pinned = 0.0;
    if (uFieldPower > 0.0 && uFieldRadius > 0.0) {
      vec2 ndc = gl_FragCoord.xy / uViewport * 2.0 - 1.0;
      vec2 off = cursorField(ndc, uCursor, uAspect, uFieldRadius, uFieldPower, uFieldClear, uFieldSwirl, uFieldPin, grid, glow, pinned);
      grid -= gx * (off.x * uViewport.x * 0.5) + gy * (off.y * uViewport.y * 0.5);
      if (uHidePinned > 0.5 && pinned > 0.5) discard;
    }

    vec2 cell = floor(grid);
    vec2 local = grid - cell;
    float nearest = 1e9;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 wander = (cellRandom(cell + o) - 0.5) * uJitter;
        nearest = min(nearest, length(local - (o + 0.5 + wander)));
      }
    }

    float radius = uCoverage * 0.5;
    float px = max(length(fwidth(grid)), 1e-5);
    float dots = 1.0 - smoothstep(radius - px * 0.5, radius + px * 0.5, nearest);

    // Below about two fragments per cell there is nothing to resolve: use the average coverage.
    float mean = clamp(3.14159265 * radius * radius, 0.0, 1.0);
    dots = mix(dots, mean, clamp(px * 0.7 - 0.35, 0.0, 1.0));
    if (dots <= 0.002) discard;

    float h = clamp(vHeight * uHeightScale + uHeightOffset, 0.0, 1.0);
    vec3 col = h < 0.5 ? mix(uLow, uMid, h * 2.0) : mix(uMid, uHigh, (h - 0.5) * 2.0);
    col *= 1.0 + glow * 0.5;

    float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDepth);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    gl_FragColor = vec4(mix(col, uFogColor, fog), dots * fade * uBaseAlpha * uBrightness);
  }
`;

export const DUST_VERT = /* glsl */ `
  uniform float uPointSize;
  uniform float uMinPointPx;
  uniform vec2 uCursor;
  uniform float uFieldRadius;
  uniform float uFieldPower;
  uniform float uFieldClear;
  uniform float uFieldSwirl;
  uniform float uFieldPin;
  uniform float uHidePinned;

  varying float vHeight;
  varying float vDepth;
  varying float vGlow;
  varying float vAtten;

  ${FIELD_GLSL}

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vDepth = -view.z;
    vHeight = position.y;
    vec4 clip = projectionMatrix * view;

    float glow = 0.0;
    float pinned = 0.0;
    if (clip.w > 0.0) {
      float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
      clip.xy += cursorField(clip.xy / clip.w, uCursor, aspect, uFieldRadius, uFieldPower, uFieldClear, uFieldSwirl, uFieldPin, position.xz, glow, pinned) * clip.w;
    }
    vGlow = glow;
    gl_Position = clip;

    // A point narrower than a pixel still lights a whole pixel, which sparkles at distance.
    // Clamp the size up and dim by the area ratio so each point deposits the light it should.
    float lit = uPointSize / vDepth * (1.0 + glow * 0.35);
    float drawn = max(lit, uMinPointPx);
    vAtten = min(1.0, (lit * lit) / (drawn * drawn));
    gl_PointSize = clamp(drawn, 0.3, 50.0);

    if (uHidePinned > 0.5 && pinned > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

export const DUST_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform float uHeightScale;
  uniform float uHeightOffset;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uBaseAlpha;
  uniform vec2 uDisc;

  varying float vHeight;
  varying float vDepth;
  varying float vGlow;
  varying float vAtten;

  void main() {
    float r = length((gl_PointCoord - 0.5) * 2.0);
    if (r > 1.0) discard;
    float a = 1.0 - smoothstep(uDisc.x, uDisc.y, r);
    float h = clamp(vHeight * uHeightScale + uHeightOffset, 0.0, 1.0);
    vec3 col = h < 0.5 ? mix(uLow, uMid, h * 2.0) : mix(uMid, uHigh, (h - 0.5) * 2.0);
    col *= 1.0 + vGlow * 0.5;
    float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDepth);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    gl_FragColor = vec4(mix(col, uFogColor, fog), a * fade * uBaseAlpha * vAtten);
  }
`;

export const STAR_VERT = /* glsl */ `
  uniform vec2 uNdc;
  uniform float uSize;
  uniform float uOrbitRadius;
  uniform float uOrbitAngle;
  uniform float uCount;
  attribute float aIndex;
  void main() {
    vec2 pos = uNdc;
    if (uOrbitRadius > 0.0) {
      float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
      float a = uOrbitAngle + aIndex * 6.2831853 / max(uCount, 1.0);
      pos += vec2(cos(a) * uOrbitRadius / aspect, sin(a) * uOrbitRadius);
    }
    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = uSize;
  }
`;

export const STAR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uOrbitRadius;
  uniform float uOrbitAngle;

  // Signed distance to a five-pointed star, by folding the plane across its mirror axes.
  float starSdf(vec2 p, float r, float inner) {
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = inner * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
  }

  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y);
    if (uOrbitRadius > 0.0) {
      float s = sin(uOrbitAngle);
      float c = cos(uOrbitAngle);
      p = mat2(c, -s, s, c) * p;
    }
    float d = starSdf(p, 0.34, 0.45);
    float body = 1.0 - smoothstep(0.0, 0.025, d);
    float halo = exp(-14.0 * max(d, 0.0)) * uGlow;
    float a = clamp(body + halo, 0.0, 1.0) * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uColor * (body + halo * 0.8), a);
  }
`;

export const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const VIGNETTE_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uOffset;
  uniform float uDarkness;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec4 src = texture2D(tDiffuse, vUv);
    float d = length((vUv - 0.5) * 2.0);
    float keep = smoothstep(uOffset + 0.55, uOffset, d);
    gl_FragColor = vec4(mix(uColor, src.rgb, mix(1.0 - uDarkness, 1.0, keep)), src.a);
  }
`;

export const TRAIL_ADD_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tTrail;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec4 base = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(base.rgb + texture2D(tTrail, vUv).rgb * uColor * uIntensity, base.a);
  }
`;

export const TRAIL_DECAY_FRAG = /* glsl */ `
  uniform sampler2D tPrev;
  uniform float uDecay;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(tPrev, vUv).rgb * uDecay, 1.0);
  }
`;
