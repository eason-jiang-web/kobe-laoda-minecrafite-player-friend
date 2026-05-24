"use client";

import { about } from "@/lib/content";
import { Reveal } from "@/components/Reveal";
import { Arrow } from "@/components/Arrow";
import { brand } from "@/lib/content";

/**
 * 03 — About. Four equal desktop columns, then the source-style 160px redirect
 * wordmark band. The measured live section is 1440x564 with 20px gutters and
 * 96px vertical padding.
 */
export function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-canvas px-[10px] py-24 md:px-5">
      <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-x-0">
        {/* intro block */}
        <Reveal className="col-span-2 max-w-[285px] md:col-span-1">
          <p className="u-label mb-[25px] text-ink">
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
            <p className="u-label mb-6 text-muted">{col.head}</p>
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

      {/* redirect band — y=60 big-block slide like the source */}
      <Reveal
        y={60}
        className="mt-[49px] flex h-40 items-center justify-between text-ink no-underline"
      >
        <h2 className="font-display text-[160px] font-light uppercase leading-[0.8] tracking-[-0.05em] text-ink">
          about
        </h2>
        <Arrow className="h-40 w-40 shrink-0 text-ink" />
      </Reveal>
    </section>
  );
}
