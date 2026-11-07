'use client';

import clsx from 'clsx';
import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowHead } from '@/components/ui/icons';

const ACTIVE = 'transform 0.3s var(--ease-soft-out)';
const INACTIVE = 'transform 0.5s var(--ease-settle)';

/** Pulls its child toward the cursor when the cursor comes within `padding` pixels. */
export function Magnet({
  children,
  padding = 100,
  strength = 2,
  disabled = false,
  className,
  ...rest
}: {
  children: ReactNode;
  padding?: number;
  strength?: number;
  disabled?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ active: false, x: 0, y: 0 });

  useEffect(() => {
    if (disabled || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (Math.abs(cx - e.clientX) < r.width / 2 + padding && Math.abs(cy - e.clientY) < r.height / 2 + padding) {
        setState({ active: true, x: (e.clientX - cx) / strength, y: (e.clientY - cy) / strength });
      } else {
        setState((s) => (s.active ? { active: false, x: 0, y: 0 } : s));
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [disabled, padding, strength]);

  return (
    <div ref={ref} className={className} {...rest}>
      <div style={{ transform: `translate3d(${state.x}px, ${state.y}px, 0)`, transition: state.active ? ACTIVE : INACTIVE, willChange: 'transform' }}>{children}</div>
    </div>
  );
}

const WHITE =
  'bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] group-hover:bg-gold group-hover:shadow-[0_0_10px_rgba(210,181,93,1)] group-hover/container:bg-gold group-hover/container:shadow-[0_0_10px_rgba(210,181,93,1)] hover:bg-gold hover:shadow-[0_0_10px_rgba(210,181,93,1)] group-hover:[&_.scale-pulse]:border-gold group-hover/container:[&_.scale-pulse]:border-gold hover:[&_.scale-pulse]:border-gold group-hover:[&_path]:fill-white group-hover/container:[&_path]:fill-white hover:[&_path]:fill-white group-hover:[&_rect]:fill-white group-hover/container:[&_rect]:fill-white hover:[&_rect]:fill-white';
const GOLD =
  'bg-gold shadow-[0_0_10px_rgba(210,181,93,1)] group-hover:bg-white group-hover:shadow-[0_0_10px_rgba(255,255,255,0.6)] group-hover/container:bg-white group-hover/container:shadow-[0_0_10px_rgba(255,255,255,0.6)] hover:bg-white hover:shadow-[0_0_10px_rgba(255,255,255,0.6)] group-hover:[&_.scale-pulse]:border-white group-hover/container:[&_.scale-pulse]:border-white hover:[&_.scale-pulse]:border-white [&_path]:fill-white group-hover:[&_path]:fill-gold group-hover/container:[&_path]:fill-gold hover:[&_path]:fill-gold';

/** The round button with its double expanding ring. */
export function PulseButton({
  size = 'md',
  color = 'white',
  gate = false,
  className,
  children,
  onClick,
}: {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'gold';
  /** Gate buttons belong to the intro's own step, not the main button reveal. */
  gate?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const ring = clsx('scale-pulse absolute inset-0 scale-100 rounded-full border', color === 'white' ? 'border-white' : 'border-gold');
  return (
    <div className={clsx('origin-center will-change-transform', gate ? 'gate-enter-btn' : 'ui-nav-btn')}>
      <div
        onClick={onClick}
        className={clsx(
          'js-hover-sound group relative flex origin-center cursor-pointer items-center justify-center rounded-full transition-all duration-700',
          '[&_path]:transition-[fill] [&_path]:duration-300 [&_rect]:transition-[fill] [&_rect]:duration-300',
          'group-hover:scale-120 group-hover/container:scale-120 hover:scale-120',
          size === 'lg' && 'h-[48px] w-[48px] lg:h-[80px] lg:w-[80px]',
          size === 'md' && 'h-[48px] w-[48px]',
          size === 'sm' && 'h-[20px] w-[20px]',
          color === 'white' ? WHITE : GOLD,
          className,
        )}
      >
        <div className={ring} />
        <div className={ring} style={{ animationDelay: '1.5s' }} />
        {children}
      </div>
    </div>
  );
}

export function PrevButton({ onClick, magnet = true }: { onClick?: () => void; magnet?: boolean }) {
  return (
    <Magnet className="inline-block" disabled={!magnet} padding={32} strength={2.5}>
      <PulseButton onClick={onClick} className="group relative">
        <div className="w-[16px] overflow-hidden">
          <div className="flex w-[32px] items-center justify-center transition-all duration-300 group-hover:-translate-x-[16px]">
            <ArrowHead color="#D2B55D" className="min-w-[16px] -translate-x-[2px]" />
            <ArrowHead color="#f5f5f5" className="min-w-[2px] -translate-x-[2px]" />
          </div>
        </div>
      </PulseButton>
    </Magnet>
  );
}

export function NextButton({ onClick, magnet = true }: { onClick?: () => void; magnet?: boolean }) {
  return (
    <Magnet className="inline-block" disabled={!magnet} padding={32} strength={2.5}>
      <PulseButton onClick={onClick} className="group relative">
        <div className="w-[16px] overflow-hidden">
          <div className="flex w-[32px] -translate-x-[12px] items-center justify-start transition-all duration-300 group-hover:translate-x-[2px]">
            <ArrowHead color="#f5f5f5" className="min-w-[16px] -translate-x-[2px] scale-x-[-1]" />
            <ArrowHead color="#D2B55D" className="min-w-[2px] -translate-x-[2px] scale-x-[-1]" />
          </div>
        </div>
      </PulseButton>
    </Magnet>
  );
}
