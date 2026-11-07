'use client';

import { gsap } from 'gsap';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { registerEases } from '@/lib/ease';

const DURATION = 0.4;
const EASE = 'ease.emphasis';

/** Fades the page out, swaps the route, and lets PageFade below fade the new page in. */
export function usePageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (href: string) => {
      if (href === pathname) return;
      registerEases();
      const page = document.querySelector('[data-page]');
      if (!page) return router.push(href);
      gsap.to(page, { autoAlpha: 0, duration: DURATION, ease: EASE, onComplete: () => router.push(href) });
    },
    [pathname, router],
  );
}

/** Runs after each route change. Restores the scroll position and fades the new page in. */
export function usePageEnter() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    registerEases();
    window.scrollTo(0, 0);
    const page = document.querySelector('[data-page]');
    if (page) gsap.fromTo(page, { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION, ease: EASE });
  }, [pathname]);
}
