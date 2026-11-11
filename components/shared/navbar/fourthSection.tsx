"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---------------- leaves ---------------- */
const LEAF_COUNT = 14; // was 28 - fewer layers = smoother scroll
const SPAWN_Y = 40; // px from the section's top where leaves hide behind the top flower
const WIND = -1; // slight lean: -1 = drift to the left, 1 = to the right, 0 = straight down
const LEAVES_DELAY = 1.2; // seconds after the top flower appears before the leaves start

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99"; // same golds as the envelope seal
const GOLD_CORE = "255, 240, 190";
const GLOW = "212, 175, 55";
const GLINT_TIME = 3.0; // glint duration across one flower (scrubbed)

/* ---------------- scroll ----------------
   Every block (each flower, the title, the separator, each row) reveals by its
   OWN position on screen, scrubbed by the scroll.
   clamp() keeps the end point reachable even when the page can't scroll any
   further (needs GSAP 3.12+). Bigger gap between start and end = slower reveal. */
const REVEAL_START = "clamp(top 90%)";
const REVEAL_END = "clamp(top 30%)";

/* ---------------- row icons ----------------
   "blend" -> mix-blend-soft-light (PNG with a dark/black background).
   "gold"  -> CSS mask filled with gold (PNG transparent with dark artwork).

   IMPORTANT: the outer [data-icon] element is the one GSAP animates AND the
   one that carries the blend mode. No animated ancestor exists above it, so
   it blends with the section background from the very first frame.
   The flip lives on an inner element, so GSAP's transform never overwrites it. */
const ICON_STYLE = "blend" as "blend" | "gold";
const ICON_GOLD = "rgb(212, 175, 55)";

const RowIcon = ({
  src,
  className,
  flip = false,
}: {
  src: string;
  className: string;
  flip?: boolean;
}) => {
  const inner = flip ? "scale-x-[-1]" : "";

  if (ICON_STYLE === "gold") {
    return (
      <div data-icon className={`${className} invisible`}>
        <div className={`relative h-full w-full ${inner}`}>
          <Image
            src={src}
            alt=""
            fill
            sizes="80px"
            className="object-contain"
            style={{
              backgroundColor: ICON_GOLD,
              maskImage: `url('${src}')`,
              WebkitMaskImage: `url('${src}')`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-icon className={`${className} invisible mix-blend-soft-light`}>
      <div className={`relative h-full w-full ${inner}`}>
        <Image
          src={src}
          alt=""
          fill
          sizes="80px"
          className="object-cover object-center"
        />
      </div>
    </div>
  );
};

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
    <div data-base className="invisible absolute inset-0">
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={
          fit === "cover"
            ? "object-cover object-center"
            : "object-contain object-center"
        }
      />
    </div>
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
        mixBlendMode: "soft-light",
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
    const icons = q("[data-icon]") as HTMLElement[];
    const texts = q("[data-text]") as HTMLElement[];

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-base], [data-intro], [data-icon], [data-text]"), {
        autoAlpha: 1,
      });
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

        // Pure function of `st`, so it is correct in both scroll directions.
        const paint = () => {
          const edge = st.r;
          const done = edge >= maxR + feather - 0.5;

          // finished: drop the mask entirely (cheaper to render)
          if (done) clearMask(base);
          else
            setMask(
              base,
              `radial-gradient(circle at ${ox}px ${oy}px, #000 ${Math.max(edge - feather, 0)}px, transparent ${edge}px)`,
            );

          // the shine layer only exists while the glint is alive
          const alive = st.amp > 0.001;
          shine.style.visibility = alive ? "visible" : "hidden";
          if (!alive) return;

          shine.style.opacity = String(st.amp);
          const g = edge - feather * 0.25;
          shine.style.background = `radial-gradient(circle at ${ox}px ${oy}px,
            rgba(${GOLD},0) ${g - tail}px,
            rgba(${GOLD},0.45) ${g - tail * 0.3}px,
            rgba(${GOLD_CORE},1) ${g - lead * 0.3}px,
            rgba(${GOLD_CORE},0) ${g + lead}px)`;
        };

        return { el, base, shine, st, maxR, feather, paint };
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
          force3D: true,
        });
      });

      // everything starts hidden (the row wrappers themselves are never animated)
      const title = one("title");
      const sep = one("sep1");
      gsap.set([...icons, ...texts, title, sep].filter(Boolean), {
        autoAlpha: 0,
      });

      /* helper: a timeline scrubbed by ONE block's own position on screen */
      const scrubTl = (
        trigger: Element,
        start = REVEAL_START,
        end = REVEAL_END,
      ) =>
        gsap.timeline({
          scrollTrigger: {
            trigger,
            start,
            end,
            scrub: 1.25,
            invalidateOnRefresh: true,
          },
          defaults: { overwrite: false },
        });

      /* ============ 1. FLOWERS: each has its OWN scrubbed trigger ============ */
      rigs.forEach((rig, i) => {
        rig.paint(); // r = 0 -> nothing shows yet

        // top flower: reveals as it enters the screen.
        // bottom flower: starts as soon as its top edge appears, finishes when its
        // bottom edge is visible (always reachable at the end of the page).
        const tl =
          i === 0
            ? scrubTl(rig.el, "clamp(top 95%)", "clamp(top 25%)")
            : scrubTl(rig.el, "clamp(top bottom)", "clamp(bottom 65%)");

        tl.set(rig.base, { autoAlpha: 1 }, 0);

        tl.to(
          rig.st,
          {
            r: rig.maxR + rig.feather,
            duration: GLINT_TIME,
            ease: "power1.inOut",
            onUpdate: rig.paint,
          },
          0,
        );
        tl.to(
          rig.st,
          {
            amp: 1,
            duration: GLINT_TIME * 0.4,
            ease: "power2.out",
            onUpdate: rig.paint,
          },
          0,
        );
        tl.to(
          rig.st,
          {
            amp: 0,
            duration: GLINT_TIME * 0.55,
            ease: "power1.in",
            onUpdate: rig.paint,
          },
          GLINT_TIME * 0.4,
        );
      });

      /* ============ 2. TEXT: title, separator and rows, each by its own position ============ */
      // no blur filter (slow while scrolling), no clearProps (must run backwards)
      const from = { autoAlpha: 0, y: 14 };
      const to = { autoAlpha: 1, y: 0, duration: 1.2, ease: "power2.out" };

      if (title) scrubTl(title).fromTo(title, from, to);

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

      // each row: icon + text animate separately so no animated parent
      // ever isolates the blended icon; the gold glow passes over its time
      rows.forEach((row, i) => {
        const rowTl = scrubTl(row);
        rowTl.fromTo([icons[i], texts[i]], from, to, 0);

        const glow = row.querySelector<HTMLElement>("[data-glow]");
        if (glow) {
          rowTl.fromTo(
            glow,
            { textShadow: `0 0 0px rgba(${GLOW},0)` },
            {
              textShadow: `0 0 14px rgba(${GLOW},0.9)`,
              duration: 1.1,
              yoyo: true,
              repeat: 1,
              ease: "sine.inOut",
            },
            0.8,
          );
        }
      });

      /* ============ 3. LEAVES: normal time-based fall, plays ONCE ============ */
      // not scrubbed: starts when the top flower first shows, then falls on its own
      const leavesTl = gsap.timeline({ paused: true, delay: LEAVES_DELAY });

      leaves.forEach((leaf, i) => {
        const vy = H + 60 - SPAWN_Y; // always down, all the way past the bottom edge
        const dx = WIND * rand(0, 90) + rand(-25, 25); // gentle sideways drift
        const speed = rand(85, 150); // px per second
        const flyTime = vy / speed;
        const at = (i / n) * 7 + rand(0, 0.6); // released over ~6s
        const swayTime = rand(1.0, 1.6);

        leavesTl.to(
          leaf,
          { autoAlpha: 1, scale: rand(0.7, 1.3), duration: 0.5 },
          at,
        );

        // constant speed = leaves spread evenly from the top edge to the bottom edge
        leavesTl.to(
          leaf,
          {
            x: dx,
            y: vy,
            rotation: (dx < 0 ? -1 : 1) * rand(300, 700),
            rotationY: rand(540, 1440),
            duration: flyTime,
            ease: "none",
            force3D: true,
          },
          at,
        );

        // side-to-side sway like a real falling leaf
        leavesTl.to(
          leaf,
          {
            xPercent: rand(-150, 150),
            yPercent: rand(-40, 40),
            duration: swayTime,
            yoyo: true,
            repeat: Math.round(flyTime / swayTime),
            ease: "sine.inOut",
          },
          at,
        );

        leavesTl.to(leaf, { autoAlpha: 0, duration: 0.4 }, at + flyTime - 0.4);
      });

      // fire once, the first time the top flower comes into view
      ScrollTrigger.create({
        trigger: flowers[0],
        start: "top 85%",
        once: true,
        onEnter: () => leavesTl.play(),
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
      className="-mt-30 z-2 relative overflow-x-clip flex flex-col justify-center items-center w-full h-screen"
    >
      <Image
        src="/envelope/secondbg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none absolute inset-0 z-0 object-fill object-center"
      />
      {/* leaves hide here, behind the flowers and the text */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        {Array.from({ length: LEAF_COUNT }, (_, i) => (
          <div
            key={i}
            data-leaf
            className="invisible absolute w-1/5 h-8 will-change-transform"
            style={{ top: SPAWN_Y }}
          >
            <Image
              src="/envelope/leaf1.png"
              alt=""
              fill
              sizes="15vw"
              loading="eager"
              decoding="async"
              className="object-contain object-center"
            />
          </div>
        ))}
      </div>

      {/* top flower */}
      <ShineFlower
        src="/envelope/fflower.png"
        origin={{ x: 50, y: 50 }}
        fit="cover"
        className="absolute w-full h-50 -top-6"
      />

      <div className="flex flex-col justify-center w-full items-center relative -top-5 gap-4">
        <div
          data-intro="title"
          className="invisible z-2 mb-1 font-extrabold text-xl text-red-950"
        >
          <p>جدول اليوم</p>
        </div>
        <div
          data-intro="sep1"
          className="invisible relative w-full h-8  scale-y-[-1]"
        >
          <Image
            src="/envelope/goldenSeperator.png"
            alt=""
            fill
            sizes="100vw"
            className="object-contain object-center"
          />
        </div>

        <div className="flex flex-col w-[80%] gap-6">
          <div data-row className="flex justify-between items-center">
            <RowIcon
              src="/envelope/ringWedding.png"
              className="w-20 h-16 shrink-0"
            />
            <div
              data-text
              className="invisible flex justify-center flex-col gap-0.5 items-center text-red-950"
            >
              <p className="text-lg font-bold w-30 text-center">الاستقبال</p>
              <p
                data-glow
                className="text-lg font-bold w-30 text-center tabular-nums"
                dir="ltr"
              >
                11:00 PM
              </p>
            </div>
          </div>

          <div data-row className="flex justify-between items-center">
            <RowIcon src="/envelope/bride.png" className="w-25 h-25 shrink-0" />
            <div
              data-text
              className="invisible flex flex-col justify-center gap-0.5 items-center text-red-950"
            >
              <p className="text-lg font-bold w-30 text-center">زفة العروس</p>
              <p
                data-glow
                className="text-lg font-bold w-30 text-center tabular-nums"
                dir="ltr"
              >
                11:00 PM
              </p>
            </div>
          </div>

          <div data-row className="flex justify-between items-center">
            <RowIcon
              src="/envelope/brideMan.png"
              className="w-30 h-28 shrink-0"
              flip
            />
            <div
              data-text
              className="invisible flex flex-col justify-center gap-0.5 items-center text-red-950"
            >
              <p className="text-lg font-bold w-30 text-center">المغادرة</p>
              <p
                data-glow
                className="text-lg font-bold w-30 text-center tabular-nums"
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
        className="absolute w-3/4 h-50 inset-e-0 bottom-0"
      />
    </div>
  );
};

export default FourthSection;
