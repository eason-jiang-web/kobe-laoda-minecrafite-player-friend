"use client";

import { worksWith } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 07 — Works With (source: "Clients"). A label + a list of names. Source renders
 * them as a stacked mono list; itto lists the stack/integrations it plays with.
 */
export function WorksWith() {
  return (
    <section className="bg-canvas px-[10px] py-24 md:px-5 md:py-32">
      <p className="u-label mb-10 text-muted">works with</p>
      <ul className="grid grid-cols-2 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
        {worksWith.map((name, i) => (
          <Reveal key={name} delay={(i % 4) * 0.05} as="li">
            <span className="u-label text-ink">{name}</span>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
