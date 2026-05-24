"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type HoverLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
};

export function HoverLink({ children, className = "", ...props }: HoverLinkProps) {
  const root = useRef<HTMLAnchorElement>(null);
  const line = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const underline = line.current;
    if (!el || !underline) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(underline, { scaleX: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(underline, {
        scaleX: 0,
        transformOrigin: "right center",
        willChange: "transform",
      });

      const enter = () => {
        gsap.fromTo(
          underline,
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 0.55, ease: "power3.out", overwrite: true },
        );
      };
      const leave = () => {
        gsap.to(underline, {
          scaleX: 0,
          duration: 0.34,
          ease: "power3.out",
          transformOrigin: "right center",
          overwrite: true,
        });
      };

      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);

      return () => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <a {...props} ref={root} className={`relative inline-block min-w-max ${className}`}>
      <span>{children}</span>
      <span
        ref={line}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full origin-right bg-current"
      />
    </a>
  );
}
