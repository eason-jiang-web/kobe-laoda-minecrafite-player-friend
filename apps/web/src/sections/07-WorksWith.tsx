"use client";

import { worksWith } from "@/lib/content";

/**
 * 07 — Works With (source: "Clients"). Compact centered mono block: muted label
 * above one wrapped pipe-separated line.
 */
export function WorksWith() {
  return (
    <section className="relative h-[267px] overflow-hidden bg-canvas px-[10px] md:px-5">
      <p className="u-label absolute left-1/2 top-[78px] -translate-x-1/2 text-muted">
        works with
      </p>
      <p className="u-label absolute left-1/2 top-[117px] w-full max-w-[650px] -translate-x-1/2 text-center text-ink">
        {worksWith.join(" | ")}
      </p>
    </section>
  );
}
