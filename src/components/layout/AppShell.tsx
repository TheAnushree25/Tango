'use client';

import { gsap } from 'gsap';
import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { audio } from '@/lib/audio';
import { registerEases } from '@/lib/ease';
import { EV } from '@/lib/events';
import { useStore } from '@/lib/store';
import { startIntro } from '@/lib/uiEnter';
import ControllerRing from '@/components/ui/ControllerRing';
import Gate from '@/components/layout/Gate';
import Header from '@/components/layout/Header';
import StageMount from '@/components/layout/StageMount';
import { usePageEnter } from '@/hooks/usePageTransition';

/** Tracks the cursor with a slight lag and exposes it as CSS variables for the grid spotlight. */
function useCursorTrail() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const root = document.documentElement;
    const target = { x: -999, y: -999 };
    const pos = { x: -999, y: -999 };
    let raf = 0;
    let active = false;
    const onMove = (e: PointerEvent) => {
      if (!active) {
        active = true;
        pos.x = e.clientX;
        pos.y = e.clientY;
        root.style.setProperty('--cursor-trail-active', '1');
      }
      target.x = e.clientX;
      target.y = e.clientY;
    };
    const onLeave = () => {
      active = false;
      root.style.setProperty('--cursor-trail-active', '0');
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      pos.x += (target.x - pos.x) * 0.08;
      pos.y += (target.y - pos.y) * 0.08;
      root.style.setProperty('--cursor-trail-x', `${pos.x.toFixed(1)}px`);
      root.style.setProperty('--cursor-trail-y', `${pos.y.toFixed(1)}px`);
    };
    loop();
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);
}

/** One delegated listener gives every `.js-hover-sound` element its hover tick. */
function useHoverSound() {
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const t = (e.target as Element)?.closest?.('.js-hover-sound');
      if (!t || t.contains(e.relatedTarget as Node)) return;
      audio.playHover();
    };
    document.addEventListener('mouseover', onOver);
    return () => document.removeEventListener('mouseover', onOver);
  }, []);
}

/** Smooth scrolling only exists for the text pages. The home route never scrolls the document. */
function useSmoothScroll() {
  const pathname = usePathname();
  const gateDone = useStore((s) => s.gateDone);
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    const instance = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.current = instance;
    const onTick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(onTick);
      instance.destroy();
      lenis.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = lenis.current;
    if (!instance) return;
    instance.scrollTo(0, { immediate: true });
    if (gateDone && pathname !== '/') instance.start();
    else instance.stop();
    instance.resize();
  }, [pathname, gateDone]);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const setGateDone = useStore((s) => s.setGateDone);
  useCursorTrail();
  useHoverSound();
  useSmoothScroll();
  usePageEnter();

  useEffect(() => {
    registerEases();
    audio.init();
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const begin = () => {
      if (cancelled || cleanup) return;
      document.body.classList.add('fonts-loaded');
      cleanup = startIntro();
    };
    const fallback = setTimeout(begin, 800);
    document.fonts?.ready.then(() => {
      clearTimeout(fallback);
      // One beat later, so the grid lines (counted from the window size on mount) are in the DOM.
      setTimeout(begin, 60);
    });
    // These live in the store, so a page that mounts later still knows the intro already ran.
    const { setRingReady, setGoalsRevealed, setCountersActive } = useStore.getState();
    const onDone = () => setGateDone(true);
    const onRing = () => setRingReady(true);
    const onGoals = () => setGoalsRevealed(true);
    const onStats = () => setCountersActive(true);
    window.addEventListener(EV.enterDone, onDone);
    window.addEventListener(EV.circleScaled, onRing);
    window.addEventListener(EV.goalsRevealed, onGoals);
    window.addEventListener(EV.statsStart, onStats);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      window.removeEventListener(EV.enterDone, onDone);
      window.removeEventListener(EV.circleScaled, onRing);
      window.removeEventListener(EV.goalsRevealed, onGoals);
      window.removeEventListener(EV.statsStart, onStats);
      cleanup?.();
    };
  }, [setGateDone]);

  return (
    <>
      <StageMount />
      <Gate />
      <Header />
      <ControllerRing />
      <div data-page>{children}</div>
    </>
  );
}
