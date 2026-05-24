"use client";

import { about } from "@/lib/content";
import { HeaderReveal } from "@/components/HeaderReveal";
import { Reveal } from "@/components/Reveal";
import { brand } from "@/lib/content";

/**
 * 03 — About. Editorial explanation with denser product context and compact
 * capability columns.
 */
export function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-canvas px-[10px] py-24 md:px-5 md:py-28">
      <div className="mb-16 flex h-40 items-center text-ink no-underline">
        <HeaderReveal className="font-display text-[160px] font-light uppercase leading-[0.8] tracking-normal text-ink">
          about
        </HeaderReveal>
      </div>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-x-5">
        <Reveal className="md:col-span-4">
          <p className="u-label mb-8 text-muted">
            {brand.name}
            <br />
            minecraft duo
            <br />
            {brand.year}
          </p>
          <p className="max-w-[360px] font-sans text-[28px] font-medium uppercase leading-[0.95] text-ink md:text-[36px]">
            {about.intro}
          </p>
        </Reveal>

        <div className="space-y-8 md:col-span-5">
          {about.body.map((paragraph, index) => (
            <Reveal key={paragraph} delay={index * 0.05}>
              <p className="font-sans text-[18px] font-medium leading-[1.18] text-ink md:text-[24px]">
                {paragraph}
              </p>
            </Reveal>
          ))}
        </div>

        <div className="md:col-span-3">
          <div className="grid grid-cols-3 border-y border-ink/20 md:grid-cols-1 md:border-y-0">
            {about.stats.map((stat, index) => (
              <Reveal
                key={stat.label}
                delay={index * 0.05}
                className="border-ink/20 py-4 md:border-t md:first:border-t-0"
              >
                <p className="font-display text-[42px] font-light uppercase leading-none text-ink">
                  {stat.value}
                </p>
                <p className="u-label mt-2 text-muted">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-10 border-t border-ink/20 pt-10 md:grid-cols-3 md:gap-5">
        {about.columns.map((col, i) => (
          <Reveal key={col.head} delay={i * 0.06}>
            <p className="u-label mb-6 text-muted">{col.head}</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 md:block md:space-y-1">
              {col.items.map((item) => (
                <li key={item} className="u-label text-ink">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
