"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---------------- leaves ---------------- */
const LEAF_COUNT = 14; // was 24 - fewer layers = smoother scroll
const ORIGIN = { x: 40, y: 35 }; // where the leaves hide behind flower1 (% of its box)
const SPREAD = { x: 40, y: 50 };

/* ---------------- leaves timing ---------------- */
const LEAVES_DELAY = 1.2; // seconds after flower1 appears before the leaves start flying

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99"; // same golds as the envelope seal
const GOLD_CORE = "255, 240, 190";
const GLINT_TIME = 3.0; // glint duration across one flower (timeline units, scrubbed)
const FLOWER_GAP = 0.6; // delay between flower1 and flower2
const TEXT_STAGGER = 0.4; // delay between text lines
const TEXT_TIME = 1.3; // each line's fade-in time

/* ------------------------------------------------------------------ */
/* A flower image with a shine layer on top                            */
/* base  = the flower, revealed by a growing feathered circle          */
/* shine = gold ring, masked by the SAME image so it only lights petals */
/* ------------------------------------------------------------------ */
const ShineFlower = ({
  src,
  className,
  origin,
  children,
}: {
  src: string;
  className: string;
  origin: { x: number; y: number };
  children?: ReactNode;
}) => (
  <div className={className} data-flower data-ox={origin.x} data-oy={origin.y}>
    <div data-base className="invisible absolute inset-0">
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 768px) 75vw, 60vw"
        className="object-contain object-center"
      />
    </div>
    <div
      data-shine
      className="invisible pointer-events-none absolute inset-0"
      style={{
        WebkitMaskImage: `url('${src}')`,
        maskImage: `url('${src}')`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
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

const SecondSection = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const root = rootRef.current!;
    const q = gsap.utils.selector(root);
    const rand = gsap.utils.random;

    const leaves = q("[data-leaf]") as HTMLElement[];
    const flowers = q("[data-flower]") as HTMLElement[];
    const extras = q("[data-extra]") as HTMLElement[];
    const lines = q("[data-reveal]") as HTMLElement[];
    const glows = q("[data-glow]") as HTMLElement[];

    const mm = gsap.matchMedia();

    // reduced motion: just show everything, no animation
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(q("[data-base], [data-extra], [data-reveal]"), { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* ---------- measure everything BEFORE any transform ---------- */
      const rootRect = root.getBoundingClientRect();
      const W = rootRect.width;
      const H = rootRect.height;

      const centers = leaves.map((leaf) => {
        const r = leaf.getBoundingClientRect();
        return {
          x: r.left - rootRect.left + r.width / 2,
          y: r.top - rootRect.top + r.height / 2,
        };
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

      /* ---------- leaf start state ---------- */
      const start = leaves.map(() => ({
        x: rand(-SPREAD.x, SPREAD.x),
        y: rand(-SPREAD.y, SPREAD.y),
      }));
      leaves.forEach((leaf, i) => {
        gsap.set(leaf, {
          autoAlpha: 0,
          scale: 0.3,
          x: start[i].x,
          y: start[i].y,
          rotation: rand(-40, 40),
          transformPerspective: 500,
          force3D: true,
        });
      });

      // texts + small decorations start hidden
      gsap.set(lines, { autoAlpha: 0 });
      gsap.set(extras, { autoAlpha: 0 });

      /* ============ 1. FLOWERS: each one has its OWN scrubbed trigger ============ */
      // small decorations belong to the flower that contains them
      const extrasByFlower: HTMLElement[][] = flowers.map(() => []);
      extras.forEach((el) => {
        const owner = el.closest("[data-flower]") as HTMLElement | null;
        const idx = owner ? flowers.indexOf(owner) : 0;
        extrasByFlower[Math.max(idx, 0)].push(el);
      });

      rigs.forEach((rig, i) => {
        rig.paint(); // r = 0 -> nothing shows yet

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: rig.el, // starts when THIS flower reaches the screen
            // flower1 (top corner) keeps its range; the last flower sits at the very
            // bottom of the page, so it starts as soon as its top edge enters the
            // screen and finishes when its bottom edge is visible (always reachable)
            start: i === 0 ? "top 95%" : "top bottom",
            end: i === 0 ? "top 25%" : "bottom 65%",
            scrub: 1.25,
            invalidateOnRefresh: true,
          },
          defaults: { overwrite: false },
        });

        tl.set(rig.base, { autoAlpha: 1 }, 0);

        // the circle + glint grow from the flower's centre outward
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
        // glint flares up fast, then dies away
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

        // its leaves / small flowers / decorations bloom in after the glint
        extrasByFlower[i].forEach((el) => {
          tl.fromTo(
            el,
            { autoAlpha: 0, scale: 0.94 },
            { autoAlpha: 1, scale: 1, duration: 1.3, ease: "power2.out" },
            GLINT_TIME * 0.6,
          );
        });
      });

      /* ============ 2. TEXT: scrubbed over the text block's own position ============ */
      const textTl = gsap.timeline({
        scrollTrigger: {
          trigger: lines[0],
          endTrigger: lines[lines.length - 1],
          start: "top 85%",
          end: "bottom 55%",
          scrub: 1.25,
          invalidateOnRefresh: true,
        },
      });
      textTl.fromTo(
        lines,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: TEXT_TIME,
          ease: "power2.out",
          stagger: TEXT_STAGGER,
        },
        0,
      );
      // a gold glow passes over the names as they appear
      textTl.fromTo(
        glows,
        { textShadow: "0 0 0px rgba(212,175,55,0)" },
        {
          textShadow: "0 0 16px rgba(212,175,55,0.9)",
          duration: 1.2,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
          stagger: 0.25,
        },
        (lines.length - 2) * TEXT_STAGGER + 0.6,
      );

      /* ============ 3. LEAVES: normal time-based flight, plays ONCE ============ */
      // not scrubbed: starts when flower1 first shows, then flies on its own
      const leavesTl = gsap.timeline({ paused: true, delay: LEAVES_DELAY });

      // one landing spot per leaf along the BOTTOM edge, from the left corner to the
      // right corner, shuffled so neighbouring leaves don't land next to each other.
      const exits = gsap.utils.shuffle(
        leaves.map(
          (_, i) => -40 + ((i + rand(0.1, 0.9)) / leaves.length) * (W + 80),
        ),
      );

      leaves.forEach((leaf, i) => {
        const c = centers[i];

        const vx = exits[i] - c.x; // sideways distance to the landing spot
        const vy = H + 80 - c.y; // always > 0: leaves only ever go DOWN

        const dist = Math.hypot(vx, vy);
        const speed = rand(150, 240);
        const flyTime = dist / speed;
        const at = (i / leaves.length) * 7 + rand(0, 0.6);
        const wobbleTime = rand(0.8, 1.3);

        leavesTl.to(
          leaf,
          { autoAlpha: 1, scale: rand(0.7, 1.3), duration: 0.5 },
          at,
        );

        // same ease on x and y = a clean straight line along the triangle's edge
        leavesTl.to(
          leaf,
          {
            x: start[i].x + vx,
            y: start[i].y + vy,
            rotation: (vx < 0 ? -1 : 1) * rand(360, 900),
            rotationY: rand(540, 1440),
            duration: flyTime,
            ease: "power1.inOut",
            force3D: true,
          },
          at,
        );

        // small flutter so it feels like wind, not laser beams
        leavesTl.to(
          leaf,
          {
            yPercent: rand(-200, 200),
            xPercent: rand(-100, 100),
            duration: wobbleTime,
            yoyo: true,
            repeat: Math.round(flyTime / wobbleTime),
            ease: "sine.inOut",
          },
          at,
        );

        leavesTl.to(leaf, { autoAlpha: 0, duration: 0.4 }, at + flyTime - 0.4);
      });

      // fire once, the first time flower1 comes into view
      ScrollTrigger.create({
        trigger: flowers[0],
        start: "top 80%",
        once: true,
        onEnter: () => leavesTl.play(),
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="z-2 relative overflow-x-clip flex flex-col justify-start items-center -top-10 w-full min-h-dvh pt-10 pb-[34vw]"
    >
      <Image
        src="/envelope/secondbg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none absolute inset-0 z-0 object-fill object-center"
      />
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

      {/* frame: in the normal flow, so it grows with the text.
        pt = room for flower1, pb = room for flower2 (both scale with screen width) */}
      <div className="relative w-[95%] min-h-[calc(100dvh-5rem)] pt-[48vw] pb-[50vw]">
        <Image
          src="/envelope/border.png"
          alt=""
          fill
          sizes="95vw"
          className="pointer-events-none absolute inset-0 -z-0 object-fill object-center"
        />
        <div className="flex flex-col items-center z-2 w-full justify-center relative text-red-950 font-bold text-[clamp(11px,3.4vw,16px)] leading-[1.9] text-center px-[6vw]">
          <div className="w-full">
            <p data-reveal className="invisible">
              بكل الحب
            </p>
            <p data-reveal className="invisible">
              ندعوكم لمشاركتنا بداية جديدة
            </p>
            <p data-reveal className="invisible">
              في أجمل أيام العمر نحتفل معًا بحضوركم
            </p>
            <p data-reveal className="invisible">
              الّذي يكمل حكايتنا
            </p>
          </div>

          <div className="mt-[5vw] flex justify-between font-extrabold items-center w-full px-[4vw]">
            <p
              data-reveal
              className="invisible text-[clamp(13px,4vw,18px)] leading-[1.9]"
            >
              حرم السيد
              <br />
              محمد
            </p>
            <p
              data-reveal
              className="invisible text-[clamp(13px,4vw,18px)] leading-[1.9]"
            >
              حرم السيد
              <br />
              علي
            </p>
          </div>

          <div className="mt-[8vw]">
            <p data-reveal className="invisible">
              نتشرف بدعوتكم لحضور حفل زفاف نجليهما
            </p>
          </div>

          <div className="mt-[8vw] flex justify-between items-center w-full px-[4vw]">
            <p
              data-reveal
              data-glow
              className="invisible text-[clamp(1.5rem,8vw,2.5rem)] font-extrabold leading-[1.6]"
            >
              محمد
            </p>
            <p
              data-reveal
              data-glow
              className="invisible text-[clamp(1.5rem,8vw,2.5rem)] font-extrabold leading-[1.6]"
            >
              سعاد
            </p>
          </div>
        </div>

        {/* flower1: top corner. Size and offsets are tied to screen width */}
        <div className="absolute w-3/4 aspect-[3/4] -inset-s-[10vw] -top-[31vw]">
          {Array.from({ length: LEAF_COUNT }, (_, i) => (
            <div
              key={i}
              data-leaf
              className="invisible absolute z-0 w-1/5 h-8 will-change-transform"
              style={{ left: `${ORIGIN.x}%`, top: `${ORIGIN.y}%` }}
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

          <ShineFlower
            src="/envelope/flower1.png"
            origin={ORIGIN}
            className="absolute inset-0"
          >
            <div
              data-extra
              className="invisible absolute w-1/5 h-8 inset-s-15 -bottom-10"
            >
              <Image
                src="/envelope/leaf2.png"
                alt=""
                fill
                sizes="15vw"
                className="object-contain object-center"
              />
            </div>
          </ShineFlower>
        </div>

        {/* flower2: bottom corner */}
        <ShineFlower
          src="/envelope/flower2.png"
          origin={{ x: 50, y: 50 }}
          className="absolute w-[60%] aspect-[5/8] -inset-e-[5vw] -bottom-[31vw]"
        >
          <div
            data-extra
            className="invisible absolute w-1/4 h-20 inset-e-5 -top-14"
          >
            <Image
              src="/envelope/Asset_2_2.png"
              alt=""
              fill
              sizes="25vw"
              className="object-contain object-center"
            />
          </div>
          <div
            data-extra
            className="invisible absolute w-1/5 h-8 inset-e-5 -top-25"
          >
            <Image
              src="/envelope/leaf1.png"
              alt=""
              fill
              sizes="15vw"
              loading="eager"
              className="object-contain object-center"
            />
          </div>
        </ShineFlower>
      </div>
    </div>
  );
};

export default SecondSection;
