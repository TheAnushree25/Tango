'use client';

import clsx from 'clsx';
import { DICT, type Locale } from '@/lib/content';
import { useStore } from '@/lib/store';
import { PulseButton } from '@/components/ui/Buttons';
import { StarIcon } from '@/components/ui/icons';
import { TransitionLink } from '@/components/layout/Header';

/**
 * Long-form page: a single narrow column between two fixed fades, so the copy dissolves
 * into the background as it reaches the header and the bottom of the window.
 */
export default function TextPage({ content }: { content: Record<Locale, { title: string; body: string }> }) {
  const locale = useStore((s) => s.locale);
  const visible = useStore((s) => s.ringReady);
  const t = DICT[locale];
  const page = content[locale];

  return (
    <div className={clsx('transition-opacity duration-700 ease-[var(--ease-settle)]', visible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      <TransitionLink href="/" className="js-hover-sound relative z-10 inline-flex w-fit cursor-pointer !fixed top-[32px] left-[140px] z-[100000] !hidden lg:!block">
        <PulseButton size="sm">
          <StarIcon />
        </PulseButton>
        <div className="ui-nav-label will-change-[opacity]">
          <div className="font-secondary absolute top-1/2 left-full w-fit translate-x-1 -translate-y-1/2 overflow-hidden text-[16px] font-bold whitespace-nowrap uppercase">{t.close}</div>
        </div>
      </TransitionLink>

      <div className="fixed top-0 left-0 z-10 h-[200px] w-full bg-linear-to-b from-black via-black/80 to-black/0" />
      <div className="fixed bottom-0 left-0 z-10 h-[200px] w-full bg-linear-to-t from-black via-black/80 to-black/0" />

      <main className="text-page px-[20px]">
        <div className="mx-auto flex max-w-[552px] flex-col gap-[80px] py-[200px]">
          <h1 className="font-primary text-[50px] leading-[1em] uppercase sm:text-[70px]">{page.title}</h1>
          <p className="font-secondary text-[20px]" dangerouslySetInnerHTML={{ __html: page.body }} />
        </div>
      </main>
    </div>
  );
}
