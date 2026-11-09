"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const REVEAL_AT = 0.5; // reveal once ~50% is scratched
const BRUSH = 22; // brush radius in px

/* ---------------- glitter ---------------- */
const STAR_COUNT = 26; // more = more glitter
const GLOW = "212, 175, 55"; // gold used for the text glow

type Mode = "pending" | "mobile" | "desktop";

// 4-point sparkle shape
const STAR_PATH =
  "M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z";
interface FirstSectionProps {
  active: boolean;
}
const FirstSection = ({ active }: FirstSectionProps) => {
  const [mode, setMode] = useState<Mode>("pending");
  const [revealed, setRevealed] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const arrowsRef = useRef<HTMLDivElement>(null);

  // decide mobile vs desktop after mount (avoids hydration mismatch)
  useEffect(() => {
    if (!active) return;
    const mq = window.matchMedia("(pointer: coarse) and (max-width: 820px)");
    const update = () => setMode(mq.matches ? "mobile" : "desktop");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [active]);

  // scratch logic, mobile only
  useEffect(() => {
    if (!active || mode !== "mobile") return;

    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let done = false;
    let drawing = false;
    let last: { x: number; y: number } | null = null;
    let lastCheck = 0;

    // paint the foil cover
    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#d9b25f");
    grad.addColorStop(0.5, "#b88a3a");
    grad.addColorStop(1, "#d9b25f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const scratchLine = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = BRUSH * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    const clearedRatio = () => {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const step = 8;
      let cleared = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * step) {
        total++;
        if (data[i] === 0) cleared++;
      }
      return cleared / total;
    };

    const reveal = () => {
      if (done) return;
      done = true;
      setRevealed(true);

      const nums = wrap.querySelectorAll<HTMLElement>("[data-date]");

      const tl = gsap.timeline({
        onComplete: () => {
          canvas.style.display = "none";
        },
      });

      tl.to(hintRef.current, { autoAlpha: 0, duration: 0.2 }, 0)
        .to(
          canvas,
          {
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.7,
            ease: "power2.out",
          },
          0,
        )
        .fromTo(
          datesRef.current,
          { scale: reduceMotion ? 1 : 0.92 },
          {
            scale: 1,
            duration: reduceMotion ? 0 : 0.9,
            ease: "back.out(1.7)",
          },
          0.1,
        );

      // same reveal as the text: blur into focus one by one, then a gold glow
      if (!reduceMotion) {
        tl.fromTo(
          nums,
          { filter: "blur(6px)", y: 10 },
          {
            filter: "blur(0px)",
            y: 0,
            duration: 0.9,
            stagger: 0.15,
            ease: "power3.out",
            clearProps: "filter",
          },
          0.1,
        ).fromTo(
          nums,
          { textShadow: `0 0 0px rgba(${GLOW},0)` },
          {
            textShadow: `0 0 16px rgba(${GLOW},0.9)`,
            duration: 0.8,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
            stagger: 0.15,
          },
          0.5,
        );
      }

      if (navigator.vibrate) navigator.vibrate(15);
    };

    const onDown = (e: PointerEvent) => {
      if (done) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      last = pos(e);
      scratchLine(last, last);
      gsap.to(hintRef.current, { autoAlpha: 0, duration: 0.3 });
    };

    const onMove = (e: PointerEvent) => {
      if (!drawing || done || !last) return;
      const p = pos(e);
      scratchLine(last, p);
      last = p;

      const now = performance.now();
      if (now - lastCheck > 120) {
        lastCheck = now;
        if (clearedRatio() >= REVEAL_AT) reveal();
      }
    };

    const onUp = () => {
      drawing = false;
      last = null;
      if (!done && clearedRatio() >= REVEAL_AT) reveal();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // gentle nudge on the hint text until they start
    const nudge = gsap.to(hintRef.current, {
      y: -4,
      repeat: -1,
      yoyo: true,
      duration: 0.8,
      ease: "sine.inOut",
    });

    return () => {
      nudge.kill();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [mode, active]);

  // intro: title, separators, hint, foil / dates reveal one after another
  // (declared AFTER the scratch effect so the canvas is measured first)
  useEffect(() => {
    if (!active || mode === "pending") return;
    const root = rootRef.current!;

    const ctx = gsap.context(() => {
      const el = (n: string) =>
        root.querySelector<HTMLElement>(`[data-intro="${n}"]`);
      const title = el("title");
      const sep1 = el("sep1");
      const sep2 = el("sep2");
      const hint = el("hint");
      const foil = el("foil");
      const fallback = el("fallback");
      const dates = gsap.utils.toArray<HTMLElement>("[data-date]", root);
      const all = [title, sep1, sep2, hint, foil, fallback].filter(
        Boolean,
      ) as HTMLElement[];

      // reduced motion: just show everything
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set([...all, ...dates], { autoAlpha: 1 });
        return;
      }

      const from = { autoAlpha: 0, y: 18, filter: "blur(8px)" };
      const to = {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power3.out",
        clearProps: "filter",
      };

      // flower separators unfurl from the centre
      const unfurl = (target: HTMLElement | null, at: number) => {
        if (!target) return;
        tl.fromTo(
          target,
          { autoAlpha: 0, clipPath: "inset(0% 50% 0% 50%)" },
          {
            autoAlpha: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.3,
            ease: "power2.inOut",
            clearProps: "clipPath",
          },
          at,
        );
      };

      const tl = gsap.timeline({ delay: 0.2 });

      if (title) tl.fromTo(title, from, to, 0);
      unfurl(sep1, 0.6);

      if (foil) {
        // mobile: hint + foil fade in (no movement, so the scratch layer stays aligned)
        const soft = { autoAlpha: 0, filter: "blur(8px)" };
        const softTo = {
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 1,
          ease: "power3.out",
          clearProps: "filter",
        };
        tl.fromTo(foil, soft, softTo, 1.1);
        if (hint) tl.fromTo(hint, soft, softTo, 1.4);
      } else {
        // desktop: the date numbers reveal one by one, then glow
        tl.fromTo(dates, from, { ...to, stagger: 0.25 }, 1.4).fromTo(
          dates,
          { textShadow: `0 0 0px rgba(${GLOW},0)` },
          {
            textShadow: `0 0 16px rgba(${GLOW},0.9)`,
            duration: 0.9,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
            stagger: 0.2,
          },
          2.2,
        );
      }

      unfurl(sep2, 1.9);
      if (fallback) {
        tl.fromTo(
          fallback,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.8 },
          2.4,
        );
      }
    }, root);

    return () => ctx.revert();
  }, [mode, active]);

  // glitter: stars twinkle in, spin a little, fade out, then reappear somewhere else
  useEffect(() => {
    if (!active) return;
    if (mode === "pending") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = sparkleRef.current;
    if (!layer) return;

    const rand = gsap.utils.random;

    const ctx = gsap.context(() => {
      const stars = gsap.utils.toArray<HTMLElement>("[data-star]", layer);

      const place = (star: HTMLElement) => {
        const s = rand(5, 10);
        gsap.set(star, {
          left: `${rand(2, 96)}%`,
          top: `${rand(2, 96)}%`,
          width: s,
          height: s,
        });
      };

      stars.forEach((star) => {
        place(star);
        gsap
          .timeline({
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
          .to({}, { duration: rand(0.2, 2.2) }); // rest before the next twinkle
      });
    }, layer);

    return () => ctx.revert();
  }, [mode, active]);

  // scroll-down arrows: appear once the date is visible, then bob up and down
  // (on desktop the date is visible right away, so they show straight away)
  const dateVisible = revealed || mode === "desktop";

  useEffect(() => {
    if (!active || !dateVisible || !arrowsRef.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const chevrons = arrowsRef.current.querySelectorAll("svg");

    // wait for the date reveal to finish before drawing attention downward
    const wait = revealed ? 1.6 : 3;

    const fadeIn = gsap.to(arrowsRef.current, {
      autoAlpha: 1,
      duration: 0.6,
      delay: wait,
    });

    // two chevrons move down in a cascade, then loop
    const bob = reduceMotion
      ? null
      : gsap.fromTo(
          chevrons,
          { y: -4, opacity: 0.25 },
          {
            y: 6,
            opacity: 1,
            duration: 0.8,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            stagger: 0.18,
            delay: wait,
          },
        );

    return () => {
      fadeIn.kill();
      bob?.kill();
    };
  }, [dateVisible, revealed, active]);

  const showDate = () => {
    gsap.to(canvasRef.current, { autoAlpha: 0, duration: 0.4 });
    gsap.to(hintRef.current, { autoAlpha: 0, duration: 0.2 });
    setRevealed(true);
  };

  const isMobile = mode === "mobile";
  const isDesktop = mode === "desktop";

  return (
    <div
      ref={rootRef}
      className="bg-[url('/envelope/mainbg.png')] relative flex justify-center flex-col items-center bg-center bg-cover w-full h-dvh"
    >
      <div className="bg-[#F7EFE2] opacity-40 absolute w-full h-full "></div>

      <div
        data-intro="title"
        className="invisible z-2 mb-15 font-bold text-lg text-red-950"
      >
        <p>مرحبًا بكم في إعلان زفافنا </p>
      </div>

      <div
        data-intro="sep1"
        className="invisible bg-[url('/envelope/flowerSeperator.png')] w-3/4 h-20 -inset-s-10 scale-y-[-1] bg-center bg-contain bg-no-repeat"
      ></div>

      <div className="flex flex-col gap-5 items-center">
        {/* hint only on mobile, where scratching exists */}
        {isMobile && !revealed && (
          <div
            ref={hintRef}
            data-intro="hint"
            className="invisible z-2 font-bold text-sm text-red-950"
          >
            <p>امسح للكشف عن موعدنا</p>
          </div>
        )}

        {/* wrapper the foil covers; padding makes the foil slightly larger than the boxes */}
        <div
          ref={wrapRef}
          {...(isMobile ? { "data-intro": "foil" } : {})}
          className={`relative z-2 p-3 text-lg font-extrabold rounded-2xl ${
            isMobile ? "invisible" : ""
          }`}
        >
          <div
            ref={datesRef}
            className="flex gap-5"
            style={{ opacity: mode === "pending" ? 0 : 1 }}
          >
            {["2026", "15", "12"].map((d) => (
              <div
                key={d}
                data-date
                className={`flex justify-center items-center size-10 relative text-red-950 z-2 ${
                  isDesktop ? "invisible" : ""
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {isMobile && (
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="absolute inset-0 z-10 rounded-2xl select-none"
              style={{ touchAction: "none" }}
            />
          )}
        </div>

        {/* fallback for screen readers / anyone who can't scratch */}
        {isMobile && !revealed && (
          <button
            type="button"
            data-intro="fallback"
            onClick={showDate}
            className="invisible z-2 text-xs underline text-red-950/70"
          >
            إظهار الموعد
          </button>
        )}
      </div>

      <div
        data-intro="sep2"
        className="invisible bg-[url('/envelope/flowerSeperator.png')] w-3/4 h-20 -inset-s-10 z-2 bg-center bg-contain bg-no-repeat"
      ></div>

      {/* scroll-down arrows under the second border; space is reserved so nothing shifts when they appear */}
      <div
        ref={arrowsRef}
        aria-hidden="true"
        className="z-2 flex flex-col items-center -space-y-3 text-red-950 invisible opacity-0"
      >
        <p className="text-xs mb-1">مرر للأسفل</p>
        {[0, 1].map((i) => (
          <svg
            key={i}
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        ))}
      </div>

      {/* glitter layer: on top of everything, but never blocks touches */}
      <div
        ref={sparkleRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* shared gold gradient for the stars */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <radialGradient id="starGold">
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
                <path d={STAR_PATH} fill="url(#starGold)" />
              </svg>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default FirstSection;
