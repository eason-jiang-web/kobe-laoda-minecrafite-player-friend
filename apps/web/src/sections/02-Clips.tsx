"use client";

import { clips } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 02 — Clips (source: "Latest"). Big thin display header + count, then an
 * editorial grid of gameplay thumbnails with 11px mono captions (title / mode /
 * date). Source uses videos; we render captioned tiles (assets are stand-ins —
 * 6/12 source videos failed magic-byte validation on capture).
 */
export function Clips() {
  return (
    <section id="clips" className="bg-canvas px-[10px] py-24 md:px-5 md:py-32">
      <div className="mb-12 flex items-end justify-between">
        <h2 className="font-display text-display font-light leading-[0.85] tracking-tightest text-ink">
          clips
        </h2>
        <span className="font-display text-display font-light leading-[0.85] text-ink">
          {clips.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-[10px] md:grid-cols-3 lg:grid-cols-3">
        {clips.map((clip, i) => (
          <Reveal key={clip.title} delay={(i % 3) * 0.06} className="group">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
              <div className="absolute inset-0 grid place-items-center opacity-30 transition-opacity duration-500 group-hover:opacity-50">
                <span className="font-display text-7xl text-white/60">{i + 1}</span>
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="u-label text-ink">{clip.title}</span>
              <span className="u-label text-muted">{clip.who}</span>
              <span className="u-label text-ink">{clip.date}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
