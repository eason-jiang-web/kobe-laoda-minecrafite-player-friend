"use client";

import { worksWith } from "@/lib/content";

type WorksIconProps = {
  label: string;
};

function WorksIcon({ label }: WorksIconProps) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (label === "DISCORD VOICE") {
    return (
      <svg {...common}>
        <path d="M7.5 8.5c2.6-1.1 6.4-1.1 9 0" />
        <path d="M8 16.5c-2-.7-3-1.8-3-1.8.2-3.2 1.1-5.7 2.7-7.7 1.4-.7 2.7-1 2.7-1l.6 1.1" />
        <path d="M16 16.5c2-.7 3-1.8 3-1.8-.2-3.2-1.1-5.7-2.7-7.7-1.4-.7-2.7-1-2.7-1l-.6 1.1" />
        <path d="M9.5 13h.01" />
        <path d="M14.5 13h.01" />
      </svg>
    );
  }

  if (label === "MINEFLAYER") {
    return (
      <svg {...common}>
        <path d="m5 19 8.5-8.5" />
        <path d="m10.5 5 8.5 8.5" />
        <path d="m12.5 3 3 3-3.5 3.5-3-3z" />
        <path d="m17 12 2 2-3 3-2-2" />
      </svg>
    );
  }

  if (label === "ELEVENLABS") {
    return (
      <svg {...common}>
        <path d="M5 17V7" />
        <path d="M9.5 19V5" />
        <path d="M14.5 19V5" />
        <path d="M19 17V7" />
      </svg>
    );
  }

  if (label === "JAVA EDITION") {
    return (
      <svg {...common}>
        <path d="M8 18h8" />
        <path d="M7 10h10v3a5 5 0 0 1-10 0z" />
        <path d="M17 11h1.5a1.5 1.5 0 0 1 0 3H17" />
        <path d="M10 3c1.5 1.2-1.2 2.2.4 3.5" />
        <path d="M13.5 3c1.5 1.2-1.2 2.2.4 3.5" />
      </svg>
    );
  }

  if (label === "MINEHUT") {
    return (
      <svg {...common}>
        <path d="M12 3 4.5 7.2v9.1L12 21l7.5-4.7V7.2z" />
        <path d="M12 12 4.8 7.4" />
        <path d="M12 12v8.5" />
        <path d="m12 12 7.2-4.6" />
      </svg>
    );
  }

  if (label === "CLAUDE") {
    return (
      <svg {...common}>
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <path d="m5.6 5.6 12.8 12.8" />
        <path d="m18.4 5.6-12.8 12.8" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M16 19v-1.5a4 4 0 0 0-8 0V19" />
      <circle cx="12" cy="8" r="3" />
      <path d="M4 18v-1a3 3 0 0 1 3-3" />
      <path d="M20 18v-1a3 3 0 0 0-3-3" />
    </svg>
  );
}

/**
 * 07 — Works With. Compact label above a looping integration marquee.
 */
export function WorksWith() {
  return (
    <section className="relative h-[267px] overflow-hidden bg-canvas px-[10px] md:px-5">
      <p className="u-label absolute left-1/2 top-[78px] -translate-x-1/2 text-muted">
        works with
      </p>
      <div className="logo-marquee-window absolute left-1/2 top-[116px] w-[calc(100vw-20px)] max-w-[840px] -translate-x-1/2 overflow-hidden">
        <div className="logo-marquee flex w-max items-center text-ink">
          {[0, 1].map((setIndex) => (
            <div key={setIndex} className="flex items-center gap-3 pr-3 md:gap-4 md:pr-4">
              {worksWith.map((label) => (
                <div
                  key={`${label}-${setIndex}`}
                  className="flex h-10 w-[152px] shrink-0 items-center justify-center gap-2 border border-ink/20 bg-canvas px-3 text-center"
                >
                  <WorksIcon label={label} />
                  <span className="u-label whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
