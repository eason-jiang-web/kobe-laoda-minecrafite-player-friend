"use client";

import { banners } from "@/lib/content";
import { HeaderReveal } from "@/components/HeaderReveal";

/**
 * 04 — Banner. Full-bleed video with two Manrope headers pinned to the top
 * corners, matching the live desktop banner geometry.
 */
export function Banner() {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full scale-[1.015] object-cover blur-[2px]"
        src="/video/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative h-full text-white">
        <div className="absolute left-5 top-11">
          <HeaderReveal className="font-sans text-[24px] font-medium uppercase leading-none">
            {banners.primary[0]}
            <br />
            {banners.primary[1]}
          </HeaderReveal>
        </div>
        <div className="absolute right-5 top-11 text-right">
          <HeaderReveal
            delay={0.1}
            className="font-sans text-[24px] font-medium uppercase leading-none"
          >
            {banners.secondary[0]}
            <br />
            {banners.secondary[1]}
          </HeaderReveal>
        </div>
      </div>
    </section>
  );
}
