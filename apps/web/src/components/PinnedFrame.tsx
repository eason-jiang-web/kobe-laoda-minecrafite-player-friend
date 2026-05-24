"use client";

import { brand, nav } from "@/lib/content";

/**
 * The pinned frame — the signature wideangles element. In the capture, a footer
 * block (brand / email / nav / rights) stays pinned across EVERY section boundary
 * (scrollY 0→7306, vpTopSlope 0 = pinned). Implemented as fixed corners overlaid
 * on the page, mix-blend so the labels invert against dark video and light canvas
 * sections alike.
 */
export function PinnedFrame() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 mix-blend-difference">
      <div className="relative h-full w-full px-[10px] py-[14px] text-white md:px-5 md:py-5">
        {/* top-left: brand mark */}
        <a
          href="#top"
          className="u-label pointer-events-auto absolute left-[10px] top-[14px] md:left-5 md:top-5"
        >
          {brand.mark}
          <br />
          {brand.tagline}
        </a>

        {/* top-right: location / year */}
        <div className="u-label absolute right-[10px] top-[14px] text-right md:right-5 md:top-5">
          {brand.location}
          <br />
          est. {brand.year}
        </div>

        {/* bottom-left: rights */}
        <div className="u-label absolute bottom-[14px] left-[10px] md:bottom-5 md:left-5">
          all rights reserved
          <br />
          {brand.name}
        </div>

        {/* bottom-right: nav + email */}
        <div className="absolute bottom-[14px] right-[10px] flex flex-col items-end gap-[2px] md:bottom-5 md:right-5">
          <nav className="pointer-events-auto flex flex-col items-end gap-[2px]">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="u-label hover:opacity-60">
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href={`mailto:${brand.email}`}
            className="u-label pointer-events-auto mt-2 hover:opacity-60"
          >
            {brand.email}
          </a>
        </div>
      </div>
    </div>
  );
}
