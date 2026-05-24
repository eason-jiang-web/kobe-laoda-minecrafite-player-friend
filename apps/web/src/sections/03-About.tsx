"use client";

import { about } from "@/lib/content";
import { Reveal } from "@/components/Reveal";
import { Arrow } from "@/components/Arrow";
import { brand } from "@/lib/content";

/**
 * 03 — About. 4-column data layout (intro + N label/list columns), then a giant
 * display word and a large ↗ arrow on the right. Mirrors the source's "ABOUT"
 * section exactly: tiny mono columns up top, huge word at the bottom.
 */
export function About() {
  return (
    <section id="about" className="relative bg-canvas px-[10px] pb-0 pt-24 md:px-5 md:pt-32">
      <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-x-8">
        {/* intro block */}
        <Reveal className="col-span-2 max-w-[34ch] md:col-span-1">
          <p className="u-label mb-4 text-ink">
            {brand.name}
            <br />
            minecraft duo
            <br />
            {brand.year}
          </p>
          <p className="u-label text-ink">{about.intro}</p>
        </Reveal>

        {/* data columns */}
        {about.columns.map((col, i) => (
          <Reveal key={col.head} delay={i * 0.06} className="col-span-1">
            <p className="u-label mb-4 text-muted">{col.head}</p>
            <ul className="space-y-1">
              {col.items.map((item) => (
                <li key={item} className="u-label text-ink">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>

      {/* giant word + arrow */}
      <div className="mt-20 flex items-end justify-between md:mt-32">
        <h2 className="font-display text-display font-light leading-[0.8] tracking-tightest text-ink">
          about
        </h2>
        <Arrow className="h-24 w-24 text-ink md:h-40 md:w-40 lg:h-56 lg:w-56" />
      </div>
    </section>
  );
}
