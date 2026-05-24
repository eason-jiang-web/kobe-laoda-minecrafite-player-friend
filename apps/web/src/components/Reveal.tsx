"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal wrapper — matches the MEASURED wideangles entrance behavior
 * (reference/wideangles/motion/appear-effects.json):
 *
 *   transform: translateY(20px|60px) -> translateY(0)
 *   opacity:   held at 1 (NO fade) — Framer animates transform only
 *   ease:      expo-out, will-change: transform
 *
 * The original does a clean SLIDE-UP, not a fade. Fading made our reveals feel
 * mushy/generic; this is the crisp framer-tier slide. Use y=60 for big section
 * blocks (headers), y=20 for text/labels (the two distances the site uses).
 *
 * React owns the shown state (a re-render can't clobber it back to hidden — that
 * race once froze the clip tiles). IntersectionObserver is reliable under headed
 * capture (PLAYBOOK §5); reduced-motion shows instantly; a safety timeout means
 * content can never stay stuck off-screen.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 20,
  as: Tag = "div",
}: {
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: keyof JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);

    const fallback = window.setTimeout(() => setShown(true), 2000);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      style={{
        // transform-only reveal, like the source. opacity holds at 1.
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition: "transform 0.9s cubic-bezier(0.16,1,0.3,1)",
        transitionDelay: shown ? `${delay}s` : "0s",
        willChange: "transform",
      }}
    >
      {children}
    </Component>
  );
}
