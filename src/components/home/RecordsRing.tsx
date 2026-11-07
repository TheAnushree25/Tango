'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { audio } from '@/lib/audio';
import { RECORDS, type RecordItem } from '@/lib/content';
import { EV } from '@/lib/events';
import { labelSideFromAngle, normalizeDeg, ringDelta, type LabelSide } from '@/lib/layout';
import { useStore } from '@/lib/store';
import { NextButton, PrevButton } from '@/components/ui/Buttons';
import { RecordGlyph, StarIcon } from '@/components/ui/icons';

const TIMING = { contentMs: 700, rotateMs: 1500, numberMs: 700 };
const STEP = 360 / RECORDS.length;
const EDGE_HIDE = 32;

function selectRecord(r: RecordItem) {
  audio.playBar();
  useStore.getState().setCurrentRecord(r);
  window.dispatchEvent(new CustomEvent(EV.changeRecord, { detail: r.order }));
}

/** Rotation of the whole ring. It accumulates, so the ring always turns the short way. */
function useRingOffset() {
  const order = useStore((s) => s.currentRecord.order);
  const prev = useRef(order);
  const [offset, setOffset] = useState(order * STEP);
  const [visualOrder, setVisualOrder] = useState<number | null>(order);

  useEffect(() => {
    if (prev.current === order) return;
    const delta = ringDelta(prev.current, order, RECORDS.length);
    prev.current = order;
    setOffset((o) => o + delta * STEP);
    // The pill closes, the ring turns, then the pill opens on the new record.
    setVisualOrder(null);
    const t = setTimeout(() => setVisualOrder(order), TIMING.rotateMs);
    return () => clearTimeout(t);
  }, [order]);

  return { offset, visualOrder };
}

function RecordMark({ record, side, visible, index, active, showNumber }: { record: RecordItem; side: LabelSide; visible: boolean; index: number; active: boolean; showNumber: boolean }) {
  const locale = useStore((s) => s.locale);
  const isRight = side === 'right';
  const isTop = side === 'top';
  const isBottom = side === 'bottom';
  const clipAt = isRight ? 'calc(100% - 20px)' : '18px';
  const numberClip = showNumber ? 'inset(-40px -200px -40px -200px)' : side === 'left' || side === 'right' ? 'inset(40px -100px 0 -100px)' : 'inset(0 -100px 40px -100px)';
  const clickable = visible && !active;

  return (
    <div
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-hidden={!visible}
      aria-label={`Go to record ${record.number}`}
      onClick={() => clickable && selectRecord(record)}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          selectRecord(record);
        }
      }}
      className={clsx('js-hover-sound transition-opacity', visible && !active && 'pointer-events-auto cursor-pointer opacity-100', !visible && 'pointer-events-none opacity-0', visible && active && 'pointer-events-none opacity-100')}
      style={{ transitionDuration: `${TIMING.contentMs}ms` }}
    >
      <div className={clsx('relative flex size-1 origin-center items-center transition-all', isRight && 'justify-end')} style={{ transitionDuration: `${TIMING.contentMs}ms` }}>
        <StarIcon className="absolute top-1/2 left-1/2 z-20 w-[12px] -translate-x-1/2 -translate-y-1/2" />

        {/* The white pill opens as a circle wipe from the star. */}
        <div
          className={clsx('absolute top-1/2 z-10 flex h-[40px] -translate-y-1/2 items-center gap-[8px] rounded-full bg-white transition-all', isRight ? 'right-full -translate-x-[-24px] pr-[32px] pl-[18px]' : 'left-full translate-x-[-24px] pr-[18px] pl-[32px]')}
          style={{ transitionDuration: `${TIMING.contentMs}ms`, clipPath: active ? `circle(150% at ${clipAt} 50%)` : `circle(0% at ${clipAt} 50%)` }}
        >
          <p className="font-secondary flex translate-y-[-4px] items-center text-[32px] leading-[0.9em] font-semibold text-gold">{record.number}</p>
          <div className="font-tertiary flex flex-col text-[10px] leading-[1.1em] font-medium">
            <p className="whitespace-nowrap text-black uppercase">{record.title[locale]}</p>
            <p className="whitespace-nowrap text-link uppercase">{record.label[locale]}</p>
          </div>
          <div className="block">
            <RecordGlyph icon={record.icon} />
          </div>
        </div>

        {/* The number that rests beside the star when the record is not selected. */}
        <div
          className={clsx(
            'z-30 flex h-[40px] items-center rounded-full px-2 transition-all',
            side === 'left' && '-translate-x-[16px]',
            isRight && 'translate-x-[16px]',
            isTop && '-translate-y-[16px]',
            isBottom && 'translate-y-[16px]',
            !showNumber && side === 'left' && '!translate-x-[40px]',
            !showNumber && isRight && '!-translate-x-[40px]',
            !showNumber && isTop && '!-translate-y-[40px]',
            !showNumber && isBottom && '!translate-y-[40px]',
          )}
          style={{ transitionDuration: `${TIMING.numberMs}ms`, clipPath: numberClip }}
        >
          <span
            className={clsx(
              'font-secondary absolute flex origin-top-left items-center gap-[8px] text-[32px] font-bold text-gold',
              side === 'left' && 'top-1/2 right-full translate-x-[4px] -translate-y-[55%] flex-row-reverse',
              isRight && 'top-1/2 left-full translate-x-[-4px] -translate-y-[55%] flex-row',
              isTop && 'bottom-full left-1/2 mb-[4px] -translate-x-1/2 flex-row',
              isBottom && 'top-full left-1/2 mt-[4px] -translate-x-1/2 flex-row',
            )}
            style={{ transitionDelay: `${70 * index}ms` }}
          >
            <span className="translate-y-[-2px]">{record.number}</span>
            <span className="block opacity-100">
              <RecordGlyph icon={record.icon} />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Ten marks on a turning wheel. Each arm rotates and counter-rotates so its mark stays level. */
export default function RecordsRing() {
  const showRecords = useStore((s) => s.showRecords);
  const { offset, visualOrder } = useRingOffset();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  // Marks that have turned past the top or bottom of the window fade out.
  useEffect(() => {
    if (!showRecords) return;
    const check = () => {
      const next = new Set<number>();
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        if (cy < EDGE_HIDE || cy > window.innerHeight - EDGE_HIDE) next.add(i);
      });
      setHidden((old) => (old.size === next.size && [...next].every((v) => old.has(v)) ? old : next));
    };
    check();
    const id = setInterval(check, 120);
    return () => clearInterval(id);
  }, [showRecords, offset]);

  return (
    <div data-records-ring aria-hidden={!showRecords} className={clsx('pointer-events-none absolute inset-0 z-10 hidden overflow-visible transition-opacity duration-700 lg:block', showRecords ? 'opacity-100' : 'opacity-0')}>
      {RECORDS.map((record, i) => {
        const angle = offset - record.order * STEP;
        const isActive = visualOrder === record.order;
        const side = labelSideFromAngle(normalizeDeg(angle - 180));
        const edgeHidden = hidden.has(i);
        return (
          <div key={record.id} className="absolute inset-0 transition-transform ease-[var(--ease-soft)]" style={{ transform: `rotate(${angle}deg)`, transitionDuration: `${TIMING.rotateMs}ms` }}>
            <div
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="transition-transform ease-[var(--ease-soft)]" style={{ transform: `rotate(${-angle}deg)`, transitionDuration: `${TIMING.rotateMs}ms` }}>
                <div className="ui-record will-change-[opacity]">
                  <div className={clsx('transition-opacity duration-200', edgeHidden ? 'opacity-0 delay-400' : 'opacity-100 delay-0')}>
                    <RecordMark record={record} index={i} side={side} visible={showRecords} active={isActive} showNumber={!isActive && visualOrder !== null} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Phones: the same wheel turned to the top of the screen, with the selected record's pill under its star. */
export function MobileRecordsStrip() {
  const showRecords = useStore((s) => s.showRecords);
  const locale = useStore((s) => s.locale);
  const { offset, visualOrder } = useRingOffset();
  return (
    <div data-records-ring aria-hidden={!showRecords} className={clsx('pointer-events-none absolute inset-0 z-10 overflow-visible transition-opacity duration-700 lg:hidden', showRecords ? 'opacity-100' : 'opacity-0')}>
      {RECORDS.map((record) => {
        const active = visualOrder === record.order;
        const angle = record.order * STEP - offset;
        return (
          <div key={record.id} className="absolute inset-0 transition-transform ease-[var(--ease-soft)]" style={{ transform: `rotate(${angle}deg)`, transitionDuration: `${TIMING.rotateMs}ms` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="transition-transform ease-[var(--ease-soft)]" style={{ transform: `rotate(${-angle}deg)`, transitionDuration: `${TIMING.rotateMs}ms` }}>
                <div className="ui-record will-change-[opacity]">
                  <div className={clsx('flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gold bg-white transition-all duration-400', active && '!border-[transparent] !bg-[transparent]')}>
                    <StarIcon className="relative z-20 block w-[12px]" />
                  </div>
                  <div
                    className="absolute top-full left-1/2 z-10 mt-[-8px] flex h-[40px] -translate-x-1/2 items-center gap-[8px] rounded-full bg-white px-[18px] transition-all ease-[var(--ease-soft)]"
                    style={{ transitionDuration: `${TIMING.contentMs}ms`, clipPath: active ? 'circle(100% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
                  >
                    <div className="font-secondary relative flex translate-y-[-2px] items-center text-[32px] leading-[0.9em] font-semibold text-gold">
                      <div className="scale-pulse absolute inset-0 -z-1 aspect-square w-[32px] translate-x-[-14px] scale-120 rounded-full border border-white" />
                      <div className="scale-pulse absolute inset-0 -z-1 aspect-square w-[32px] translate-x-[-14px] scale-120 rounded-full border border-white" style={{ animationDelay: '1.5s' }} />
                      {record.number}
                    </div>
                    <div className="font-tertiary flex flex-col text-[10px] leading-[1.1em] font-medium">
                      <p className="text-center whitespace-nowrap text-black uppercase">{record.title[locale]}</p>
                      <p className="text-center whitespace-nowrap text-link uppercase">{record.label[locale]}</p>
                    </div>
                    <div className="block">
                      <RecordGlyph icon={record.icon} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Previous and next for the records, centred along the bottom of the window. */
export function RecordsNav() {
  const showRecords = useStore((s) => s.showRecords);
  const go = (dir: 1 | -1) => {
    const s = useStore.getState();
    selectRecord(RECORDS[(s.currentRecord.order + dir + RECORDS.length) % RECORDS.length]);
  };
  return (
    <>
      <div className={clsx('fixed bottom-[80px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-x-[32px] transition-all duration-700', showRecords ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-120 opacity-0')}>
        <div className={clsx('transition-all duration-400', showRecords && 'scale-100')}>
          <PrevButton onClick={() => go(-1)} />
        </div>
        <div className="font-tertiary pointer-events-none text-[16px] font-black whitespace-nowrap text-white uppercase opacity-0">Explore more</div>
        <div className={clsx('transition-all duration-400', showRecords && 'scale-100')}>
          <NextButton onClick={() => go(1)} />
        </div>
      </div>

    </>
  );
}
