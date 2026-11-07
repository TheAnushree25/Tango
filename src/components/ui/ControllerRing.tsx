'use client';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import RingDots from '@/components/ui/RingDots';

/** The main dotted ring. It stays on every route and shrinks when the records open. */
export default function ControllerRing() {
  const showRecords = useStore((s) => s.showRecords);
  const pathname = usePathname();
  const isRecords = showRecords && pathname === '/';
  return (
    <div className={clsx('ctrl-shell pointer-events-none fixed top-1/2 left-1/2 z-[1] -translate-x-1/2 -translate-y-1/2', isRecords && 'is-records')}>
      <div className="absolute top-1/2 left-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
        <div className="ui-circle h-full w-full origin-center will-change-transform">
          <RingDots maskClass="ui-circle-mask" dash="1 18" />
        </div>
      </div>
    </div>
  );
}
