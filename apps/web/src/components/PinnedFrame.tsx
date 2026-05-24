"use client";

import { useEffect, useState } from "react";
import { brand, nav } from "@/lib/content";

/**
 * Fixed desktop header from the source: 50px tall, with brand/nav on the left
 * and metadata columns across the top rail. The live page renders this white on
 * canvas sections, so it mostly disappears there and stays visible on footage.
 */
export function PinnedFrame() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <header
      className="pointer-events-none fixed left-0 top-0 z-50 hidden h-[50px] w-full md:block"
      style={{
        transform: shown ? "translateY(0)" : "translateY(-50px)",
        transition: "transform 0.9s cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform",
      }}
    >
      <div className="relative h-full w-full text-white">
        <a
          href="#top"
          className="u-label pointer-events-auto absolute left-5 top-5 hover:opacity-60"
        >
          {brand.mark}
        </a>

        <nav className="u-label pointer-events-auto absolute left-5 top-[35px] flex items-center gap-[5px]">
          {nav.map((item, index) => (
            <span key={item.href} className="flex items-center gap-[5px]">
              <a href={item.href} className="hover:opacity-60">
                {item.label}
              </a>
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
          <a
            href={`mailto:${brand.email}`}
            className="pointer-events-auto hover:opacity-60"
          >
            {brand.email}
          </a>
          <br />
          <a href="#cta" className="pointer-events-auto hover:opacity-60">
            early access
          </a>
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
