import type { RecordIcon } from '@/lib/content';

/** A plain five-pointed star, written as math rather than copied coordinates. */
export function starPath(cx: number, cy: number, r: number, inner = 0.42) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(3)} ${(cy + Math.sin(a) * rad).toFixed(3)}`;
  }
  return `${d}Z`;
}

export const StarIcon = ({ className, fill = '#D2B55D' }: { className?: string; fill?: string }) => (
  <svg viewBox="0 0 11 10" width="11" height="10" fill="none" className={className} aria-hidden>
    <path d={starPath(5.5, 5.4, 5.5)} fill={fill} />
  </svg>
);

/** Three small stars on an arc, used inside the big ENTER button. */
export const ThreeStars = () => (
  <svg width="30" height="15" viewBox="0 0 30 15" fill="none" aria-hidden>
    <path d={starPath(5, 10, 3.6)} fill="#f5f5f5" />
    <path d={starPath(15, 5, 3.6)} fill="#f5f5f5" />
    <path d={starPath(25, 10, 3.6)} fill="#f5f5f5" />
  </svg>
);

export const AudioBars = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
    <rect y="3" width="2" height="5" rx="1" fill="#D2B55D" />
    <rect x="3" width="2" height="11" rx="1" fill="#D2B55D" />
    <rect x="6" y="4" width="2" height="3" rx="1" fill="#D2B55D" />
    <rect x="9" y="3" width="2" height="5" rx="1" fill="#D2B55D" />
  </svg>
);

/** The small notched arrowhead on the previous and next buttons. */
const ARROW = 'M1 8.4 L11 15.4 L8.5 8.4 L10.8 1.4 Z';
export const ArrowHead = ({ color, className }: { color: string; className?: string }) => (
  <svg width="12" height="17" viewBox="0 0 12 17" fill="none" className={className} aria-hidden>
    <path d={ARROW} stroke={color} fill={color} />
  </svg>
);

export const LangArrow = ({ open }: { open: boolean }) => (
  <svg width="6" height="8" viewBox="0 0 6 8" fill="none" className="transition-all duration-400" style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden>
    <path d="M3 0.5V7M3 7L0.8 4.6M3 7L5.2 4.6" stroke="#D2B55D" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StopwatchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <circle cx="6.5" cy="7.5" r="4.7" stroke="#f5f5f5" />
    <path d="M6.5 7.5V4.8M5 1H8M6.5 1V2.8M10.6 3.4L9.8 4.2" stroke="#f5f5f5" strokeLinecap="round" />
  </svg>
);

export const RulerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path d="M1.2 9.3L9.3 1.2L11.8 3.7L3.7 11.8L1.2 9.3Z" stroke="#f5f5f5" strokeLinejoin="round" />
    <path d="M4 6.5L5.3 7.8M6 4.5L7.3 5.8M8 2.5L9.3 3.8" stroke="#f5f5f5" strokeLinecap="round" />
  </svg>
);

const stroke = { stroke: '#D2B55D', strokeWidth: 1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const PATHS: Record<RecordIcon, React.ReactNode> = {
  trophy: <path {...stroke} d="M4.5 2H10.5V6C10.5 7.7 9.2 9 7.5 9S4.5 7.7 4.5 6V2ZM4.5 3H2.5C2.5 5 3.3 6 4.8 6.3M10.5 3H12.5C12.5 5 11.7 6 10.2 6.3M7.5 9V11.5M5 13H10M5.8 11.5H9.2" />,
  armband: <path {...stroke} d="M2 4.5C5 3.2 10 3.2 13 4.5V10.5C10 9.2 5 9.2 2 10.5V4.5ZM6.2 8.3C6.2 8.3 5.8 6.8 7.5 6.8M9 6.8C8.5 6.2 7 5.8 6.2 7" />,
  medal: <path {...stroke} d="M5 1.5L7.5 6L10 1.5M3.5 1.5L6 6.2M11.5 1.5L9 6.2M11 9.5A3.5 3.5 0 1 1 4 9.5A3.5 3.5 0 0 1 11 9.5ZM7.5 8V11" />,
  pitch: <path {...stroke} d="M1.5 3H13.5V12H1.5V3ZM7.5 3V12M9.2 7.5A1.7 1.7 0 1 1 5.8 7.5A1.7 1.7 0 0 1 9.2 7.5ZM1.5 5.5H3.5V9.5H1.5M13.5 5.5H11.5V9.5H13.5" />,
  clock: <path {...stroke} d="M13 7.5A5.5 5.5 0 1 1 2 7.5A5.5 5.5 0 0 1 13 7.5ZM7.5 4V7.5L10 9" />,
  wins: <path {...stroke} d="M4 13C2 11 1.3 8.5 2 5.5M11 13C13 11 13.7 8.5 13 5.5M2 8.2L4 8.8M2.8 10.8L4.8 10.8M13 8.2L11 8.8M12.2 10.8L10.2 10.8M7.5 4L8.4 5.8L10.4 6L8.9 7.4L9.3 9.4L7.5 8.4L5.7 9.4L6.1 7.4L4.6 6L6.6 5.8L7.5 4Z" />,
  assist: <path {...stroke} d="M2 11C4.5 5 8 3.5 12.5 4M12.5 4L10 2M12.5 4L10.5 6.5M2 13H6" />,
  cake: <path {...stroke} d="M2 13H13M3 13V8H12V13M3 10.3C4.5 11.5 6 9 7.5 10.3C9 11.5 10.5 9 12 10.3M5 8V5.5M7.5 8V5.5M10 8V5.5M5 3.5V3M7.5 3.5V3M10 3.5V3" />,
  ball: <path {...stroke} d="M13 7.5A5.5 5.5 0 1 1 2 7.5A5.5 5.5 0 0 1 13 7.5ZM7.5 5.2L9.7 6.8L8.9 9.4H6.1L5.3 6.8L7.5 5.2ZM7.5 2V5.2M9.7 6.8L12.6 5.8M8.9 9.4L10.8 11.9M6.1 9.4L4.2 11.9M5.3 6.8L2.4 5.8" />,
  calendar: <path {...stroke} d="M2 4H13V13H2V4ZM2 6.8H13M5 2.2V5M10 2.2V5M5 9.5H6.5M8.5 9.5H10" />,
  boot: <path {...stroke} d="M3 2.5H7.5L8 7C9.5 8 12.5 8.3 13 10V11.5H3V2.5ZM3 13H5M7.5 13H9.5M11.5 13H13" />,
};

export const RecordGlyph = ({ icon }: { icon: RecordIcon }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
    {PATHS[icon]}
  </svg>
);

/** The sun emblem, used in the logo and the top label: it spins on its own layer. */
export const SunEmblem = ({ size = 26, spin = true }: { size?: number; spin?: boolean }) => (
  <span className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/svg/core.svg" alt="" width={size} height={size} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    <span className={spin ? 'animate-spin-slow absolute inset-0' : 'absolute inset-0'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/svg/sun.svg" alt="" width={size} height={size} className="block" />
    </span>
  </span>
);
