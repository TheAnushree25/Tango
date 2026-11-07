'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

/**
 * An odometer: each decimal place is a column of ten digits that rolls the short way round.
 * Digits are moved directly with transforms so a rolling number never re-renders React.
 */
function Column({ place, value, height, active }: { place: number; value: number; height: number; active: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const state = useRef({ v: 0 });

  const paint = () => {
    const el = root.current;
    if (!el) return;
    const v = state.current.v % 10;
    Array.from(el.children).forEach((child, d) => {
      let offset = (10 + d - v) % 10;
      if (offset > 5) offset -= 10;
      (child as HTMLElement).style.transform = `translateY(${offset * height}px)`;
    });
  };

  useEffect(() => {
    paint();
  });

  useEffect(() => {
    const target = active ? Math.floor(value / place) : 0;
    const tween = gsap.to(state.current, { v: target, duration: 1.1, ease: 'ease.softOut', onUpdate: paint });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, place, active, height]);

  return (
    <span ref={root} className="relative inline-flex overflow-hidden" style={{ height, width: '1ch', fontVariantNumeric: 'tabular-nums' }}>
      {Array.from({ length: 10 }, (_, d) => (
        <span key={d} className="absolute inset-0 flex items-center justify-center" style={{ lineHeight: 1 }}>
          {d}
        </span>
      ))}
    </span>
  );
}

export default function Counter({ value, fontSize, active, places = [10, 1] }: { value: number; fontSize: number; active: boolean; places?: number[] }) {
  return (
    <span className="relative inline-block" aria-label={String(value)}>
      <span className="flex overflow-hidden" style={{ fontSize, lineHeight: 1, direction: 'ltr' }}>
        {places.map((p) => (
          <Column key={p} place={p} value={value} height={fontSize} active={active} />
        ))}
      </span>
    </span>
  );
}
