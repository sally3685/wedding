"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import Image from "next/image";

/* ---------------- leaves ---------------- */
const LEAF_COUNT = 14; // was 28 - fewer layers = smoother scroll
const SPAWN_Y = 50; // px above the top edge where leaves wait (hidden by the clip)
const WIND = -1; // slight lean: -1 = left, 1 = right, 0 = straight down
const SIDES_TIME = 4.2; // how long li / ri take to slide in (seconds)
const LEAVES_DELAY = 1.2; // seconds after the flower first shows before the leaves start

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99";
const GOLD_CORE = "255, 240, 190";
const GLOW = "212, 175, 55";
const GLINT_TIME = 3.0; // glint duration across the flower (scrubbed)

/* ---------------- scroll ----------------
   Every block (flower, each text, the two bottom images) reveals by its OWN
   position on screen, scrubbed by the scroll.
   Text: block top at 98% of the screen (just entering) -> block top at 50%.
   Bigger gap = slower, clearer reveal.
   clamp() keeps the end point reachable even when the page can't scroll any
   further (needs GSAP 3.12+). */
const REVEAL_START = "clamp(top 90%)";
const REVEAL_END = "clamp(top 30%)";

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
        sizes="26vw"
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
    const extras = q("[data-extra]") as HTMLElement[];

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation, no leaves
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-base], [data-intro], [data-side], [data-extra]"), {
        autoAlpha: 1,
      });
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

      /* ---------- start states ---------- */
      // leaves: one slot each across the width, hidden above the top edge
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
          force3D: true,
        });
      });

      // li / ri wait completely off-screen on their own side
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
            scrub: 1.25, // smooths the scroll -> animation link
            invalidateOnRefresh: true,
          },
          defaults: { overwrite: false },
        });

      /* ============ 1. FLOWER: its OWN scrubbed trigger ============ */
      rigs.forEach((rig) => {
        rig.paint(); // r = 0 -> nothing shows yet

        const tl = scrubTl(rig.el, "clamp(top 95%)", "clamp(center 30%)");

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

        // the small decoration blooms in after the glint
        if (extras.length) {
          tl.fromTo(
            extras,
            { autoAlpha: 0, scale: 0.94 },
            { autoAlpha: 1, scale: 1, duration: 1.3, ease: "power2.out" },
            GLINT_TIME * 0.6,
          );
        }
      });

      /* ============ 2. TEXT: each block by its own position ============ */
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

      if (paragraph) scrubTl(paragraph).fromTo(paragraph, from, to);

      if (date) {
        const dateTl = scrubTl(date);
        dateTl.fromTo(date, from, to, 0);
        // gold glow passes over the date
        dateTl.fromTo(
          date,
          { textShadow: `0 0 0px rgba(${GLOW},0)` },
          {
            textShadow: `0 0 14px rgba(${GLOW},0.9)`,
            duration: 1.1,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
          },
          0.7,
        );
      }

      // the button settles in with a tiny pop
      if (link) {
        scrubTl(link).fromTo(
          link,
          { autoAlpha: 0, y: 14, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            ease: "power2.out",
          },
        );
      }

      /* ============ 3. LI / RI: normal time-based slide, plays ONCE at the bottom of the page ============ */
      // not scrubbed: starts when the user reaches the bottom of the page,
      // then slides in on its own
      const sidesTl = gsap.timeline({ paused: true });
      sides.forEach((el, i) => {
        const at = i * 0.25; // small gap between the two
        sidesTl.set(el, { visibility: "visible" }, at); // still off-screen, so nothing pops
        sidesTl.fromTo(
          el,
          { x: offscreen[i] },
          { x: 0, duration: SIDES_TIME, ease: "power2.out" },
          at,
        );
      });

      ScrollTrigger.create({
        trigger: root,
        start: "bottom bottom+=40", // the bottom of the section reaches the bottom of the screen
        once: true,
        onEnter: () => sidesTl.play(),
      });

      /* ============ 4. LEAVES: normal time-based fall, plays ONCE ============ */
      // not scrubbed: starts when the flower first shows, then falls on its own
      const leavesTl = gsap.timeline({ paused: true, delay: LEAVES_DELAY });

      leaves.forEach((leaf, i) => {
        const vy = H + SPAWN_Y + 60; // from above the top edge to past the bottom edge
        const dx = WIND * rand(0, 90) + rand(-25, 25); // gentle sideways drift
        const speed = rand(85, 150); // px per second
        const flyTime = vy / speed;
        const at = (i / n) * 7 + rand(0, 0.6); // released over ~5s
        const swayTime = rand(1.0, 1.6);

        // appears instantly, but it's still above the top edge (clipped), so no pop
        leavesTl.set(leaf, { autoAlpha: 1 }, at);

        // constant speed = leaves spread evenly from top to bottom
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

        // gone once it has left through the bottom edge
        leavesTl.set(leaf, { autoAlpha: 0 }, at + flyTime);
      });

      // fire once, the first time the flower comes into view
      ScrollTrigger.create({
        trigger: flowers[0],
        start: "top 80%",
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
      className="-mt-37 z-2 relative overflow-x-clip flex flex-col justify-center items-center w-full min-h-dvh pt-[16vw] pb-[48vw]"
    >
      <Image
        src="/envelope/bg3.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 z-0 object-fill object-center"
      />
      {/* leaves layer: clipped to this section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {Array.from({ length: LEAF_COUNT }, (_, i) => (
          <div
            key={i}
            data-leaf
            className="invisible absolute w-1/5 h-8 will-change-transform"
            style={{ top: -SPAWN_Y }}
          >
            <Image
              src="/envelope/leaf1.png"
              alt=""
              fill
              sizes="20vw"
              loading="eager"
              decoding="async"
              className="object-contain object-center"
            />
          </div>
        ))}
      </div>

      <div
        data-extra
        className="invisible absolute w-1/4 h-20 -inset-e-8 top-5"
      >
        <Image
          src="/envelope/Asset_2_1.png"
          alt=""
          fill
          sizes="25vw"
          className="object-contain object-center"
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none mix-blend-soft-light absolute z-0 w-1/2 h-[80%] left-0 -top-5"
      >
        <Image
          src="/envelope/mms.png"
          alt=""
          fill
          sizes="50vw"
          className="object-contain object-center"
        />
      </div>

      {/* side flower: width follows the screen, spans the full height of the section */}
      <ShineFlower
        src="/envelope/sideFlower.png"
        origin={{ x: 50, y: 50 }}
        fit="cover"
        className="absolute w-[26vw] right-0 h-[85%] top-0"
      />

      {/* content: in the normal flow, so the section grows with the text.
        right padding keeps the text clear of the side flower */}
      <div className="flex flex-col justify-center w-full items-center relative gap-[4vw] pl-[5vw] pr-[18vw]">
        <div
          data-intro="title"
          className="invisible z-2 text-center font-bold text-[clamp(16px,4.8vw,22px)] text-red-950"
        >
          <p className="mb-[5vw]">وجودكم يسعدنا</p>
          <p className="font-sans text-[clamp(12px,3.5vw,16px)] leading-[1.9]">
            لأن حضوركم يعني لنا الكثير، نتمنى أن تشاركونا هذه المناسبة المميزة،
            وأن تكونوا جزءًا من أجمل ذكرياتنا. نرجو منكم تأكيد حضوركم قبل موعد
            الحفل، حتى نتمكن من استقبالكم بكل محبة وترتيب هذه الليلة بما يليق
            بكم.
          </p>
        </div>

        <div
          data-intro="sep1"
          className="invisible relative w-full h-[18vw] max-h-24 scale-y-[-1]"
        >
          <Image
            src="/envelope/flowerSeperator.png"
            alt=""
            fill
            sizes="100vw"
            className="object-contain object-center"
          />
        </div>

        <div className="flex flex-col gap-3 items-center font-bold text-red-950 justify-center text-center text-[clamp(13px,4vw,18px)]">
          <p data-intro="paragraph" className="invisible">
            نأمل تأكيد حضوركم قبل تاريخ
          </p>

          <div
            data-intro="date"
            className="invisible z-2 mb-[4vw] font-bold text-[clamp(15px,4.6vw,20px)] text-red-950"
          >
            <p>يوم الأحد :12/12/2026</p>
          </div>
        </div>

        <Link
          href={"/"}
          data-intro="link"
          className="invisible px-8 py-2.5 rounded-xl font-bold text-red-950 text-[clamp(13px,3.8vw,16px)]
        bg-gradient-to-b from-[#fdf6e3] to-[#f0e2c2]
        border-2 border-[#c8a25a]/60
        transition-[filter] duration-200 hover:brightness-105 active:brightness-95 font-sans"
        >
          أرسل عبر واتساب
        </Link>
      </div>

      {/* bottom corner images: sized from screen width */}
      <div
        data-sides-wrap
        className="flex absolute bottom-0 inset-x-0 h-[62vw] max-h-[260px] justify-center items-center pointer-events-none"
      >
        <div
          data-side="r"
          className="w-[62vw] h-[62vw] max-w-[260px] max-h-[260px] absolute bottom-0 invisible"
        >
          <Image
            src="/envelope/ri.png"
            alt=""
            fill
            sizes="62vw"
            className="object-contain object-center"
          />
        </div>
        <div
          data-side="l"
          className="w-[62vw] h-[62vw] max-w-[260px] max-h-[260px] absolute bottom-0 invisible"
        >
          <Image
            src="/envelope/li.png"
            alt=""
            fill
            sizes="62vw"
            className="object-contain object-center"
          />
        </div>
      </div>
    </div>
  );
};

export default FinalSection;
