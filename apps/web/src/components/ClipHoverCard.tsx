"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type ClipHoverCardProps = {
  title: string;
  who: string;
  date: string;
  videoSrc: string;
  mediaClassName: string;
};

export function ClipHoverCard({
  title,
  who,
  date,
  videoSrc,
  mediaClassName,
}: ClipHoverCardProps) {
  const root = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const video = media.current;
    const text = caption.current;
    if (!el || !video || !text) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.set(video, { scale: 1, filter: "grayscale(0)", willChange: "transform, filter" });
      gsap.set(text, { y: 0, willChange: "transform" });

      const enter = () => {
        gsap.to(video, {
          scale: 1.03,
          filter: "grayscale(1)",
          duration: 0.75,
          ease: "power3.out",
          overwrite: true,
        });
        gsap.fromTo(
          text,
          { y: 10 },
          { y: 0, duration: 0.75, ease: "power3.out", overwrite: true },
        );
      };
      const leave = () => {
        gsap.to(video, {
          scale: 1,
          filter: "grayscale(0)",
          duration: 0.75,
          ease: "power3.out",
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
    <div ref={root} className="group">
      <div className={`${mediaClassName} relative overflow-hidden bg-ink`}>
        <div
          ref={media}
          className="absolute inset-0 h-full w-full"
        >
          <video
            className="h-full w-full object-cover"
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      </div>
      <div ref={caption} className="grid h-[41px] grid-cols-2 px-5 pt-3">
        <div>
          <span className="u-label text-ink">{title}</span>
          <br />
          <span className="u-label text-muted">{who}</span>
        </div>
        <span className="u-label text-ink">{date}</span>
      </div>
    </div>
  );
}
