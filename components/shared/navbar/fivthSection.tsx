"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { MapPin } from "lucide-react";

/* ---------------- glitter ---------------- */
const STAR_COUNT = 26;
const GLOW = "212, 175, 55";

const STAR_PATH =
  "M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z";

const FivthSection = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const root = rootRef.current!;
    const layer = sparkleRef.current!;
    const q = gsap.utils.selector(root);
    const rand = gsap.utils.random;
    const one = (n: string) =>
      root.querySelector<HTMLElement>(`[data-intro="${n}"]`);

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-intro]"), { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const title = one("title");
      const date = one("date");
      const text = one("text");
      const sep = one("sep1");

      const from = { autoAlpha: 0, y: 18, filter: "blur(8px)" };
      const to = {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power3.out",
        clearProps: "filter",
      };

      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 60%", once: true },
      });

      if (title) tl.fromTo(title, from, to, 0);
      if (sep) {
        tl.fromTo(
          sep,
          { autoAlpha: 0, clipPath: "inset(0% 50% 0% 50%)" },
          {
            autoAlpha: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.3,
            ease: "power2.inOut",
            clearProps: "clipPath",
          },
          "0", // starts 0.15s before title ends → overlaps slightly for smoothness
        );
      }
      if (date) tl.fromTo(date, from, to, 0.35);
      if (text) tl.fromTo(text, from, to, 0.7);
      /* ============ GLITTER ============ */
      const stars = gsap.utils.toArray<HTMLElement>("[data-star]", layer);

      const place = (star: HTMLElement) => {
        const s = rand(7, 15);
        gsap.set(star, {
          left: `${rand(2, 96)}%`,
          top: `${rand(2, 96)}%`,
          width: s,
          height: s,
        });
      };

      const twinkles = stars.map((star) => {
        place(star);
        return gsap
          .timeline({
            paused: true,
            repeat: -1,
            delay: rand(0.5, 4),
            onRepeat: () => place(star),
          })
          .fromTo(
            star,
            { opacity: 0, scale: 0, rotation: rand(-25, 25) },
            {
              opacity: rand(0.7, 1),
              scale: rand(0.8, 1.2),
              rotation: "+=50",
              duration: rand(0.6, 1),
              ease: "power2.out",
            },
          )
          .to(star, {
            opacity: 0,
            scale: 0,
            rotation: "+=50",
            duration: rand(0.8, 1.4),
            ease: "power2.in",
          })
          .to({}, { duration: rand(0.2, 2.2) });
      });

      ScrollTrigger.create({
        trigger: root,
        start: "top 70%",
        end: "bottom top",
        onToggle: (self) => twinkles.forEach((t) => t.paused(!self.isActive)),
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="bg-[url('/envelope/garden.png')] relative flex -mt-25 justify-center flex-col items-center bg-center bg-cover w-full h-dvh"
    >
      <div className="bg-[#F7EFE2] opacity-60 absolute w-full h-full" />

      <div className="flex flex-col justify-center items-center -mt-10 relative">
        <div
          data-intro="title"
          className="invisible z-2 mb-2 flex flex-col justify-center items-center px-4 font-extrabold  text-red-950"
        >
          <p className="mb-2 text-xl">أين نلتقي؟</p>
          <p className="text-sm font-sans text-center">
            يسعدنا أن نلتقي بكم في المكان الذي سيشهد فرحتنا ويجمع أحبابنا تحت
            سقف واحد، لنحتفل معًا بهذه المناسبة الغالية.
          </p>
        </div>
        <div
          data-intro="sep1"
          className="invisible mb-10 bg-[url('/envelope/goldenSeperator.png')] w-full h-10 -inset-s-10 scale-y-[-1] bg-center bg-contain bg-no-repeat"
        />

        <div
          data-intro="date"
          className="invisible z-2 mb-8 space-y-3 font-extrabold text-center text-lg  text-red-950"
        >
          <p className="text-lg">صالة ميديا</p>
          <p className="text-lg">حي الأشرفية</p>
        </div>

        <div
          data-intro="text"
          className="invisible z-2 mb-5 flex justify-center items-center gap-2 flex-col font-bold   text-red-950"
        >
          <div className="bg-[url('/envelope/mapPin.png')] size-30 bg-center bg-contain bg-no-repeat" />

          <Link href="/" className=" w-full text-center">
            فتح في الخريطة
          </Link>
        </div>
      </div>

      <div
        ref={sparkleRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <svg width="0" height="0" className="absolute">
          <defs>
            <radialGradient id="starGoldThird">
              <stop offset="0%" stopColor="#fffbe6" />
              <stop offset="45%" stopColor="#f5d36b" />
              <stop offset="100%" stopColor="#c8952b" />
            </radialGradient>
          </defs>
        </svg>

        {Array.from({ length: STAR_COUNT }, (_, i) => (
          <span
            key={i}
            data-star
            className="absolute opacity-0"
            style={{ filter: "drop-shadow(0 0 3px rgba(212,160,40,0.9))" }}
          >
            {i % 4 === 0 ? (
              <span
                className="block size-full rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, #fff6d6 0%, #f0c75e 45%, transparent 70%)",
                }}
              />
            ) : (
              <svg viewBox="0 0 24 24" className="block size-full">
                <path d={STAR_PATH} fill="url(#starGoldThird)" />
              </svg>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default FivthSection;
