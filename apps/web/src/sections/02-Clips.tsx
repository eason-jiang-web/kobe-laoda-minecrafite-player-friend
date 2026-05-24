"use client";

import { clips } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 02 — Clips (source: "Latest"). Verified against the LIVE site at 1440:
 *  - big "LATEST 5" header, then 2 large tiles per row, full-bleed, ~no gap
 *  - tiles are tall & cinematic (each ~half viewport), dominating the section
 *  - caption band under each tile: title (ink) + studio (muted) stacked on the
 *    LEFT, date pushed to the far RIGHT — not a cramped inline row
 * Tiles are video stand-ins (6/12 source videos failed magic-byte on capture).
 */
export function Clips() {
  return (
    <section id="clips" className="bg-canvas px-[10px] pb-16 pt-16 md:px-5 md:pb-20 md:pt-20">
      <Reveal y={60} className="mb-5 flex items-end justify-between md:mb-6">
        <h2 className="font-display text-[clamp(56px,9vw,120px)] font-light leading-[0.82] tracking-tightest text-ink">
          clips
        </h2>
        <span className="font-display text-[clamp(56px,9vw,120px)] font-light leading-[0.82] text-ink">
          {clips.length}
        </span>
      </Reveal>

      {/* 2-up, full-bleed, minimal gap — matches the live grid proportions */}
      <div className="grid grid-cols-1 gap-x-[6px] gap-y-10 md:grid-cols-2">
        {clips.map((clip, i) => (
          <Reveal key={clip.title} delay={(i % 2) * 0.08} className="group">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink">
              <video
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                src="/video/hero.mp4"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
            {/* caption band: title + studio stacked left, date far right */}
            <div className="mt-3 flex items-start justify-between">
              <div className="flex flex-col gap-[2px]">
                <span className="u-label text-ink">{clip.title}</span>
                <span className="u-label text-muted">{clip.who}</span>
              </div>
              <span className="u-label text-ink">{clip.date}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
