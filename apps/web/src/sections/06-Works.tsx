"use client";

import { Reveal } from "@/components/Reveal";

/**
 * 06 — Works (source: a second full-bleed "Hero"-style block with floating
 * labels). For itto this is the "see it in action" feature block — full-bleed
 * footage with corner labels, echoing the section-01 hero treatment.
 */
export function Works() {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/banner.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/25" />

      <div className="absolute inset-0 flex items-center justify-between px-[10px] text-white md:px-5">
        <span className="u-label max-w-[160px]">mines, builds, fights mobs</span>
        <span className="u-label max-w-[160px] text-right">carries your loot</span>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center text-white">
        <Reveal>
          <span className="u-label">always in your call</span>
        </Reveal>
      </div>
    </section>
  );
}
