import { gsap } from 'gsap';

/** The five project curves. They are shared by GSAP (JS) and CSS (see globals.css). */
export const BEZIER = {
  soft: [0.48, 0.04, 0.52, 0.96],
  softOut: [0.16, 0.84, 0.44, 1],
  softIn: [0.72, 0, 0.84, 0.26],
  emphasis: [0.38, 0.02, 0.2, 1],
  settle: [0.33, 1, 0.58, 1],
  trace: [0.63, 0.32, 0.13, 0.99],
} as const;

export type EaseName = keyof typeof BEZIER;

export const cssEase = (name: EaseName) => {
  const [a, b, c, d] = BEZIER[name];
  return `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
};

/** Newton-Raphson cubic-bezier solver. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(t);
  };
}

let registered = false;

/** Registers ease.soft, ease.softOut, ... with GSAP. Safe to call repeatedly. */
export function registerEases() {
  if (registered) return;
  registered = true;
  (Object.keys(BEZIER) as EaseName[]).forEach((name) => {
    const [a, b, c, d] = BEZIER[name];
    gsap.registerEase(`ease.${name}`, bezier(a, b, c, d));
  });
}
