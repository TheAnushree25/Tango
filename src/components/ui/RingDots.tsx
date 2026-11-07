'use client';

/** The giant dotted circle. A mask with a dash as long as the whole ring lets GSAP draw it on. */
export default function RingDots({ maskClass, dash }: { maskClass: string; dash: string }) {
  const id = `ring-${maskClass}`;
  return (
    <svg viewBox="0 0 1240 1240" fill="none" preserveAspectRatio="xMidYMid meet" className="ring-spin h-full w-full overflow-visible" aria-hidden>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1240" height="1240">
          <circle className={maskClass} cx="620" cy="620" r="619.5" fill="none" stroke="white" strokeWidth="10" transform="rotate(-90 620 620)" />
        </mask>
      </defs>
      <circle cx="620" cy="620" r="619.5" stroke="white" strokeDasharray={dash} mask={`url(#${id})`} />
    </svg>
  );
}
