"use client";

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

      <span className="u-label absolute left-[10px] top-1/2 -translate-y-1/2 text-white md:left-5">
        {featured.title}
      </span>
      <span className="u-label absolute left-1/3 top-1/2 -translate-y-1/2 text-white">
        {featured.who}
      </span>
      <span className="u-label absolute left-2/3 top-1/2 -translate-y-1/2 text-white">
        {brand.location}
      </span>
      <span className="u-label absolute right-[10px] top-1/2 -translate-y-1/2 text-right text-white md:right-5">
        {brand.year}
      </span>

      <div className="absolute bottom-[17px] left-1/2 -translate-x-1/2 text-center text-white">
        <span className="u-label">scroll down</span>
      </div>
    </section>
  );
}
