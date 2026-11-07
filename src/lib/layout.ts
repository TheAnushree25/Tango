/**
 * The controller is drawn in a 1240 x 900 box (the viewBox), and scales with the window.
 * Goals sit on two curves that follow the big circle, one for each side of the screen.
 */
export const VIEW_W = 1240;
export const VIEW_H = 900;
export const CIRCLE_VIEW = 1240;
export const CIRCLE_R = 619.5;

type Pt = { x: number; y: number };
type Seg = { p0: Pt; p1: Pt; p2: Pt; p3: Pt };

export const LEFT_SEGMENTS: Seg[] = [
  { p0: { x: 195, y: 0 }, p1: { x: 195, y: 0 }, p2: { x: 0, y: 164 }, p3: { x: 0, y: 450 } },
  { p0: { x: 0, y: 450 }, p1: { x: 0, y: 736 }, p2: { x: 195, y: 900 }, p3: { x: 195, y: 900 } },
];
export const RIGHT_SEGMENTS: Seg[] = [
  { p0: { x: 1045, y: 900 }, p1: { x: 1045, y: 900 }, p2: { x: 1240, y: 736 }, p3: { x: 1240, y: 450 } },
  { p0: { x: 1240, y: 450 }, p1: { x: 1240, y: 164 }, p2: { x: 1045, y: 0 }, p3: { x: 1045, y: 0 } },
];

function bezierPoint({ p0, p1, p2, p3 }: Seg, t: number): Pt {
  const m = 1 - t;
  return {
    x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
    y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Places items by arc length around the middle of a path. The middle stays free for the arrow button.
 * Returns goals (around the middle), plus optional extras further out at either end.
 */
export function layoutOnPath(segments: Seg[], goals: number, before: number, after: number, gap: number, samplesPerSeg = 200) {
  const samples: Pt[] = [];
  segments.forEach((seg, i) => {
    for (let s = 0; s <= samplesPerSeg; s++) {
      if (i > 0 && s === 0) continue;
      samples.push(bezierPoint(seg, s / samplesPerSeg));
    }
  });
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) {
    lengths[i] = lengths[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  const total = lengths[lengths.length - 1] ?? 0;
  const mid = total / 2;
  const lowerCount = Math.floor(goals / 2);
  const upperCount = Math.ceil(goals / 2);
  const startCount = before + lowerCount;
  const endCount = after + upperCount;
  let step = gap;
  if (startCount > 0) step = Math.min(step, mid / startCount);
  if (endCount > 0) step = Math.min(step, (total - mid) / endCount);

  const pointAt = (distance: number) => {
    const idx = lengths.findIndex((l) => l >= distance);
    return samples[idx === -1 ? samples.length - 1 : idx];
  };
  const beforePts: Pt[] = [];
  for (let e = startCount; e > lowerCount; e--) beforePts.push(pointAt(mid - e * step));
  const goalPts: Pt[] = [];
  for (let e = lowerCount; e >= 1; e--) goalPts.push(pointAt(mid - e * step));
  for (let e = 1; e <= upperCount; e++) goalPts.push(pointAt(mid + e * step));
  const afterPts: Pt[] = [];
  for (let e = upperCount + 1; e <= endCount; e++) afterPts.push(pointAt(mid + e * step));
  return { before: beforePts, goals: goalPts, after: afterPts };
}

/** The x of the big circle at a given y, on either side. */
export function circlePointAtY(y: number, side: 'left' | 'right'): Pt {
  const dy = Math.max(-620, Math.min(620, y - 450));
  const half = Math.sqrt(Math.max(0, 620 * 620 - dy * dy));
  return { x: side === 'left' ? 620 - half : 620 + half, y: 450 + dy };
}

/** How far around the circle a point is, counter-clockwise from the top, as a fraction of one turn. */
export function circleProgressOf(p: Pt) {
  const angle = Math.atan2(620 - p.x, 450 - p.y);
  const a = angle < 0 ? angle + Math.PI * 2 : angle;
  return a / (Math.PI * 2);
}

/** Shortest signed distance between two positions on a ring of `count` items. */
export function ringDelta(from: number, to: number, count: number) {
  if (count <= 0) return 0;
  let d = ((to - from) % count + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

export function normalizeDeg(a: number) {
  const n = (((a + 180) % 360) + 360) % 360 - 180;
  return n === -180 ? 180 : n;
}

export type LabelSide = 'left' | 'right' | 'top' | 'bottom';

export function labelSideFromAngle(a: number, tolerance = 16): LabelSide {
  if (Math.abs(normalizeDeg(a + 90)) <= tolerance) return 'top';
  if (Math.abs(normalizeDeg(a - 90)) <= tolerance) return 'bottom';
  return Math.abs(normalizeDeg(a)) < 90 ? 'right' : 'left';
}
