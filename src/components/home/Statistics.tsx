'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { DICT, GOALS } from '@/lib/content';
import { useStore } from '@/lib/store';
import Counter from '@/components/ui/Counter';
import { RulerIcon, StopwatchIcon } from '@/components/ui/icons';

const useCountersActive = () => useStore((s) => s.countersActive);

/** Home and away possession with the two-colour bar. The away flag wipes in as the opponent changes. */
export function Possession({ className }: { className?: string }) {
  const goal = useStore((s) => s.currentGoal);
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const active = useCountersActive();
  const home = goal.possessionHome;
  const away = 100 - home;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const left = mounted && active ? home / 100 : 0;
  const right = mounted && active ? 1 - home / 100 : 0;

  return (
    <div className={clsx('mx-auto grid w-fit grid-cols-[20px_auto_20px] gap-[6px]', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/flags/aur.svg" alt="" width={20} height={20} />
      <div className="flex w-fit flex-col justify-center gap-[6px]">
        <div className="flex items-center gap-2">
          <div className="font-secondary flex items-center justify-center gap-[0.2em] text-[12px] font-black uppercase">
            {goal.home} <Counter value={home} fontSize={12} active={active} />%
          </div>
          <div className="text-1 font-tertiary uppercase opacity-40">{t.possession}</div>
          <div className="font-secondary flex items-center justify-center gap-[0.2em] text-[12px] font-black uppercase">
            <Counter value={away} fontSize={12} active={active} />% {goal.away}
          </div>
        </div>
        <div className="relative mx-auto h-[3px] w-[100px] overflow-hidden rounded-full bg-gold/10">
          <div className="relative z-10 mt-[-1px] h-[5px] w-[101px] origin-left border-r-[2px] border-black bg-sky transition-transform duration-700 ease-[var(--ease-soft-out)] motion-reduce:transition-none" style={{ transform: `scaleX(${left})` }} />
          <div className="absolute top-0 right-0 h-[5px] w-[101px] origin-right bg-gold transition-transform duration-700 ease-[var(--ease-soft-out)] motion-reduce:transition-none" style={{ transform: `scaleX(${right})` }} />
        </div>
      </div>
      <div className="relative h-[20px] w-[20px]">
        {GOALS.map((g, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={g.id}
            src={g.awayFlag}
            alt=""
            width={20}
            height={20}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-[var(--ease-soft-out)] motion-reduce:transition-none"
            style={{ zIndex: i, clipPath: goal.id >= g.id ? 'circle(50% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
          />
        ))}
      </div>
    </div>
  );
}

/** The minute on the left, the distance on the right, the stadium and date between them. */
export function MatchLine({ className }: { className?: string }) {
  const goal = useStore((s) => s.currentGoal);
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const active = useCountersActive();
  return (
    <div className={clsx('max-xs:w-screen max-xs:px-2 xs:gap-[20px] xs:justify-between relative flex w-full items-end justify-between gap-2', className)}>
      <div className="absolute bottom-0 left-[20px] lg:right-full lg:left-auto lg:translate-x-[-20px]">
        <div className="flex items-center gap-[6px]">
          <StopwatchIcon />
          <p className="text-1 font-tertiary uppercase">{t.minute}</p>
        </div>
        <div className="text-2 font-secondary flex items-end gap-[0.1em] leading-[1.4em] font-semibold">
          <div className="flex items-start">
            <Counter value={goal.minute} fontSize={40} active={active} />
            <p className="translate-y-[2px]">&apos;</p>
          </div>
          <p className="translate-y-[-0.3em] text-[12px] leading-[1em]">{t[goal.half]}</p>
        </div>
      </div>
      <p className="font-secondary w-full -translate-y-1/2 text-center text-[12px] uppercase lg:translate-y-0">
        <b>{goal.stadium}</b>, {goal.date[locale]}
      </p>
      <div className="absolute right-[20px] bottom-0 lg:right-auto lg:left-full lg:translate-x-[20px]">
        <div className="flex items-center gap-[6px] max-lg:flex-row-reverse">
          <RulerIcon />
          <p className="text-1 font-tertiary uppercase">{t.distance}</p>
        </div>
        <div className="text-2 font-secondary flex items-end gap-[0.1em] leading-[1.4em] font-semibold">
          <div className="flex items-start">
            <Counter value={goal.distance} fontSize={40} active={active} />
          </div>
          <p className="translate-y-[-0.3em] text-[12px] leading-[1em]">M</p>
        </div>
      </div>
    </div>
  );
}

/** Desktop block: bottom centre, drops out of view while the records are open. */
export default function Statistics() {
  const showRecords = useStore((s) => s.showRecords);
  return (
    <div className="pointer-events-none fixed top-1/2 left-1/2 hidden h-[100dvh] max-h-screen w-screen -translate-x-1/2 -translate-y-1/2 items-end justify-center pb-[40px] lg:flex">
      <div className="ui-stats will-change-transform">
        <div className={clsx('pointer-events-auto transition-transform duration-1100 ease-[var(--ease-soft)]', showRecords ? 'translate-y-[200px]' : 'translate-y-0')}>
          <div className="flex flex-col gap-[12px]">
            <Possession />
            <MatchLine />
          </div>
        </div>
      </div>
    </div>
  );
}
