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
  const active = useRef<gsap.core.Animation | null>(null);

  useEffect(() => {
    const underline = line.current;
    if (!underline) return;

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
    }, root);

    return () => ctx.revert();
  }, []);

  const showUnderline = () => {
    const underline = line.current;
    if (!underline) return;

    active.current?.kill();
    gsap.set(underline, { transformOrigin: "left center" });
    active.current = gsap.to(underline, {
      scaleX: 1,
      duration: 0.42,
      ease: "power2.inOut",
      overwrite: true,
    });
  };

  const hideUnderline = () => {
    const underline = line.current;
    if (!underline) return;

    active.current?.kill();
    gsap.set(underline, { transformOrigin: "right center" });
    active.current = gsap.to(underline, {
      scaleX: 0,
      duration: 0.42,
      ease: "power2.inOut",
      overwrite: true,
    });
  };

  return (
    <a
      {...props}
      ref={root}
      className={`relative inline-block min-w-max ${className}`}
      onPointerEnter={showUnderline}
      onPointerLeave={hideUnderline}
      onFocus={showUnderline}
      onBlur={hideUnderline}
    >
      <span>{children}</span>
      <span
        ref={line}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full origin-right bg-current"
      />
    </a>
  );
}
