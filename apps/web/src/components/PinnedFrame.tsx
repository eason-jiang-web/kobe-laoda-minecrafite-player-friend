"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { HoverLink } from "@/components/HoverLink";
import { brand, nav } from "@/lib/content";

/**
 * Fixed desktop header from the source: 50px tall, with brand/nav on the left
 * and metadata columns across the top rail. The live page renders this white on
 * canvas sections, so it mostly disappears there and stays visible on footage.
 */
export function PinnedFrame() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { y: -50 },
        { y: 0, duration: 0.9, ease: "expo.out", overwrite: true },
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={root}
      className="pointer-events-none fixed left-0 top-0 z-50 hidden h-[50px] w-full md:block"
      style={{
        transform: "translateY(-50px)",
        willChange: "transform",
      }}
    >
      <div className="relative h-full w-full text-white">
        <HoverLink
          href="#top"
          className="u-label pointer-events-auto absolute left-5 top-5"
        >
          {brand.mark}
        </HoverLink>

        <nav className="u-label pointer-events-auto absolute left-5 top-[35px] flex items-center gap-[5px]">
          {nav.map((item, index) => (
            <span key={item.href} className="flex items-center gap-[5px]">
              <HoverLink href={item.href}>
                {item.label}
              </HoverLink>
              {index < nav.length - 1 ? <span>/</span> : null}
            </span>
          ))}
        </nav>

        <div className="u-label absolute left-[25.55%] top-5">
          ai minecraft duo
          <br />
          based in {brand.location}
        </div>

        <div className="u-label absolute left-[50.35%] top-5">
          <HoverLink
            href={`mailto:${brand.email}`}
            className="pointer-events-auto"
          >
            {brand.email}
          </HoverLink>
          <br />
          <HoverLink href="#cta" className="pointer-events-auto">
            early access
          </HoverLink>
        </div>

        <div className="u-label absolute left-[74.5%] top-5">
          est. {brand.year}
          <br />
          kalilabs
        </div>
      </div>
    </header>
  );
}
