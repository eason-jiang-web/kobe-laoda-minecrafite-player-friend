"use client";

import { HeaderReveal } from "@/components/HeaderReveal";
import { points } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 05 — Points. Desktop source geometry: 643px tall, centered headline at the
 * top and two mono text blocks across the middle.
 */
export function Points() {
  return (
    <section
      id="points"
      className="relative h-auto overflow-hidden bg-canvas px-[10px] py-24 md:h-[470px] md:px-5"
    >
      <div className="mx-auto max-w-[550px] text-center">
        <HeaderReveal className="font-sans text-[24px] font-medium uppercase leading-none text-ink">
          {points.manifesto}
        </HeaderReveal>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-10 md:absolute md:left-5 md:right-5 md:top-[244px] md:mt-0 md:flex md:justify-between">
        <Reveal className="max-w-[420px]">
          <p className="u-label mb-6 text-muted">{points.left.head}</p>
          <p className="u-label text-ink">{points.left.body}</p>
        </Reveal>
        <Reveal delay={0.08} className="max-w-[420px] md:text-right">
          <p className="u-label mb-6 text-muted">{points.right.head}</p>
          <p className="u-label text-ink">{points.right.body}</p>
        </Reveal>
      </div>
    </section>
  );
}
