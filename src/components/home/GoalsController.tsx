'use client';

import clsx from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { audio } from '@/lib/audio';
import { DICT, GOALS, type Goal } from '@/lib/content';
import { EV } from '@/lib/events';
import { circlePointAtY, circleProgressOf, layoutOnPath, LEFT_SEGMENTS, RIGHT_SEGMENTS, VIEW_H, VIEW_W } from '@/lib/layout';
import { useStore } from '@/lib/store';
import { NextButton, PrevButton } from '@/components/ui/Buttons';
import { AudioToggle, RecordsToggle } from '@/components/layout/Header';
import RecordsRing, { MobileRecordsStrip, RecordsNav } from './RecordsRing';
import { MatchLine, Possession } from './Statistics';

const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / VIEW_W) * 100}%`, top: `${(p.y / VIEW_H) * 100}%` });

const leftGoals = GOALS.slice(0, GOALS.length / 2);
const rightGoals = GOALS.slice(GOALS.length / 2);
const GOAL_GAP = 80;
const LEFT = layoutOnPath(LEFT_SEGMENTS, leftGoals.length, 0, 0, GOAL_GAP);
const RIGHT = layoutOnPath(RIGHT_SEGMENTS, rightGoals.length, 0, 1, GOAL_GAP);
const ALL_POINTS = [...LEFT.goals, ...RIGHT.goals];

function arcProgress(order: number) {
  if (order < 0) return 0;
  if (order >= GOALS.length - 1) return 1;
  return circleProgressOf(ALL_POINTS[order]);
}

function selectGoal(g: Goal) {
  audio.playBar();
  useStore.getState().setCurrentGoal(g);
  window.dispatchEvent(new CustomEvent(EV.changeGoal, { detail: g.order }));
}

function GoalDot({ goal, point, index, isRight, visible, visualOrder }: { goal: Goal; point: { x: number; y: number }; index: number; isRight: boolean; visible: boolean; visualOrder: number }) {
  const active = visualOrder === goal.order;
  const visited = visualOrder >= goal.order;
  const ring = clsx('scale-pulse absolute top-1/2 left-0 -z-1 aspect-square w-[40px] translate-x-[-16px] -translate-y-1/2 scale-120 rounded-full border border-white', active ? '!scale-100' : '!scale-0');
  return (
    <div
      role="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={`Go to goal ${goal.scoreHome}-${goal.scoreAway}`}
      onClick={() => visible && selectGoal(goal)}
      onKeyDown={(e) => {
        if (visible && (e.key === 'Enter' || e.key === ' ')) selectGoal(goal);
      }}
      className={clsx('js-hover-sound group absolute -translate-x-1/2 -translate-y-1/2 p-1 transition-opacity duration-700', visible ? 'pointer-events-auto cursor-pointer opacity-100' : 'pointer-events-none opacity-0', active && 'pointer-events-none')}
      style={pct(point)}
    >
      <div className={clsx('ui-goal flex size-1 origin-center items-center rounded-full border border-gold transition-colors duration-700 will-change-transform', visited ? 'bg-[white]' : 'bg-gold', isRight ? 'ui-goal-right justify-end' : 'ui-goal-left')}>
        <span
          className={clsx(
            'absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold opacity-0 transition-all duration-400 group-hover:h-[calc(100%+10px)] group-hover:w-[calc(100%+10px)] group-hover:opacity-60',
            active ? 'h-[calc(100%+10px)] w-[calc(100%+10px)] scale-200 border-[transparent] !opacity-100' : 'h-full w-full opacity-0',
          )}
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={clsx('transition-all duration-300', active ? 'scale-100' : 'scale-0')} src="/images/dot-cup.svg" alt="" width={24} height={24} />
          </div>
        </span>
        <div className={ring} />
        <div className={ring} style={{ animationDelay: '1.5s' }} />
        <div className={clsx('flex h-[40px] items-center rounded-full px-2 transition-all duration-300', isRight ? 'translate-x-[16px]' : '-translate-x-[16px]', active && 'bg-white')}>
          <span className={clsx('font-tertiary text-1 pointer-events-none relative block shrink-0 overflow-hidden whitespace-nowrap text-white uppercase', isRight ? 'pr-3' : 'pl-3')}>
            <span className={clsx('flex origin-top-left gap-[0.2em] transition-all duration-700 group-hover:translate-y-0 group-hover:rotate-0 group-hover:opacity-40', visited ? 'translate-y-0 rotate-0 !opacity-100' : 'translate-y-full rotate-10')} style={{ transitionDelay: `${70 * index}ms` }}>
              <span className="font-bold text-gold">
                {goal.home} {goal.scoreHome}
              </span>
              <span className={active ? 'text-black' : 'text-white'}>
                {goal.scoreAway} {goal.away}
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** The gold arc: follows the current goal around the circle, and wipes itself away when it wraps. */
function GoldArc({ enabled, order }: { enabled: boolean; order: number }) {
  const target = enabled ? arcProgress(order) : 0;
  const [span, setSpan] = useState({ start: 0, end: 0, animate: true });
  const prevOrder = useRef(order);
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const wrapped = prevOrder.current === GOALS.length - 1 && order === 0 && enabled;
    prevOrder.current = order;
    if (wrapped) {
      setSpan({ start: 1, end: 1, animate: true });
      const t = setTimeout(() => {
        setSpan({ start: 0, end: 0, animate: false });
        requestAnimationFrame(() => requestAnimationFrame(() => setSpan({ start: 0, end: arcProgress(0), animate: true })));
      }, 720);
      return () => clearTimeout(t);
    }
    setSpan({ start: 0, end: target, animate: true });
  }, [order, enabled, target]);

  return (
    <svg viewBox="0 0 1240 1240" fill="none" preserveAspectRatio="xMidYMid meet" className="h-full w-full overflow-visible" aria-hidden>
      <g transform="translate(1240, 0) scale(-1, 1)">
        <circle
          ref={circleRef}
          cx="620"
          cy="620"
          r="619.5"
          stroke="#D2B55D"
          strokeWidth="2"
          pathLength="1"
          strokeDasharray={`${span.end - span.start} 1`}
          strokeDashoffset={-span.start}
          transform="rotate(-90 620 620)"
          style={{ transition: span.animate ? 'stroke-dashoffset 700ms var(--ease-soft), stroke-dasharray 700ms var(--ease-soft)' : 'none' }}
        />
      </g>
    </svg>
  );
}

/** The pill shown between the arrows on phones, where the ring of goals would not fit. */
function MobileGoalPill() {
  const goal = useStore((s) => s.currentGoal);
  return (
    <div key={goal.id} className="ui-nav-label font-secondary relative z-10 flex items-center justify-center gap-x-[6px] rounded-full bg-white p-[2px] pr-[10px]">
      <div className="relative flex aspect-square w-[24px] items-center justify-center rounded-full border border-gold bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/dot-cup.svg" alt="" width={18} height={18} />
        <div className="scale-pulse absolute inset-0 -z-1 aspect-square w-[24px] translate-x-[-1px] translate-y-[-1px] scale-120 rounded-full border border-white" />
        <div className="scale-pulse absolute inset-0 -z-1 aspect-square w-[24px] translate-x-[-1px] translate-y-[-1px] scale-120 rounded-full border border-white" style={{ animationDelay: '1.5s' }} />
      </div>
      <div className="flex translate-y-[-1px] items-center gap-x-[0.4em] text-[10px]">
        <p className="font-[900] text-gold">
          {goal.home} {goal.scoreHome}
        </p>
        <p className="font-medium text-black">
          {goal.scoreAway} {goal.away}
        </p>
      </div>
    </div>
  );
}

export default function GoalsController() {
  const showRecords = useStore((s) => s.showRecords);
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const currentGoal = useStore((s) => s.currentGoal);
  const shellRef = useRef<HTMLDivElement>(null);
  const revealed = useStore((s) => s.goalsRevealed);

  // The "see more" and sound buttons sit where the circle crosses 90px above the window bottom.
  const [bottomPts, setBottomPts] = useState(() => ({ left: circlePointAtY(765, 'left'), right: circlePointAtY(765, 'right') }));
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return;
      const y = ((window.innerHeight - 90 - r.top) / r.height) * VIEW_H;
      setBottomPts({ left: circlePointAtY(y, 'left'), right: circlePointAtY(y, 'right') });
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const s = useStore.getState();
    const nextOrder = (s.currentGoal.order + dir + GOALS.length) % GOALS.length;
    selectGoal(GOALS[nextOrder]);
  };

  const arcEnabled = revealed && !showRecords;
  const visualOrder = showRecords ? currentGoal.order : currentGoal.order;
  const dots = useMemo(() => ({ left: leftGoals, right: rightGoals }), []);

  return (
    <>
      {/* Navigation layer: stays the same size in both modes. */}
      <div ref={shellRef} className="ctrl-shell pointer-events-none fixed top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <div className={clsx('absolute top-1/2 left-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 transition-all duration-400 lg:block', showRecords ? 'pointer-events-none scale-0 opacity-0' : 'pointer-events-auto scale-100 opacity-100')}>
          <PrevButton onClick={() => go(-1)} />
        </div>
        <div className={clsx('absolute top-1/2 right-0 z-10 hidden translate-x-1/2 -translate-y-1/2 transition-all duration-400 lg:block', showRecords ? 'pointer-events-none scale-0 opacity-0' : 'pointer-events-auto scale-100 opacity-100')}>
          <NextButton onClick={() => go(1)} />
        </div>
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={pct(bottomPts.left)}>
            <RecordsToggle />
          </div>
          <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={pct(bottomPts.right)}>
            <AudioToggle />
          </div>
          <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={pct(RIGHT.after[0])}>
            <div className={clsx('ui-nav-label font-secondary relative text-center text-[14px] leading-[1.5em] whitespace-nowrap transition-opacity duration-300 will-change-[opacity]', showRecords ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100')}>
              <div className="absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2 rounded-full bg-black shadow-[0_0_32px_-8px_rgba(0,0,0,1)]" />
              <p className="relative z-10 [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: t.eachGoal }} />
            </div>
          </div>
        </div>
      </div>

      {/* Ring layer: the arc, the goals and the records. Shrinks in records mode. */}
      <div className={clsx('ctrl-shell pointer-events-none fixed top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2', showRecords && 'is-records')}>
        <div className="absolute top-1/2 left-1/2 hidden aspect-square w-full -translate-x-1/2 -translate-y-1/2 lg:block" aria-hidden>
          <GoldArc enabled={arcEnabled} order={currentGoal.order} />
        </div>
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {dots.left.map((g, i) => (
            <GoalDot key={g.id} goal={g} point={LEFT.goals[i]} index={i} isRight={false} visible={!showRecords} visualOrder={visualOrder} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {dots.right.map((g, i) => (
            <GoalDot key={g.id} goal={g} point={RIGHT.goals[i]} index={i} isRight visible={!showRecords} visualOrder={visualOrder} />
          ))}
        </div>
        <RecordsRing />
        <MobileRecordsStrip />
      </div>

      <RecordsNav />

      {/* Phone and small tablet layout. */}
      <div className={clsx('fixed bottom-[48px] left-1/2 w-[640px] -translate-x-1/2 py-[24px] transition-all duration-700 max-sm:w-screen lg:hidden', showRecords ? 'pointer-events-none translate-y-[200px] scale-0 opacity-0' : 'pointer-events-auto translate-y-0 scale-100 opacity-100')}>
        <div className="ui-stats will-change-transform">
          <MatchLine className="flex" />
        </div>
        <div className="flex items-center justify-between gap-x-[32px] px-2 py-1 sm:px-4 sm:py-2">
          <PrevButton onClick={() => go(-1)} magnet={false} />
          <MobileGoalPill />
          <NextButton onClick={() => go(1)} magnet={false} />
        </div>
        <div className="ui-stats will-change-transform">
          <Possession className="grid" />
        </div>
      </div>
    </>
  );
}
