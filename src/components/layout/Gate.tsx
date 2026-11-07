'use client';

import clsx from 'clsx';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { BRAND, DICT } from '@/lib/content';
import { useStore } from '@/lib/store';
import { continueFromGate } from '@/lib/uiEnter';
import { audio } from '@/lib/audio';
import { Magnet, PulseButton } from '@/components/ui/Buttons';
import { SunEmblem, ThreeStars } from '@/components/ui/icons';
import RingDots from '@/components/ui/RingDots';

/**
 * Places a child on the gate's ring by angle, clockwise from the top. The arm rotates and the child
 * rotates back, so the text always reads level however the ring is resized. Phones and desktops use
 * different angles because the figure fills the screen differently.
 *
 * `keepInView` slides the child along the ring's axis when a short window would otherwise cut it off.
 */
function OnRing({ angle, mobile, keepInView, children }: { angle: number; mobile: number; keepInView?: 'top' | 'bottom'; children: ReactNode }) {
  const shift = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!keepInView) return;
    const el = shift.current;
    if (!el) return;
    const measure = () => {
      el.style.setProperty('--gate-safe-shift', '0px');
      const r = el.getBoundingClientRect();
      const move = keepInView === 'bottom' ? Math.min(0, window.innerHeight - 48 - r.bottom) : Math.max(0, 76 - r.top);
      el.style.setProperty('--gate-safe-shift', `${move}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [keepInView]);
  return (
    <div className="gate-arm pointer-events-none absolute inset-0" style={{ '--arm': `${angle}deg`, '--arm-m': `${mobile}deg` } as CSSProperties}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="gate-arm-back">
          <div ref={shift} style={{ transform: 'translate3d(0, var(--gate-safe-shift, 0px), 0)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const TITLE = 'gate-item gate-title font-primary text-[32px] leading-none whitespace-nowrap text-white uppercase will-change-[opacity] md:text-[64px] lg:text-[80px]';

export default function Gate() {
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];

  const enter = () => {
    audio.start();
    continueFromGate();
  };

  return (
    <div data-gate-overlay className="pointer-events-auto fixed inset-0 z-[10000]">
      <div className="gate-item font-primary fixed top-[48px] left-1/2 flex -translate-x-1/2 items-center gap-[0.4em] text-[14px] whitespace-nowrap uppercase will-change-[opacity]">
        <span className="hidden lg:inline-block">{BRAND.player}</span>
        <SunEmblem size={23} spin={false} />
        <span className="hidden lg:inline-block">{t.pride}</span>
      </div>

      <div className="gate-shell pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-full w-full origin-center">
          <div className="gate-circle h-full w-full origin-center will-change-[opacity,transform]">
            <RingDots maskClass="gate-circle-mask" dash="1 18" />
          </div>

          <OnRing angle={-45} mobile={45} keepInView="top">
            <p className={clsx(TITLE, 'max-lg:-translate-y-1/2 max-lg:translate-x-[-80px] max-md:translate-x-[-32px]')}>{BRAND.the}</p>
          </OnRing>
          <OnRing angle={80} mobile={290}>
            <p className={clsx(TITLE, 'max-lg:translate-x-[100px] max-md:translate-x-[80px]')}>{BRAND.last}</p>
          </OnRing>
          <OnRing angle={-100} mobile={90}>
            <p className={clsx(TITLE, 'max-lg:translate-x-[-140px] max-md:translate-x-[-110px]')}>{BRAND.thirdFull}</p>
          </OnRing>

          <OnRing angle={105} mobile={180}>
            <div
              className="gate-item gate-desc font-tertiary hidden w-[358px] max-w-[480px] px-[20px] text-[12px] leading-[1.65em] font-light text-white will-change-[opacity] lg:block [&_b]:font-normal"
              dangerouslySetInnerHTML={{ __html: t.intro }}
            />
          </OnRing>

          <OnRing angle={135} mobile={180} keepInView="bottom">
            <div className="gate-item gate-enter will-change-[opacity] max-lg:flex max-lg:translate-y-[80px] max-lg:flex-col max-lg:items-center max-lg:justify-center max-lg:gap-[32px]">
              <div
                className="font-tertiary block w-screen max-w-[480px] px-[20px] text-center text-[12px] leading-[1.65em] font-light text-white lg:hidden [&_b]:font-normal"
                dangerouslySetInnerHTML={{ __html: t.intro }}
              />
              <div className="relative h-[120px] w-[120px]">
                <div className="group/container pointer-events-auto absolute top-0 left-0 inline-block cursor-pointer" onClick={enter}>
                  <Magnet padding={32} strength={2.5}>
                    <button type="button" className="relative inline-flex cursor-pointer items-center" aria-label={t.enter}>
                      <PulseButton gate size="lg" color="gold">
                        <ThreeStars />
                      </PulseButton>
                      <span key={locale} className="gate-enter-label font-secondary ml-2 text-[20px] leading-none font-black whitespace-nowrap text-white uppercase">{t.enter}</span>
                    </button>
                  </Magnet>
                </div>
              </div>
            </div>
          </OnRing>
        </div>
      </div>
    </div>
  );
}
