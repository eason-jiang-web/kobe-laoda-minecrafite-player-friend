"use client";

import { brand } from "@/lib/content";
import { HeaderReveal } from "@/components/HeaderReveal";
import { ParallaxWordmark } from "@/components/ParallaxWordmark";

/**
 * 08 — Closing banner. Source geometry: 990px full-bleed media, four tiny corner
 * marks, centered est/headline/year cluster, and a 160px split wordmark pinned
 * near the bottom.
 */
export function Closing() {
  const year = brand.year;

  return (
    <section
      id="cta"
      className="relative h-[990px] w-full overflow-hidden bg-ink px-[10px] text-white md:px-5"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="pointer-events-none absolute left-5 top-5 h-2 w-2 border-l border-t border-white" />
      <div className="pointer-events-none absolute right-5 top-5 h-2 w-2 border-r border-t border-white" />
      <div className="pointer-events-none absolute bottom-5 left-5 h-2 w-2 border-b border-l border-white" />
      <div className="pointer-events-none absolute bottom-5 right-5 h-2 w-2 border-b border-r border-white" />

      <p className="u-label absolute left-1/2 top-[21px] -translate-x-1/2 text-center">
        est.
      </p>

      <div className="absolute left-5 right-5 top-[471px] flex h-12 items-center justify-between">
        <p className="u-label text-left">{year.slice(0, 2)}</p>
        <HeaderReveal className="w-[460px] text-center font-sans text-[24px] font-medium uppercase leading-none">
          visual co-op
          <br />
          in your world
        </HeaderReveal>
        <p className="u-label text-right">{year.slice(2)}</p>
      </div>

      <div className="absolute bottom-5 left-5 right-5 h-[148px]">
        <ParallaxWordmark />
      </div>
    </section>
  );
}
