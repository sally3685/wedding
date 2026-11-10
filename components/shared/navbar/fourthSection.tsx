"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---------------- leaves ---------------- */
const LEAF_COUNT = 28;
const SPAWN_Y = 40; // px from the section's top where leaves hide behind the top flower
const WIND = -1; // slight lean: -1 = drift to the left, 1 = to the right, 0 = straight down

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99"; // same golds as the envelope seal
const GOLD_CORE = "255, 240, 190";
const GLOW = "212, 175, 55";
const GLINT_TIME = 2.2; // seconds the glint takes to cross one flower
const FLOWER_GAP = 0.6; // delay between top and bottom flower
const ROW_STAGGER = 0.35; // delay between schedule rows

/* ------------------------------------------------------------------ */
/* A flower image with a shine layer on top                            */
/* base  = the flower, revealed by a growing feathered circle          */
/* shine = gold ring, masked by the SAME image so it only lights petals */
/* fit   = "contain" or "cover", same as the background size you'd use  */
/* ------------------------------------------------------------------ */
const ShineFlower = ({
  src,
  className,
  origin,
  fit = "contain",
  children,
}: {
  src: string;
  className: string;
  origin: { x: number; y: number };
  fit?: "contain" | "cover";
  children?: ReactNode;
}) => (
  <div className={className} data-flower data-ox={origin.x} data-oy={origin.y}>
    <div
      data-base
      className="invisible absolute inset-0"
      style={{
        backgroundImage: `url('${src}')`,
        backgroundSize: fit,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
    <div
      data-shine
      className="invisible pointer-events-none absolute inset-0"
      style={{
        WebkitMaskImage: `url('${src}')`,
        maskImage: `url('${src}')`,
        WebkitMaskSize: fit,
        maskSize: fit,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        mixBlendMode: "screen",
      }}
    />
    {children}
  </div>
);

const setMask = (el: HTMLElement, value: string) => {
  el.style.setProperty("mask-image", value);
  el.style.setProperty("-webkit-mask-image", value);
};
const clearMask = (el: HTMLElement) => {
  el.style.removeProperty("mask-image");
  el.style.removeProperty("-webkit-mask-image");
};

const FourthSection = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const root = rootRef.current!;
    const q = gsap.utils.selector(root);
    const rand = gsap.utils.random;
    const one = (n: string) =>
      root.querySelector<HTMLElement>(`[data-intro="${n}"]`);

    const leaves = q("[data-leaf]") as HTMLElement[];
    const flowers = q("[data-flower]") as HTMLElement[];
    const rows = q("[data-row]") as HTMLElement[];
    const glows = q("[data-glow]") as HTMLElement[];

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-base], [data-intro], [data-row]"), { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* ---------- measure before any transform ---------- */
      const H = root.getBoundingClientRect().height;

      /* ---------- flower shine rigs ---------- */
      const rigs = flowers.map((el) => {
        const base = el.querySelector<HTMLElement>("[data-base]")!;
        const shine = el.querySelector<HTMLElement>("[data-shine]")!;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const ox = (Number(el.dataset.ox) / 100) * w;
        const oy = (Number(el.dataset.oy) / 100) * h;
        const maxR = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
        const feather = maxR * 0.12; // soft edge of the reveal circle
        const tail = maxR * 0.4; // long soft tail behind the glint
        const lead = maxR * 0.05; // sharp leading edge
        const st = { r: 0, amp: 0 };

        const paint = () => {
          const edge = st.r;
          setMask(
            base,
            `radial-gradient(circle at ${ox}px ${oy}px, #000 ${Math.max(edge - feather, 0)}px, transparent ${edge}px)`,
          );
          const g = edge - feather * 0.25;
          shine.style.opacity = String(st.amp);
          shine.style.background = `radial-gradient(circle at ${ox}px ${oy}px,
            rgba(${GOLD},0) ${g - tail}px,
            rgba(${GOLD},0.45) ${g - tail * 0.3}px,
            rgba(${GOLD_CORE},1) ${g - lead * 0.3}px,
            rgba(${GOLD_CORE},0) ${g + lead}px)`;
        };

        return { base, shine, st, maxR, feather, paint };
      });

      /* ---------- leaf start state: one slot per leaf across the whole width ---------- */
      const n = leaves.length;
      const slots = gsap.utils.shuffle(
        leaves.map((_, i) => (i + rand(0.1, 0.9)) / n),
      );
      leaves.forEach((leaf, i) => {
        gsap.set(leaf, {
          left: `${slots[i] * 88}%`, // stays inside the screen
          autoAlpha: 0,
          scale: 0.3,
          rotation: rand(-40, 40),
          transformPerspective: 500,
        });
      });

      // texts start hidden
      gsap.set([...rows, one("title"), one("sep1")].filter(Boolean), {
        autoAlpha: 0,
      });

      const master = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 60%", once: true },
      });

      /* ============ 1. FLOWERS: gold glint + reveal (top, then bottom) ============ */
      rigs.forEach((rig, i) => {
        const t0 = i * FLOWER_GAP;
        rig.paint(); // r = 0 -> nothing shows yet

        master.set(rig.base, { autoAlpha: 1 }, t0);
        master.set(rig.shine, { visibility: "visible" }, t0);

        master.to(
          rig.st,
          {
            r: rig.maxR + rig.feather,
            duration: GLINT_TIME,
            ease: "power1.inOut",
            onUpdate: rig.paint,
          },
          t0,
        );
        master.to(
          rig.st,
          {
            amp: 1,
            duration: GLINT_TIME * 0.4,
            ease: "power2.out",
            onUpdate: rig.paint,
          },
          t0,
        );
        master.to(
          rig.st,
          {
            amp: 0,
            duration: GLINT_TIME * 0.55,
            ease: "power1.in",
            onUpdate: rig.paint,
          },
          t0 + GLINT_TIME * 0.4,
        );
        master.call(
          () => {
            clearMask(rig.base);
            rig.shine.style.visibility = "hidden";
          },
          [],
          t0 + GLINT_TIME + 0.05,
        );
      });

      /* ============ 2. TEXT: soft blur-fade, then the schedule rows ============ */
      const from = { autoAlpha: 0, y: 18, filter: "blur(8px)" };
      const to = {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power3.out",
        clearProps: "filter",
      };

      master.addLabel("text", "-=0.5");

      const title = one("title");
      if (title) master.fromTo(title, from, to, "text");

      // separator unfurls from the centre
      const sep = one("sep1");
      if (sep) {
        master.fromTo(
          sep,
          { autoAlpha: 0, clipPath: "inset(0% 50% 0% 50%)" },
          {
            autoAlpha: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.3,
            ease: "power2.inOut",
            clearProps: "clipPath",
          },
          "text+=0.5",
        );
      }

      // the three rows, one after another
      master.fromTo(rows, from, { ...to, stagger: ROW_STAGGER }, "text+=1");

      // a gold glow passes over the times
      const rowsEnd = 1 + (rows.length - 1) * ROW_STAGGER;
      master.fromTo(
        glows,
        { textShadow: `0 0 0px rgba(${GLOW},0)` },
        {
          textShadow: `0 0 14px rgba(${GLOW},0.9)`,
          duration: 0.8,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
          stagger: ROW_STAGGER,
        },
        `text+=${1.3}`,
      );

      /* ============ 3. LEAVES: fall from behind the top flower, covering a rectangle ============ */
      master.addLabel("leaves", `text+=${rowsEnd + 0.4}`);

      leaves.forEach((leaf, i) => {
        const vy = H + 60 - SPAWN_Y; // always down, all the way past the bottom edge
        const dx = WIND * rand(0, 90) + rand(-25, 25); // gentle sideways drift
        const speed = rand(110, 200); // px per second
        const flyTime = vy / speed;
        const at = (i / n) * 6 + rand(0, 0.5); // released over ~6s
        const swayTime = rand(0.8, 1.4);

        master.to(
          leaf,
          { autoAlpha: 1, scale: rand(0.7, 1.3), duration: 0.35 },
          `leaves+=${at}`,
        );

        // constant speed = leaves spread evenly from the top edge to the bottom edge
        master.to(
          leaf,
          {
            x: dx,
            y: vy,
            rotation: (dx < 0 ? -1 : 1) * rand(300, 700),
            rotationY: rand(540, 1440),
            duration: flyTime,
            ease: "none",
          },
          `leaves+=${at}`,
        );

        // side-to-side sway like a real falling leaf
        master.to(
          leaf,
          {
            xPercent: rand(-150, 150),
            yPercent: rand(-40, 40),
            duration: swayTime,
            yoyo: true,
            repeat: Math.round(flyTime / swayTime),
            ease: "sine.inOut",
          },
          `leaves+=${at}`,
        );

        master.to(
          leaf,
          { autoAlpha: 0, duration: 0.4 },
          `leaves+=${at + flyTime - 0.4}`,
        );
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="bg-[url('/envelope/secondbg.png')] -top-35 z-2 relative overflow-x-clip bg-cover bg-no-repeat bg-center flex flex-col justify-center items-center w-full h-screen"
      style={{ backgroundSize: "100% 100%" }}
    >
      {/* leaves hide here, behind the flowers and the text */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        {Array.from({ length: LEAF_COUNT }, (_, i) => (
          <div
            key={i}
            data-leaf
            className="bg-[url('/envelope/leaf1.png')] invisible absolute w-1/5 h-8 bg-center bg-contain bg-no-repeat"
            style={{ top: SPAWN_Y }}
          ></div>
        ))}
      </div>

      {/* top flower */}
      <ShineFlower
        src="/envelope/fflower.png"
        origin={{ x: 50, y: 50 }}
        fit="cover"
        className="absolute w-full h-35 -top-6"
      />

      <div className="flex flex-col justify-center w-full items-center relative -top-5 gap-4">
        <div
          data-intro="title"
          className="invisible z-2 mb-1 font-bold text-lg text-red-950"
        >
          <p>جدول اليوم</p>
        </div>
        <div
          data-intro="sep1"
          className="invisible bg-[url('/envelope/goldenSeperator.png')] w-full h-8 -inset-s-10 scale-y-[-1] bg-center bg-contain bg-no-repeat"
        ></div>

        <div className="flex flex-col w-[85%] gap-6">
          <div data-row className="invisible flex justify-between items-center">
            <div className="bg-[url('/envelope/rings.svg')] w-18 h-14.5 shrink-0 bg-cover bg-center"></div>
            <div className="flex flex-col gap-0.5 items-end">
              <p className="text-sm leading-tight">الاستقبال</p>
              <p
                data-glow
                className="text-xs leading-tight tabular-nums"
                dir="ltr"
              >
                11:00 PM
              </p>
            </div>
          </div>
          <div data-row className="invisible flex justify-between items-center">
            <div className="bg-[url('/envelope/bride.svg')] w-25 h-25 shrink-0 bg-cover bg-center"></div>
            <div className="flex flex-col gap-0.5 items-end">
              <p className="text-sm leading-tight">زفة العروس</p>
              <p
                data-glow
                className="text-xs leading-tight tabular-nums"
                dir="ltr"
              >
                11:00 PM
              </p>
            </div>
          </div>
          <div data-row className="invisible flex justify-between items-center">
            <div className="bg-[url('/envelope/brideMan.svg')] w-20 h-25 shrink-0 bg-cover bg-center"></div>
            <div className="flex flex-col gap-0.5 items-end">
              <p className="text-sm leading-tight">المغادرة</p>
              <p
                data-glow
                className="text-xs leading-tight tabular-nums"
                dir="ltr"
              >
                11:00 PM
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* bottom flower */}
      <ShineFlower
        src="/envelope/rings.png"
        origin={{ x: 50, y: 50 }}
        fit="cover"
        className="absolute w-3/4 h-43 inset-e-0 bottom-0"
      />
    </div>
  );
};

export default FourthSection;
