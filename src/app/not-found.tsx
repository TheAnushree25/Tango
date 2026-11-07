'use client';

import { useEffect } from 'react';
import { TransitionLink } from '@/components/layout/Header';
import { NOT_FOUND_EVENT } from '@/components/layout/StageMount';
import { DICT } from '@/lib/content';
import { useStore } from '@/lib/store';

/** Lost: the player waits on the ball, and the copy sits on top. */
export default function NotFound() {
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const visible = useStore((s) => s.ringReady);

  useEffect(() => {
    if (visible) window.dispatchEvent(new Event(NOT_FOUND_EVENT));
  }, [visible]);

  return (
    <main className={`pointer-events-none fixed inset-x-0 top-[17vh] z-20 flex flex-col items-center gap-[12px] text-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <h1 className="font-primary text-[80px] leading-none">{t.notFoundTitle}</h1>
      <p className="font-tertiary text-[12px] leading-[1.65em] font-light">{t.notFoundBody}</p>
      <TransitionLink href="/" className="js-hover-sound group font-secondary pointer-events-auto relative mt-[8px] text-[16px] font-bold uppercase">
        {t.notFoundCta}
        <span className="block h-[2px] w-full scale-y-50 bg-gold transition-all duration-400 group-hover:scale-x-90 group-hover:scale-y-100" />
      </TransitionLink>
    </main>
  );
}
