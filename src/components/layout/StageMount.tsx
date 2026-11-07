'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '@/lib/audio';
import { DICT } from '@/lib/content';
import { EV } from '@/lib/events';
import { useStore } from '@/lib/store';
import { COVER, GOAL_SCENES, NOT_FOUND_SCENE, RECORD_SCENES, type GoalScene, type SceneSpec } from '@/lib/webgl/config';
import type { Stage } from '@/lib/webgl/stage';

export const NOT_FOUND_EVENT = 'stage:show-not-found';

/**
 * Owns the canvas and connects window events to the Stage. It lives above the routes, so the WebGL
 * context survives navigating to the text pages and back.
 */
export default function StageMount() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isHomeRef = useRef(isHome);
  useEffect(() => {
    isHomeRef.current = isHome;
  }, [isHome]);

  const gateDone = useStore((s) => s.gateDone);
  const locale = useStore((s) => s.locale);
  const [notFound, setNotFound] = useState(false);
  const canvasVisible = isHome || !gateDone || notFound;

  const [goalScene, setGoalScene] = useState<GoalScene | null>(null);
  const [activeAlt, setActiveAlt] = useState<number | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [needsTilt, setNeedsTilt] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stage: Stage | null = null;
    const pendingCalls: ((s: Stage) => void)[] = [];
    const withStage = (fn: (s: Stage) => void) => {
      if (stage) fn(stage);
      else pendingCalls.push(fn);
    };

    const showGoal = (index: number, alt: number | null = null) => {
      const scene = GOAL_SCENES[index] ?? GOAL_SCENES[0];
      setGoalScene(scene);
      setActiveAlt(alt);
      setSceneReady(false);
      const spec: SceneSpec = alt !== null ? scene.alts[alt] ?? scene : scene;
      withStage((s) => s.show(spec));
    };
    const showRecord = (index: number) => {
      setGoalScene(null);
      setActiveAlt(null);
      setSceneReady(false);
      withStage((s) => s.show(RECORD_SCENES[index % RECORD_SCENES.length]));
    };

    const onShowCover = () => withStage((s) => s.allow());
    const onHideCover = () => withStage((s) => s.hide());
    const onFadeIn = () => {
      if (!isHomeRef.current) return;
      const { showRecords, currentGoal, currentRecord, isAudioPlaying } = useStore.getState();
      if (showRecords) showRecord(currentRecord.order);
      else showGoal(currentGoal.order);
      withStage((s) => s.allow());
      if (isAudioPlaying) audio.start();
    };
    const onGoal = (e: Event) => showGoal((e as CustomEvent<number>).detail);
    const onRecord = (e: Event) => {
      const i = (e as CustomEvent<number | null>).detail;
      if (i !== null) showRecord(i);
    };
    const onCamera = (e: Event) => {
      const alt = (e as CustomEvent<number | null>).detail;
      showGoal(useStore.getState().currentGoal.order, alt);
    };
    const onPlay = () => audio.start();
    const onStop = () => audio.pause();
    const onNotFound = () => {
      setNotFound(true);
      withStage((s) => {
        s.show(NOT_FOUND_SCENE);
        s.allow();
      });
    };

    window.addEventListener(EV.showCover, onShowCover);
    window.addEventListener(EV.hideCover, onHideCover);
    window.addEventListener(EV.fadeInStage, onFadeIn);
    window.addEventListener(EV.changeGoal, onGoal);
    window.addEventListener(EV.changeRecord, onRecord);
    window.addEventListener(EV.changeCamera, onCamera);
    window.addEventListener(EV.playSounds, onPlay);
    window.addEventListener(EV.stopSounds, onStop);
    window.addEventListener(NOT_FOUND_EVENT, onNotFound);

    // Three.js is heavy, so it loads after first paint and the intro never waits for it.
    import('@/lib/webgl/stage')
      .then(({ Stage: StageClass }) => {
        if (disposed || !canvas.current) return;
        stage = new StageClass(canvas.current, {
          onAudio: (src, vol, music) => audio.setAmbience(src, vol, music),
          onSceneReady: () => setSceneReady(true),
          onGyroNeedsPermission: () => setNeedsTilt(true),
        });
        stageRef.current = stage;
        audio.clipSource = () => stageRef.current?.runningClip ?? null;
        (window as unknown as { __stage?: Stage }).__stage = stage;
        stage.show(COVER);
        pendingCalls.splice(0).forEach((fn) => fn(stage as Stage));
      })
      // Without WebGL the interface still works, there is just no figure behind it.
      .catch((err) => console.error('[stage] could not start', err));

    // Warm the browser cache with the first clip while the visitor is still on the gate.
    const warm = document.createElement('link');
    warm.rel = 'prefetch';
    warm.href = GOAL_SCENES[0].src;
    document.head.appendChild(warm);

    return () => {
      disposed = true;
      window.removeEventListener(EV.showCover, onShowCover);
      window.removeEventListener(EV.hideCover, onHideCover);
      window.removeEventListener(EV.fadeInStage, onFadeIn);
      window.removeEventListener(EV.changeGoal, onGoal);
      window.removeEventListener(EV.changeRecord, onRecord);
      window.removeEventListener(EV.changeCamera, onCamera);
      window.removeEventListener(EV.playSounds, onPlay);
      window.removeEventListener(EV.stopSounds, onStop);
      window.removeEventListener(NOT_FOUND_EVENT, onNotFound);
      stage?.dispose();
      stageRef.current = null;
    };
  }, []);

  // Leaving the home route hides the stage and pauses the sound. Coming back brings both back.
  const wasHome = useRef(isHome);
  useEffect(() => {
    if (!gateDone) {
      wasHome.current = isHome;
      return;
    }
    if (!isHome && wasHome.current) {
      stageRef.current?.hideNow();
      audio.pause();
    }
    if (isHome && !wasHome.current) {
      setNotFound(false);
      window.dispatchEvent(new Event(EV.fadeInStage));
    }
    wasHome.current = isHome;
  }, [isHome, gateDone]);

  const labels = useMemo(() => {
    if (!goalScene) return [];
    const dict = DICT[locale].camera;
    return [goalScene, ...goalScene.alts].map((s, i) => (s.cameraType ? dict[s.cameraType] : `CAM ${i + 1}`));
  }, [goalScene, locale]);

  const showCams = isHome && sceneReady && !!goalScene && goalScene.alts.length > 0;

  const pickCamera = (alt: number | null) => {
    if (alt === activeAlt) return;
    window.dispatchEvent(new CustomEvent(EV.changeCamera, { detail: alt }));
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: -10, opacity: canvasVisible ? 1 : 0, visibility: canvasVisible ? 'visible' : 'hidden' }}>
        <canvas ref={canvas} aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {goalScene && goalScene.alts.length > 0 && (
        <div
          role="group"
          aria-label="Camera angles"
          className="translate-y-[28px] lg:translate-y-[20px]"
          style={{
            position: 'fixed',
            top: '17vh',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 9999,
            pointerEvents: showCams ? 'auto' : 'none',
            opacity: showCams ? 1 : 0,
            transition: 'opacity 400ms ease',
          }}
        >
          {labels.map((label, i) => {
            const alt = i === 0 ? null : i - 1;
            const active = alt === activeAlt;
            return (
              <div key={label} className="flex items-center">
                {i > 0 && <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.25)', margin: '0 12px', flexShrink: 0 }} aria-hidden />}
                <button
                  onClick={() => pickCamera(alt)}
                  className={`js-hover-sound font-tertiary cursor-pointer text-[11px] tracking-[0.1em] uppercase transition-colors duration-150 ${active ? 'font-semibold text-white/95' : 'font-normal text-white/40 hover:text-white/70'}`}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {needsTilt && (
        <button
          aria-label="Enable motion parallax"
          onClick={() => {
            stageRef.current?.requestGyro().then((granted) => {
              if (granted) setNeedsTilt(false);
            });
          }}
          className="font-tertiary fixed bottom-[5vh] left-1/2 z-[2147483647] -translate-x-1/2 cursor-pointer rounded-[100px] border border-white/20 bg-white/10 px-[22px] py-[10px] text-[12px] font-medium tracking-[0.08em] whitespace-nowrap text-white/90 uppercase backdrop-blur-[12px]"
        >
          Tap to enable tilt control
        </button>
      )}
    </>
  );
}
