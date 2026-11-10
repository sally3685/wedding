"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";

/* ---------------- leaves ---------------- */
const LEAF_COUNT = 28;
const SPAWN_Y = 50; // px above the top edge where leaves wait (hidden by the clip)
const WIND = -1; // slight lean: -1 = left, 1 = right, 0 = straight down

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99";
const GOLD_CORE = "255, 240, 190";
const GLOW = "212, 175, 55";
const GLINT_TIME = 2.2; // seconds the glint takes to cross the flower

const SIDES_AT = 0.4; // li / ri start sliding in (seconds)
const SIDES_TIME = 3.2; // how long the slide takes
const TEXT_AT = 0.9; // text starts while the glint is still crossing the flower
const TEXT_STEP = 0.32; // gap between text items (they overlap, like the other sections)

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

const FinalSection = () => {
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
    const sides = q("[data-side]") as HTMLElement[];

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation, no leaves
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-base], [data-intro], [data-side]"), { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* ---------- measure everything BEFORE any transform ---------- */
      const rootRect = root.getBoundingClientRect();
      const H = rootRect.height;

      // how far li / ri must travel to start completely off-screen
      const offscreen = sides.map((el) => {
        const r = el.getBoundingClientRect();
        return el.dataset.side === "r"
          ? rootRect.right - r.left + 20 // push right until it's past the right edge
          : -(r.right - rootRect.left) - 20; // push left until it's past the left edge
      });

      /* ---------- flower shine rigs ---------- */
      const rigs = flowers.map((el) => {
        const base = el.querySelector<HTMLElement>("[data-base]")!;
        const shine = el.querySelector<HTMLElement>("[data-shine]")!;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const ox = (Number(el.dataset.ox) / 100) * w;
        const oy = (Number(el.dataset.oy) / 100) * h;
        const maxR = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
        const feather = maxR * 0.12;
        const tail = maxR * 0.4;
        const lead = maxR * 0.05;
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

      /* ---------- start states ---------- */
      // leaves: one slot each across the width, already at their final size, hidden above the top edge
      const n = leaves.length;
      const slots = gsap.utils.shuffle(
        leaves.map((_, i) => (i + rand(0.1, 0.9)) / n),
      );
      leaves.forEach((leaf, i) => {
        gsap.set(leaf, {
          left: `${slots[i] * 88}%`,
          autoAlpha: 0,
          scale: rand(0.7, 1.3),
          rotation: rand(-40, 40),
          transformPerspective: 500,
        });
      });

      // li / ri wait completely off-screen on their own side (no fade, they just slide)
      sides.forEach((el, i) => gsap.set(el, { x: offscreen[i] }));

      // text starts hidden
      const title = one("title");
      const sep = one("sep1");
      const paragraph = one("paragraph");
      const date = one("date");
      const link = one("link");
      gsap.set([title, sep, paragraph, date, link].filter(Boolean), {
        autoAlpha: 0,
      });

      const master = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 60%", once: true },
      });

      /* ============ 1. FLOWER: gold glint + reveal ============ */
      rigs.forEach((rig) => {
        rig.paint(); // r = 0 -> nothing shows yet

        master.set(rig.base, { autoAlpha: 1 }, 0);
        master.set(rig.shine, { visibility: "visible" }, 0);

        master.to(
          rig.st,
          {
            r: rig.maxR + rig.feather,
            duration: GLINT_TIME,
            ease: "power1.inOut",
            onUpdate: rig.paint,
          },
          0,
        );
        master.to(
          rig.st,
          {
            amp: 1,
            duration: GLINT_TIME * 0.4,
            ease: "power2.out",
            onUpdate: rig.paint,
          },
          0,
        );
        master.to(
          rig.st,
          {
            amp: 0,
            duration: GLINT_TIME * 0.55,
            ease: "power1.in",
            onUpdate: rig.paint,
          },
          GLINT_TIME * 0.4,
        );
        master.call(
          () => {
            clearMask(rig.base);
            rig.shine.style.visibility = "hidden";
          },
          [],
          GLINT_TIME + 0.05,
        );
      });
      const extras = q("[data-extra]");
      master.fromTo(
        extras,
        { autoAlpha: 0, scale: 0.8 },
        { autoAlpha: 1, scale: 1, duration: 1, ease: "back.out(1.4)" },
        GLINT_TIME * 0.6,
      );
      /* ============ 2. LI / RI: slide in from their sides, no fade ============ */
      sides.forEach((el, i) => {
        const at = SIDES_AT + i * 0.25; // a bit more gap between ri and li
        master.set(el, { visibility: "visible" }, at); // still off-screen, so nothing pops
        master.to(el, { x: 0, duration: SIDES_TIME, ease: "power2.out" }, at);
      });

      /* ============ 3. TEXT: overlapping blur-fade, like the other sections ============ */
      const from = { autoAlpha: 0, y: 18, filter: "blur(8px)" };
      const to = {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power3.out",
        clearProps: "filter",
      };

      master.addLabel("text", TEXT_AT);

      if (title) master.fromTo(title, from, to, "text");

      // separator unfurls from the centre, overlapping the title
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
          `text+=${TEXT_STEP}`,
        );
      }

      if (paragraph) {
        master.fromTo(paragraph, from, to, `text+=${TEXT_STEP * 2}`);
      }

      if (date) {
        master.fromTo(date, from, to, `text+=${TEXT_STEP * 3}`);
        // gold glow passes over the date
        master.fromTo(
          date,
          { textShadow: `0 0 0px rgba(${GLOW},0)` },
          {
            textShadow: `0 0 14px rgba(${GLOW},0.9)`,
            duration: 0.8,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
          },
          `text+=${TEXT_STEP * 3 + 0.7}`,
        );
      }

      // the button settles in with a tiny pop
      if (link) {
        master.fromTo(
          link,
          { autoAlpha: 0, y: 18, scale: 0.92, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1,
            ease: "back.out(1.4)",
            clearProps: "filter",
          },
          `text+=${TEXT_STEP * 4}`,
        );
      }

      /* ============ 4. LEAVES: drop in from the top edge, fall to the bottom edge ============ */
      master.addLabel("leaves", TEXT_AT + TEXT_STEP * 4 + 0.2);

      leaves.forEach((leaf, i) => {
        const vy = H + SPAWN_Y + 60; // from above the top edge to past the bottom edge
        const dx = WIND * rand(0, 90) + rand(-25, 25); // gentle sideways drift
        const speed = rand(120, 210); // px per second
        const flyTime = vy / speed;
        const at = (i / n) * 5 + rand(0, 0.5); // released over ~5s
        const swayTime = rand(0.8, 1.4);

        // appears instantly, but it's still above the top edge (clipped), so no pop
        master.set(leaf, { autoAlpha: 1 }, `leaves+=${at}`);

        // constant speed = leaves spread evenly from top to bottom
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

        // gone once it has left through the bottom edge
        master.set(leaf, { autoAlpha: 0 }, `leaves+=${at + flyTime}`);
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="bg-[url('/envelope/bg3.png')] -mt-37 z-2 relative overflow-x-clip bg-cover bg-no-repeat bg-center flex flex-col justify-center items-center w-full h-screen"
      style={{ backgroundSize: "100% 100%" }}
    >
      {/* leaves layer: clipped to this section, so leaves enter through the top edge
          and leave through the bottom edge, never over the neighbouring sections */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {Array.from({ length: LEAF_COUNT }, (_, i) => (
          <div
            key={i}
            data-leaf
            className="bg-[url('/envelope/leaf1.png')] invisible absolute w-1/5 h-8 bg-center bg-contain bg-no-repeat"
            style={{ top: -SPAWN_Y }}
          />
        ))}
      </div>
      {/* first: animated */}
      <div
        data-extra
        className="invisible bg-[url('/envelope/Asset_2_1.png')] absolute w-1/4 h-20 -inset-e-8 top-5 bg-center bg-contain bg-no-repeat"
      ></div>

      {/* second: static, multiply blend (no animation) */}
      <div
        aria-hidden="true"
        className="pointer-events-none mix-blend-soft-light bg-[url('/envelope/mms.png')] absolute z-0 w-1/2 h-[80%] left-0 -top-5 bg-center bg-contain bg-no-repeat"
      ></div>
      {/* side flower */}
      <ShineFlower
        src="/envelope/sideFlower.png"
        origin={{ x: 50, y: 50 }}
        fit="cover"
        className="absolute w-25 right-0 h-[80%] -top-6"
      />

      <div className="flex flex-col justify-center w-full items-center relative -inset-e-4 -top-15 gap-4">
        <div
          data-intro="title"
          className="invisible z-2 mb-1 font-bold text-lg text-red-950"
        >
          <p>من فضلك أكّد حضورك</p>
        </div>

        <div
          data-intro="sep1"
          className="invisible bg-[url('/envelope/flowerSeperator.png')] w-full h-20 -inset-s-10 scale-y-[-1] bg-center bg-contain bg-no-repeat mb-8"
        />

        <div className="flex flex-col gap-3 items-center text-red-950 justify-center">
          <p data-intro="paragraph" className="invisible">
            نأمل تأكيد حضوركم قبل تاريخ
          </p>

          <div
            data-intro="date"
            className="invisible z-2 mb-8 font-bold text-lg text-red-950"
          >
            <p>يوم الأحد :12/12/2026</p>
          </div>
        </div>
        <Link
          href={"/"}
          data-intro="link"
          className="invisible px-8 py-2.5 rounded-xl font-bold text-red-950
  
          bg-gradient-to-b from-[#fdf6e3] to-[#f0e2c2]
          border-2 border-[#c8a25a]/60
          shadow-[0_6px_18px_rgba(120,90,30,0.25),inset_0_1px_0_rgba(255,255,255,0.8)]
    transition-[filter] duration-200 hover:brightness-105 active:brightness-95"
        >
          أرسل عبر واتساب
        </Link>
      </div>

      {/* bottom corner images: li = left corner, ri = right corner */}
      <div className="flex absolute bottom-0 justify-center items-center">
        <div
          data-side="r"
          className="bg-[url('/envelope/ri.png')] w-60 h-60 bg-center absolute bottom-0 bg-contain bg-no-repeat invisible"
        />
        <div
          data-side="l"
          className="bg-[url('/envelope/li.png')] w-60 h-60 bg-center absolute bottom-0 bg-contain bg-no-repeat invisible"
        />
      </div>
    </div>
  );
};

export default FinalSection;
