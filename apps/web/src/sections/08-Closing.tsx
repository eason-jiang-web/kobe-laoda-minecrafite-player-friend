"use client";

import { brand } from "@/lib/content";
import { Reveal } from "@/components/Reveal";
import { ParallaxWordmark } from "@/components/ParallaxWordmark";

/**
 * 08 — Closing banner. Full-bleed photo (the one clean captured image), centered
 * Manrope statement, and the parallax wordmark anchored at the bottom. Doubles as
 * the early-access CTA anchor (#cta). Source: "VISUAL STORYTELLING BASED IN
 * BRATISLAVA" + "WA·CO®". itto: "your world, with a friend in it" + "it·to®".
 */
export function Closing() {
  return (
    <section
      id="cta"
      className="relative flex h-[100svh] w-full flex-col justify-between overflow-hidden bg-ink px-[10px] pb-6 pt-24 md:px-5 md:pb-8"
    >
      <img
        src="/img/crew.webp"
        alt="a friend in your world"
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* centered statement + CTA */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center text-white">
        <Reveal>
          <h2 className="font-sans text-h2 font-medium uppercase leading-snug">
            visual co-op
            <br />
            in your world
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <a
            href="https://github.com/silaswu4/itto"
            className="u-label border border-white/40 px-5 py-3 transition-colors hover:bg-white hover:text-ink"
          >
            get early access
          </a>
        </Reveal>
      </div>

      {/* parallax wordmark */}
      <div className="relative">
        <ParallaxWordmark />
        <p className="u-label mt-4 text-white/70">est. {brand.year}</p>
      </div>
    </section>
  );
}
