import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { registerEases } from './ease';
import { emit, EV } from './events';

/**
 * The whole opening sequence as one GSAP timeline.
 *
 *  grid lines open from the centre
 *  -> dotted ring draws itself
 *  -> timeline PAUSES on the gate: cover cloud, title, description and ENTER appear
 *  -> ENTER fades the gate away and the timeline resumes:
 *     main ring scales up, brand and footer arrive, the stage fades in, buttons and goals pop in
 *     from the middle outwards, and last of all the statistics slide up.
 */
const CFG = {
  startDelay: 0.05,
  grid: { duration: 1.1, stagger: 0.04, ease: 'ease.soft', opacityFrom: 0.6, restAt: 0.5 },
  ring: { draw: 2, drawEase: 'ease.trace', scale: 0.7, scaleEase: 'ease.softOut', from: 0.5 },
  goals: { duration: 0.4, stagger: 0.2, ease: 'ease.softOut' },
  label: { duration: 0.4, ease: 'ease.soft' },
  brand: { duration: 0.7, ease: 'ease.soft', decoOffset: 20 },
  stats: { duration: 0.7, ease: 'ease.softOut' },
  gate: {
    fadeIn: 0.4,
    fadeOut: 0.4,
    fadeOutEase: 'ease.settle',
    groupStagger: 0.06,
    title: { charStagger: 0.1, wordStagger: 0.15, duration: 0.4, ease: 'ease.soft' },
    lineFrom: { yPercent: 320, rotate: 10 },
    lineTo: { yPercent: 0, rotate: 0, ease: 'ease.softOut', duration: 0.7, stagger: 0.07 },
    enterBtn: { duration: 0.4, ease: 'ease.softOut' },
  },
};

const DESKTOP = '(min-width: 1024px)';

const all = (selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(selector));
const one = (selector: string, root: ParentNode = document) => root.querySelector<HTMLElement>(selector);
const reveal = (els: Element[]) => els.forEach((e) => e.classList.add('ui-on'));

/** Prepares a ring's draw-on mask. Hidden means the dash is shifted exactly one circumference away. */
function setRingMask(mask: SVGCircleElement | null, drawn: boolean) {
  if (!mask) return 0;
  const len = mask.getTotalLength?.() || 2 * Math.PI * Number(mask.getAttribute('r') ?? 619.5);
  const cx = mask.getAttribute('cx') ?? '620';
  const cy = mask.getAttribute('cy') ?? '620';
  gsap.set(mask, {
    attr: { transform: `rotate(-90 ${cx} ${cy})`, 'stroke-dasharray': len, 'stroke-dashoffset': drawn ? 0 : -len },
  });
  return len;
}

/** Sorts a side's goals so the ones nearest the middle arrow appear first. */
function fromMiddle<T>(items: T[]) {
  const mid = (items.length - 1) / 2;
  return items
    .map((el, index) => ({ el, index, dist: Math.abs(index - mid) }))
    .sort((a, b) => a.dist - b.dist || a.index - b.index)
    .map((x) => x.el);
}

let timeline: gsap.core.Timeline | null = null;
let gateOpen = false;
let continuing = false;
let splits: SplitText[] = [];

function clearSplits() {
  splits.forEach((s) => {
    try {
      s.revert();
    } catch {}
  });
  splits = [];
}

function splitLines(el: HTMLElement) {
  const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', tag: 'div' });
  splits.push(split);
  gsap.set(split.lines, CFG.gate.lineFrom);
  el.classList.add('ui-on');
  gsap.set(el, { opacity: 1 });
  return split.lines;
}

function revealGate(root: ParentNode) {
  emit(EV.showCover);
  const persist = new Set(all('.gate-persist', root));
  const titles = all('.gate-title', root);
  const desc = one('.gate-desc', root);
  const enter = one('.gate-enter', root);
  const enterBtn = one('.gate-enter-btn', root);
  const enterLabel = one('.gate-enter-label', root);
  const corners = all('.ui-corner-tl, .ui-corner-tr, .ui-corner-bl, .ui-corner-br', root);
  const desktop = window.matchMedia(DESKTOP).matches;
  const special = new Set<Element>([...titles, ...(desc ? [desc] : []), ...(enter ? [enter] : [])]);
  const simple = all('.gate-item', root).filter((el) => !special.has(el) && (desktop || !persist.has(el)));

  clearSplits();
  const g = CFG.gate;
  const tl = gsap.timeline();

  if (simple.length) {
    tl.fromTo(simple, { opacity: 0 }, { opacity: 1, duration: g.fadeIn, ease: 'ease.soft', onStart: () => reveal(simple) }, 0);
  }

  titles.forEach((title, i) => {
    const split = new SplitText(title, { type: 'chars,words,lines', tag: 'span' });
    splits.push(split);
    gsap.set(split.chars, { opacity: 0 });
    title.classList.add('ui-on');
    gsap.set(title, { opacity: 1 });
    tl.to(split.chars, { opacity: 1, stagger: g.title.charStagger, duration: g.title.duration, ease: g.title.ease }, i * g.title.wordStagger);
  });

  if (desc) {
    const lines = splitLines(desc);
    if (lines.length) tl.to(lines, g.lineTo, g.groupStagger);
  }

  const at = g.groupStagger * 2;
  if (enter) {
    enter.classList.add('ui-on');
    gsap.set(enter, { opacity: 1 });
  }
  if (enterBtn) {
    gsap.set(enterBtn, { scale: 0, transformOrigin: '50% 50%' });
    tl.to(enterBtn, { scale: 1, duration: g.enterBtn.duration, ease: g.enterBtn.ease }, at);
  }
  if (enterLabel) {
    const lines = splitLines(enterLabel);
    if (lines.length) tl.to(lines, g.lineTo, at);
  }

  if (corners.length) {
    reveal(corners);
    tl.fromTo(corners, { opacity: 0 }, { opacity: 1, x: 0, y: 0, duration: CFG.brand.duration, ease: CFG.brand.ease }, 0);
  }

  gateOpen = true;
  timeline?.pause();
}

/** Builds and starts the intro. Returns a cleanup function. */
export function startIntro(root: ParentNode = document) {
  registerEases();
  gsap.registerPlugin(SplitText);
  // One intro serves every route, and the text pages have no goals or statistics for it to reveal.
  gsap.config({ nullTargetWarn: false });

  const offset = CFG.brand.decoOffset;
  const circle = one('.ui-circle', root);
  const mainMask = root.querySelector<SVGCircleElement>('.ui-circle-mask');
  const gateCircle = one('.gate-circle', root);
  const gateMask = root.querySelector<SVGCircleElement>('.gate-circle-mask');
  const gridV = all('.ui-grid-v', root);
  const gridH = all('.ui-grid-h', root);
  const navBtns = all('.ui-nav-btn', root);
  const navLabels = all('.ui-nav-label', root);
  const goalsLeft = fromMiddle(all('.ui-goal-left', root));
  const goalsRight = fromMiddle(all('.ui-goal-right', root));
  const records = all('.ui-record', root);
  const brand = all('.ui-brand', root);
  const foot = all('.ui-foot', root);
  const stats = all('.ui-stats', root);
  const gateItems = all('.gate-item', root);
  const desktop = window.matchMedia(DESKTOP).matches;

  setRingMask(mainMask, true);
  setRingMask(gateMask, false);
  if (circle) gsap.set(circle, { scale: CFG.ring.from, transformOrigin: '50% 50%', autoAlpha: 0 });
  if (gateCircle) gsap.set(gateCircle, { autoAlpha: 1 });
  gsap.set(navBtns, { scale: 0, transformOrigin: '50% 50%' });
  gsap.set([...goalsLeft, ...goalsRight], { scale: 0, transformOrigin: '50% 50%' });
  gsap.set([...navLabels, ...records, ...brand, ...gateItems], { opacity: 0 });
  gsap.set(stats, { opacity: 0, y: 16 });

  gsap.set(all('.ui-corner-tl', root), { opacity: 0, x: -offset, y: -offset });
  gsap.set(all('.ui-corner-tr', root), { opacity: 0, x: offset, y: -offset });
  gsap.set(all('.ui-corner-bl', root), { opacity: 0, x: -offset, y: offset });
  gsap.set(all('.ui-corner-br', root), { opacity: 0, x: offset, y: offset });
  gsap.set(foot, { opacity: 0, x: 0, y: offset });

  const tl = gsap.timeline({
    delay: CFG.startDelay,
    onComplete: () => document.documentElement.classList.add('ui-enter-complete'),
  });
  timeline = tl;

  const g = CFG.grid;
  const count = Math.max(gridV.length, gridH.length);
  const restAt = (count > 0 ? g.duration + g.stagger * Math.floor((count - 1) / 2) : 0) * g.restAt;

  const open = (els: HTMLElement[], from: string) => {
    if (!els.length) return;
    tl.fromTo(
      els,
      { clipPath: from, opacity: g.opacityFrom },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        opacity: 0.02,
        stagger: { each: g.stagger, from: 'center' },
        duration: g.duration,
        ease: g.ease,
        onStart: () => reveal(els),
        onComplete: () => gsap.set(els, { clearProps: 'clipPath' }),
      },
      0,
    );
  };
  open(gridV, 'inset(50% 0 50% 0)');
  open(gridH, 'inset(0 50% 0 50%)');

  // Step one: the dotted ring draws on, then the sequence waits at the gate.
  if (gateMask) {
    reveal(gateCircle ? [gateCircle] : []);
    tl.to(gateMask, { attr: { 'stroke-dashoffset': 0 }, duration: CFG.ring.draw, ease: CFG.ring.drawEase }, restAt);
  }
  const atGate = restAt + (gateMask ? CFG.ring.draw : 0);
  tl.call(() => revealGate(root), undefined, atGate);

  const resume = atGate + 0.001;
  if (circle) {
    tl.to(circle, {
      scale: 1,
      duration: CFG.ring.scale,
      ease: CFG.ring.scaleEase,
      onStart: () => reveal([circle]),
      onComplete: () => emit(EV.circleScaled),
    }, resume);
  }
  if (brand.length && desktop) {
    tl.fromTo(brand, { opacity: 0 }, { opacity: 1, duration: CFG.brand.duration, ease: CFG.brand.ease, onStart: () => reveal(brand), onComplete: () => gsap.set(brand, { clearProps: 'opacity' }) }, resume);
  }
  if (foot.length) {
    tl.fromTo(foot, { opacity: 0, x: 0, y: offset }, { opacity: 1, x: 0, y: 0, duration: CFG.brand.duration, ease: CFG.brand.ease, onStart: () => reveal(foot), onComplete: () => gsap.set(foot, { clearProps: 'opacity,transform' }) }, resume);
  }

  tl.addLabel('goals');
  tl.call(() => emit(EV.fadeInStage), undefined, 'goals');

  if (navBtns.length) {
    tl.to(navBtns, { scale: 1, duration: CFG.goals.duration, ease: CFG.goals.ease, onStart: () => reveal(navBtns) }, 'goals');
  }
  if (navLabels.length) {
    tl.fromTo(navLabels, { opacity: 0 }, { opacity: 1, duration: CFG.label.duration, ease: CFG.label.ease, onStart: () => reveal(navLabels), onComplete: () => gsap.set(navLabels, { clearProps: 'opacity' }) }, 'goals');
  }
  if (!desktop && brand.length) {
    const persist = all('.gate-persist', root);
    const els = [...brand, ...persist];
    tl.fromTo(els, { opacity: 0 }, { opacity: 1, duration: CFG.label.duration, ease: CFG.label.ease, onStart: () => reveal(els) }, 'goals');
  }
  if (records.length) {
    tl.fromTo(records, { opacity: 0 }, { opacity: 1, duration: CFG.label.duration, ease: CFG.label.ease, onStart: () => reveal(records), onComplete: () => gsap.set(records, { clearProps: 'opacity' }) }, 'goals');
  }

  const rows = Math.max(goalsLeft.length, goalsRight.length);
  for (let i = 0; i < rows; i++) {
    const pair = [goalsLeft[i], goalsRight[i]].filter(Boolean);
    if (!pair.length) continue;
    const at = CFG.goals.stagger * (navBtns.length ? i + 1 : i);
    tl.to(pair, { scale: 1, duration: CFG.goals.duration, ease: CFG.goals.ease, onStart: () => reveal(pair) }, `goals+=${at}`);
  }
  const lastAt = rows ? CFG.goals.stagger * (navBtns.length ? rows : rows - 1) : 0;
  tl.call(() => emit(EV.goalsRevealed), undefined, `goals+=${lastAt + CFG.goals.duration}`);

  if (stats.length) {
    tl.to(stats, {
      opacity: 1,
      y: 0,
      duration: CFG.stats.duration,
      ease: CFG.stats.ease,
      onStart: () => {
        reveal(stats);
        emit(EV.statsStart);
      },
    }, '>');
  } else {
    tl.call(() => emit(EV.statsStart));
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) tl.timeScale(20);

  return () => {
    tl.kill();
    clearSplits();
    timeline = null;
    gateOpen = false;
  };
}

/** ENTER: fades the gate away, then lets the paused timeline run on. */
export function continueFromGate(root: ParentNode = document) {
  if (continuing || !gateOpen || !timeline) return;
  continuing = true;
  gateOpen = false;
  document.documentElement.classList.add('ui-entered');
  emit(EV.hideCover);
  const tl = timeline;
  const persist = new Set(all('.gate-persist', root));
  const items = all('.gate-item', root).filter((el) => !persist.has(el));
  const corners = all('.ui-corner-bl, .ui-corner-br', root);
  const gateCircle = one('.gate-circle', root);
  const circle = one('.ui-circle', root);
  const overlay = one('[data-gate-overlay]', root);
  const fading = [...items, ...corners, ...(gateCircle ? [gateCircle] : [])];
  gsap.to(fading, {
    opacity: 0,
    duration: CFG.gate.fadeOut,
    ease: CFG.gate.fadeOutEase,
    onComplete: () => {
      clearSplits();
      if (circle) gsap.set(circle, { scale: CFG.ring.from, transformOrigin: '50% 50%', autoAlpha: 1 });
      if (gateCircle) gsap.set(gateCircle, { autoAlpha: 0 });
      if (overlay) gsap.set(overlay, { autoAlpha: 0 });
      emit(EV.enterDone);
      tl.resume();
      continuing = false;
    },
  });
}
