"use client";

import { Reveal } from "@/components/Reveal";
import { brand, clips } from "@/lib/content";

/**
 * 06 — Works. Source geometry is the desktop works/hero component: full-screen
 * footage with a four-column midline metadata band and bottom scroll cue.
 */
export function Works() {
  const featured = clips[0];

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/10" />

      <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-white md:left-5">
        <Reveal as="span" className="u-label inline-block">
          {featured.title}
        </Reveal>
      </div>
      <div className="absolute left-1/3 top-1/2 -translate-y-1/2 text-white">
        <Reveal as="span" delay={0.06} className="u-label inline-block">
          {featured.who}
        </Reveal>
      </div>
      <div className="absolute left-2/3 top-1/2 -translate-y-1/2 text-white">
        <Reveal as="span" delay={0.12} className="u-label inline-block">
          {brand.location}
        </Reveal>
      </div>
      <div className="absolute right-[10px] top-1/2 -translate-y-1/2 text-right text-white md:right-5">
        <Reveal as="span" delay={0.18} className="u-label inline-block">
          {brand.year}
        </Reveal>
      </div>

      <div className="absolute bottom-[17px] left-1/2 -translate-x-1/2 text-center text-white">
        <Reveal as="span" delay={0.24} className="u-label inline-block">
          scroll down
        </Reveal>
      </div>
    </section>
  );
}
