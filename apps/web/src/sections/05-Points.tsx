"use client";

import { points } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 05 — Points. Centered manifesto statement (Manrope, uppercase) flanked by two
 * small mono columns (PROJECT FOCUS / APPROACH in source), over a thin row of
 * stills. itto: a centered manifesto with "the idea" / "the loop" side columns.
 */
export function Points() {
  return (
    <section id="points" className="bg-canvas px-[10px] py-28 md:px-5 md:py-40">
      <Reveal className="mx-auto mb-20 max-w-[60ch] text-center">
        <h2 className="font-sans text-h2 font-medium uppercase leading-snug text-ink">
          {points.manifesto}
        </h2>
      </Reveal>

      {/* thin still strip */}
      <div className="mb-20 grid grid-cols-3 gap-[10px] md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Reveal key={i} delay={(i % 5) * 0.05} className="aspect-video bg-ink/90" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <Reveal className="max-w-[44ch]">
          <p className="u-label mb-3 text-muted">{points.left.head}</p>
          <p className="u-label text-ink">{points.left.body}</p>
        </Reveal>
        <Reveal delay={0.08} className="max-w-[44ch] md:justify-self-end">
          <p className="u-label mb-3 text-muted">{points.right.head}</p>
          <p className="u-label text-ink">{points.right.body}</p>
        </Reveal>
      </div>
    </section>
  );
}
