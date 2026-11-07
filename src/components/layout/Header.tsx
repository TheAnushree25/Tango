'use client';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { BRAND, DICT } from '@/lib/content';
import { EV } from '@/lib/events';
import { useStore } from '@/lib/store';
import { audio } from '@/lib/audio';
import { PulseButton } from '@/components/ui/Buttons';
import { AudioBars, LangArrow, StarIcon, SunEmblem } from '@/components/ui/icons';
import { usePageTransition } from '@/hooks/usePageTransition';

export function TransitionLink({ href, className, children, ...rest }: { href: string; className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) {
  const navigate = usePageTransition();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  );
}

function LinkButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <TransitionLink href={href} className={clsx('js-hover-sound group font-tertiary pointer-events-auto relative z-1 text-[10px] whitespace-nowrap text-white/50 transition-all duration-400 hover:text-white', className)}>
      {children}
      <span className="block h-[2px] w-full scale-y-50 bg-gold transition-all duration-400 group-hover:scale-x-90 group-hover:scale-y-100" />
    </TransitionLink>
  );
}

const SIDE_LABEL = 'absolute top-1/2 -translate-y-1/2';

/** Sound on / off, with the labels rolling vertically. */
export function AudioToggle({ className }: { className?: string }) {
  const playing = useStore((s) => s.isAudioPlaying);
  const setPlaying = useStore((s) => s.setAudioPlaying);
  const toggle = () => {
    audio.muted = playing;
    window.dispatchEvent(new Event(playing ? EV.stopSounds : EV.playSounds));
    setPlaying(!playing);
  };
  return (
    <div onClick={toggle} className={clsx('js-hover-sound group relative cursor-pointer', className)}>
      <PulseButton size="sm">
        <AudioBars />
      </PulseButton>
      <div className="ui-nav-label will-change-[opacity]">
        <div className={clsx(SIDE_LABEL, 'left-full h-[24px] w-fit translate-x-1 overflow-hidden whitespace-nowrap')}>
          <div className={clsx('relative transition-all duration-700', !playing && '-translate-y-full')}>
            <p className="font-secondary w-[80px] text-[16px] font-bold whitespace-nowrap uppercase">ON</p>
            <p className="font-secondary absolute w-[80px] text-[16px] font-bold whitespace-nowrap uppercase">OFF</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** See more: switches between the goals and the records. On a text page it is the way home. */
export function RecordsToggle({ className, closeLabel }: { className?: string; closeLabel?: string }) {
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const pathname = usePathname();
  const isHome = pathname === '/';
  const navigate = usePageTransition();
  const showRecords = useStore((s) => s.showRecords);
  const setShowRecords = useStore((s) => s.setShowRecords);

  const toggle = () => {
    if (!isHome) return navigate('/');
    audio.playBar();
    const { currentGoal, currentRecord } = useStore.getState();
    const next = !showRecords;
    setShowRecords(next);
    if (next) window.dispatchEvent(new CustomEvent(EV.changeRecord, { detail: currentRecord.order }));
    else window.dispatchEvent(new CustomEvent(EV.changeGoal, { detail: currentGoal.order }));
  };

  return (
    <div onClick={toggle} className={clsx('js-hover-sound group relative cursor-pointer', className)}>
      <div className="absolute top-1/2 left-1/2 z-10 h-full w-[100px] -translate-x-1/2 -translate-y-1/2 cursor-pointer" />
      <PulseButton size="sm">
        <StarIcon />
      </PulseButton>
      <div className="ui-nav-label will-change-[opacity]">
        <p className={clsx(SIDE_LABEL, 'font-secondary right-full hidden -translate-x-1 text-[16px] font-bold whitespace-nowrap uppercase lg:block')}>{t.seeMore}</p>
        <div className={clsx(SIDE_LABEL, 'left-full h-[24px] w-fit translate-x-1 overflow-hidden whitespace-nowrap')}>
          <div className={clsx('relative transition-all duration-700', showRecords && isHome && '-translate-y-full')}>
            <p className={clsx('font-secondary absolute z-[100] w-[80px] text-[16px] font-bold whitespace-nowrap uppercase transition-all duration-700', isHome ? 'opacity-0' : 'opacity-100')}>{closeLabel ?? t.close}</p>
            <p className={clsx('font-secondary w-[80px] text-[16px] font-bold whitespace-nowrap uppercase transition-all duration-700', isHome ? 'opacity-100' : 'opacity-0')}>{t.records}</p>
            <p className={clsx('font-secondary absolute w-[80px] text-[16px] font-bold whitespace-nowrap uppercase transition-all duration-700', isHome ? 'opacity-100' : 'opacity-0')}>{t.goals}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LangPicker() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const other = locale === 'en' ? 'es' : 'en';
  const label = (l: string) => (l === 'en' ? 'Eng' : 'Esp');
  return (
    <div className="js-hover-sound pointer-events-auto relative z-[1000] mt-[-4px] h-[28px] w-[56px] cursor-pointer" onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="font-secondary relative z-20 flex h-[32px] w-full cursor-pointer items-center justify-between px-[8px] text-[14px] font-medium text-white uppercase" aria-expanded={open}>
        <span className="translate-y-[-2px]">{label(locale)}</span>
        <LangArrow open={open} />
      </button>
      <div className={clsx('absolute top-0 right-0 z-10 w-full overflow-hidden rounded-[16px] border border-white/20 bg-white/10 pt-[28px] pb-[0px] backdrop-blur-[30px] transition-all duration-400', open ? 'max-h-[56px]' : 'max-h-[28px]')}>
        <ul>
          <li>
            <button
              type="button"
              onClick={() => {
                setLocale(other);
                setOpen(false);
              }}
              className="font-secondary block w-full cursor-pointer px-[8px] text-left text-[14px] font-medium text-white uppercase"
            >
              {label(other)}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Grid({ variant }: { variant: 'base' | 'spot' }) {
  const [counts, setCounts] = useState({ v: 0, h: 0 });
  useEffect(() => {
    const measure = () => setCounts({ v: Math.ceil(window.innerWidth / 120), h: Math.ceil(window.innerHeight / 190) });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const lineV = 'w-[1px] h-[100vh] bg-white';
  const lineH = 'w-[100vw] h-[1px] bg-white';
  if (variant === 'base') {
    return (
      <>
        <div className="pointer-events-none fixed inset-0 z-[1] flex h-screen w-screen items-center justify-center gap-x-[120px]">
          {Array.from({ length: counts.v }, (_, i) => (
            <div key={i} className={clsx('ui-grid-v opacity-2', lineV)} />
          ))}
        </div>
        <div className="pointer-events-none fixed inset-0 z-[1] flex h-screen w-screen flex-col items-center justify-center gap-y-[190px]">
          {Array.from({ length: counts.h }, (_, i) => (
            <div key={i} className={clsx('ui-grid-h opacity-2', lineH)} />
          ))}
        </div>
      </>
    );
  }
  const mask = 'radial-gradient(circle 300px at var(--cursor-trail-x, -999px) var(--cursor-trail-y, -999px), #000 0%, #000 40%, transparent 72%)';
  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" style={{ opacity: 'var(--cursor-trail-active, 0)', WebkitMaskImage: mask, maskImage: mask }} aria-hidden>
      <div className="absolute inset-0 flex items-center justify-center gap-x-[120px]">
        {Array.from({ length: counts.v }, (_, i) => (
          <div key={i} className={clsx('opacity-0 lg:opacity-[0.1]', lineV)} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-y-[190px]">
        {Array.from({ length: counts.h }, (_, i) => (
          <div key={i} className={clsx('opacity-0 lg:opacity-[0.1]', lineH)} />
        ))}
      </div>
    </div>
  );
}

function Corner({ place, flip }: { place: string; flip: string }) {
  return (
    <div style={{ mixBlendMode: 'screen' }} className={clsx('ui-deco pointer-events-none fixed z-[10001]', place)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/corners.svg" alt="" width={88} height={42} className={flip} />
    </div>
  );
}

export default function Header() {
  const locale = useStore((s) => s.locale);
  const t = DICT[locale];
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <>
      <header className="fixed top-[0px] z-100000 grid h-[64px] w-full grid-cols-[80px_1fr_80px] items-center max-lg:px-[16px] lg:top-0">
        <div className="ui-brand">
          <RecordsToggle className="block !w-fit lg:hidden" />
        </div>
        <div className="ui-brand group pointer-events-none relative mx-auto flex w-fit items-end justify-center px-[12px] max-md:scale-70 lg:pointer-events-auto lg:justify-center">
          <TransitionLink href="/" className="js-hover-sound pointer-events-auto absolute top-0 left-0 z-[1000] hidden h-full w-full cursor-pointer lg:block" aria-label={BRAND.thirdFull} />
          <div className={clsx('relative z-10 flex flex-col items-center text-[28px] leading-[0.9em] uppercase lg:pt-[16px]', !isHome && 'max-lg:!opacity-0')}>
            <div className="flex items-center gap-[0.2em]">{BRAND.the}</div>
            <div className="translate-x-[calc(-50%+6px)]">{BRAND.last}</div>
            <div className="flex items-center">
              {BRAND.third}
              <span className="relative z-10 inline-flex h-[26px] w-[26px]">
                <SunEmblem size={26} />
              </span>
            </div>
          </div>
          <div className="font-secondary relative z-1 flex max-w-[0px] flex-col overflow-hidden text-[14px] leading-[12px] transition-all duration-1100 lg:group-hover:max-w-[200px]">
            <p className="-translate-x-[100px] whitespace-nowrap uppercase transition-all duration-1400 lg:group-hover:translate-x-0">{BRAND.player}</p>
            <p className="-translate-x-[140px] whitespace-nowrap uppercase transition-all duration-1400 lg:group-hover:translate-x-0">{t.pride}</p>
          </div>
        </div>
        <div className="gate-item gate-persist block will-change-[opacity] max-lg:ml-auto lg:translate-x-[-140px]">
          <LangPicker />
        </div>
      </header>

      <Grid variant="base" />
      <Grid variant="spot" />

      <Corner place="ui-corner-tl top-2 left-1 lg:top-3 lg:left-3" flip="" />
      <Corner place="ui-corner-tr top-2 right-1 lg:top-3 lg:right-3" flip="scale-x-[-1]" />
      <Corner place="ui-corner-bl bottom-2 left-2 lg:bottom-3 lg:left-3" flip="scale-y-[-1]" />
      <Corner place="ui-corner-br right-2 bottom-2 lg:right-3 lg:bottom-3" flip="scale-x-[-1] scale-y-[-1]" />

      <div className="ui-deco ui-foot pointer-events-auto fixed bottom-3 left-3 z-[1000] flex items-center gap-[12px]">
        <LinkButton href="/legal">{t.legal}</LinkButton>
        <LinkButton href="/about" className="block lg:hidden">
          {t.about}
        </LinkButton>
      </div>
      <div className="ui-deco ui-foot pointer-events-auto fixed right-3 bottom-3 z-[1000]">
        <LinkButton href="/about" className="hidden lg:block">
          {t.about}
        </LinkButton>
        {isHome && <AudioToggle className="mr-[20px] block lg:hidden" />}
      </div>
    </>
  );
}
