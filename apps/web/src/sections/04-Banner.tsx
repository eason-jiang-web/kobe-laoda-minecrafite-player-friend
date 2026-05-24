"use client";

import { banners } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 04 — Banner. Full-bleed video with two stacked Manrope headers overlaid
 * (source: "FILM PRODUCTION & DIRECTION" / "creating solutions for business").
 * Uses the one clean captured video. itto copy: "FOLLOWS YOU & HELPS OUT".
 */
export function Banner() {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        src="/video/banner.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex h-full flex-col items-center justify-center gap-16 text-center text-white">
        <Reveal>
          <h2 className="font-sans text-h2 font-medium uppercase leading-tight">
            {banners.primary[0]}
            <br />
            {banners.primary[1]}
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-sans text-h2 font-medium uppercase leading-tight">
            {banners.secondary[0]}
            <br />
            {banners.secondary[1]}
          </h2>
        </Reveal>
      </div>
    </section>
  );
}
