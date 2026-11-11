"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ------------------------------------------------------------------ */
/* Target date                                                         */
/* ------------------------------------------------------------------ */
// The wedding date: Sunday 12/12/2026 (local time).
// Set the hour you want (e.g. 18:00 for 6 PM). Adjust if needed.
const TARGET_DATE = new Date(2026, 11, 12, 18, 0, 0); // month is 0-indexed

/* ---------------- glitter ---------------- */
const STAR_COUNT = 16; // was 26 - fewer layers = smoother scroll
const GLOW = "212, 175, 55"; // gold used for the text glow

/* ---------------- scroll ---------------- */
// Every block reveals by its OWN position on screen (not the whole section's),
// so it still works if the section is short, tall, or the layout shifts.
// Block top at 98% of the screen (just entering) -> block top at 50% (screen middle).
// That is about half a screen of scrolling per block. Make the gap bigger = slower, clearer.
// clamp() keeps the end point reachable even when the page can't scroll any further
// (needs GSAP 3.12+).
const REVEAL_START = "clamp(top 90%)";
const REVEAL_END = "clamp(top 30%)";

// 4-point sparkle shape
const STAR_PATH =
  "M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const computeTimeLeft = (): TimeLeft => {
  const now = Date.now();
  const diff = Math.max(0, TARGET_DATE.getTime() - now);

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
};

/* ------------------------------------------------------------------ */
/* One countdown box                                                   */
/* ------------------------------------------------------------------ */
interface CountdownBoxProps {
  value: number;
  label: string;
}

const CountdownBox = ({ value, label }: CountdownBoxProps) => {
  // Pad to 2 digits (days can be 3+ digits so don't pad those)
  const display =
    label === "يوم" ? String(value) : String(value).padStart(2, "0");

  return (
    <div data-box className="invisible flex flex-col items-center gap-2">
      <div
        data-num
        className="
          flex items-center justify-center
          w-16 h-16 sm:w-24 sm:h-24
          rounded-2xl
          bg-gradient-to-b from-[#fdf6e3] to-[#f0e2c2]
          border-2 border-[#c8a25a]/60
          text-red-950 font-extrabold
          text-2xl sm:text-3xl
          tabular-nums
          select-none
        "
      >
        {display}
      </div>
      <span className=" font-sans font-extrabold text-red-950/80">{label}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Third section                                                       */
/* ------------------------------------------------------------------ */
const ThirdSection = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);

  // countdown tick: set immediately, then every second
  useEffect(() => {
    const f = () => {
      setTimeLeft(computeTimeLeft());
      const id = window.setInterval(() => {
        setTimeLeft(computeTimeLeft());
      }, 1000);
      return () => window.clearInterval(id);
    };
    f();
  }, []);

  // reveal (scrubbed by scroll) + glitter (runs while the section is on screen)
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const root = rootRef.current!;
    const layer = sparkleRef.current!;
    const q = gsap.utils.selector(root);
    const rand = gsap.utils.random;
    const one = (n: string) =>
      root.querySelector<HTMLElement>(`[data-intro="${n}"]`);

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation, no glitter
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-intro], [data-box]"), { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const title = one("title");
      const date = one("date");
      const text = one("text");
      const sep = one("sep1");
      const boxes = gsap.utils.toArray<HTMLElement>("[data-box]", root);
      const nums = gsap.utils.toArray<HTMLElement>("[data-num]", root);

      /* ============ REVEAL: each block scrubbed by its own position ============ */
      // no blur filter (slow while scrolling), no clearProps (must run backwards)
      const scrubTl = (trigger: Element) =>
        gsap.timeline({
          scrollTrigger: {
            trigger,
            start: REVEAL_START,
            end: REVEAL_END,
            scrub: 1.25,
            invalidateOnRefresh: true,
          },
        });

      // the three texts: each fades in and rises as it reaches the screen
      [title, date, text].forEach((el) => {
        if (!el) return;
        scrubTl(el).fromTo(
          el,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 1.2, ease: "power2.out" },
        );
      });

      // the four boxes pop in one by one, then the gold glow passes over the numbers
      const countdown = one("countdown");
      if (countdown) {
        const boxTl = scrubTl(countdown);
        boxTl.fromTo(
          boxes,
          { autoAlpha: 0, y: 18, scale: 0.94 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            ease: "power2.out",
            stagger: 0.22,
          },
          0,
        );
        boxTl.fromTo(
          nums,
          { textShadow: `0 0 0px rgba(${GLOW},0)` },
          {
            textShadow: `0 0 16px rgba(${GLOW},0.9)`,
            duration: 1.1,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
            stagger: 0.22,
          },
          0.9,
        );
      }

      // separator unfurls from the centre
      if (sep) {
        scrubTl(sep).fromTo(
          sep,
          { autoAlpha: 0, clipPath: "inset(0% 50% 0% 50%)" },
          {
            autoAlpha: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.3,
            ease: "power2.inOut",
          },
        );
      }

      /* ============ GLITTER: twinkles while this section is on screen ============ */
      const stars = gsap.utils.toArray<HTMLElement>("[data-star]", layer);

      const place = (star: HTMLElement) => {
        const s = rand(7, 15);
        gsap.set(star, {
          left: `${rand(2, 96)}%`,
          top: `${rand(2, 96)}%`,
          width: s,
          height: s,
          force3D: true,
        });
      };

      // built paused: the ScrollTrigger below starts / pauses them
      const twinkles = stars.map((star) => {
        place(star);
        return gsap
          .timeline({
            paused: true,
            repeat: -1,
            delay: rand(0.5, 4),
            onRepeat: () => place(star), // new spot + new size every cycle
          })
          .fromTo(
            star,
            { opacity: 0, scale: 0, rotation: rand(-25, 25) },
            {
              opacity: rand(0.7, 1),
              scale: rand(0.8, 1.2),
              rotation: "+=50",
              duration: rand(0.9, 1.4),
              ease: "power2.out",
            },
          )
          .to(star, {
            opacity: 0,
            scale: 0,
            rotation: "+=50",
            duration: rand(1.1, 1.8),
            ease: "power2.in",
          })
          .to({}, { duration: rand(0.6, 2.8) }); // rest before the next twinkle
      });

      ScrollTrigger.create({
        trigger: root,
        start: "top 90%",
        end: "bottom top",
        onToggle: (self) => twinkles.forEach((t) => t.paused(!self.isActive)),
      });
    });

    // re-measure once images and fonts have loaded: if the layout shifts after the
    // triggers were created, their start/end points would be wrong
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);

    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="bg-[url('/envelope/bg2.png')] px-4 relative flex -mt-30 justify-center flex-col items-center bg-center bg-cover w-full h-dvh"
    >
      <div className="bg-[#F7EFE2] opacity-60 absolute w-full h-full "></div>

      <div className="flex flex-col justify-center gap-8 items-center -mt-10 relative">
        <div
          data-intro="title"
          className="invisible z-2 mb-10 font-bold text-lg text-red-950 "
        >
          <p>لم يتبقَّ الكثير على أجمل ليالينا!</p>
        </div>

        <div
          data-intro="date"
          className="invisible z-2  mb-8 font-bold text-lg text-red-950"
        >
          <p>يوم الأحد :12/12/2026</p>
        </div>

        <div
          data-intro="text"
          className="invisible z-2 mb-5 font-bold text-sm text-center text-red-950 font-sans"
        >
          <p>
            كل ثانية تقرّبنا من لحظة طال انتظارها، ومن فرحة نتمنى أن نتشاركها
            معكم.
          </p>
        </div>

        {/* Real countdown: four boxes */}
        <div
          data-intro="countdown"
          className="z-2 mb-5 flex items-start justify-center gap-3 sm:gap-5"
        >
          <CountdownBox value={timeLeft.days} label="يوم" />
          <CountdownBox value={timeLeft.hours} label="ساعة" />
          <CountdownBox value={timeLeft.minutes} label="دقيقة" />
          <CountdownBox value={timeLeft.seconds} label="ثانية" />
        </div>

        <div
          data-intro="sep1"
          className="invisible bg-[url('/envelope/goldenSeperator.png')] w-full h-10 -inset-s-10 scale-y-[-1] bg-center bg-contain bg-no-repeat"
        ></div>
      </div>

      {/* glitter layer: behind the text, never blocks touches */}
      <div
        ref={sparkleRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* shared gold gradient for the stars (own id so it never clashes with FirstSection) */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <radialGradient id="starGoldThird">
              <stop offset="0%" stopColor="#fffbe6" />
              <stop offset="45%" stopColor="#f5d36b" />
              <stop offset="100%" stopColor="#c8952b" />
            </radialGradient>
          </defs>
        </svg>

        {/* no drop-shadow filter on the stars: 26 filtered layers repainting every
            frame was a big source of scroll lag. The gold gradient already glows. */}
        {Array.from({ length: STAR_COUNT }, (_, i) => (
          <span
            key={i}
            data-star
            className="absolute opacity-0 will-change-transform"
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

export default ThirdSection;
