"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---------------- leaves ---------------- */
const WIND_DIR = -1; // -1 = leaves spin/blow to the left
const LEAF_COUNT = 24;
const ORIGIN = { x: 40, y: 35 }; // where the leaves hide behind flower1 (% of its box)
const SPREAD = { x: 40, y: 50 };

/* ---------------- shine + timing ---------------- */
const GOLD = "249, 218, 99"; // same golds as the envelope seal
const GOLD_CORE = "255, 240, 190";
const GLINT_TIME = 2.2; // seconds the glint takes to cross one flower
const FLOWER_GAP = 0.6; // delay between flower1 and flower2
const TEXT_STAGGER = 0.3; // delay between text lines
const TEXT_TIME = 1.1; // each line's fade-in time

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
    <div
      data-base
      className="invisible absolute inset-0 bg-center bg-contain bg-no-repeat"
      style={{ backgroundImage: `url('${src}')` }}
    />
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

        const paint = () => {
          const edge = st.r;
          // reveal: flower visible inside the circle
          setMask(
            base,
            `radial-gradient(circle at ${ox}px ${oy}px, #000 ${Math.max(edge - feather, 0)}px, transparent ${edge}px)`,
          );
          // glint: comet ring just inside the edge, strength follows st.amp
          const g = edge - feather * 0.25;
          shine.style.opacity = String(st.amp);
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
        });
      });

      // texts + small decorations start hidden
      gsap.set(lines, { autoAlpha: 0 });
      gsap.set(extras, { autoAlpha: 0 });

      const master = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 55%", once: true },
      });

      /* ============ 1. FLOWERS: gold glint + reveal ============ */
      rigs.forEach((rig, i) => {
        const t0 = i * FLOWER_GAP;
        rig.paint(); // r = 0 -> nothing shows yet

        master.set(rig.base, { autoAlpha: 1 }, t0);
        master.set(rig.shine, { visibility: "visible" }, t0);

        // the circle + glint grow from the flower's centre outward
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
        // glint flares up fast, then dies away
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
        // clean up: drop the mask so nothing is left over
        master.call(
          () => {
            clearMask(rig.base);
            rig.shine.style.visibility = "hidden";
          },
          [],
          t0 + GLINT_TIME + 0.05,
        );
      });

      // leaves, small flowers and decorations bloom in after their flower
      extras.forEach((el) => {
        const owner = el.closest("[data-flower]") as HTMLElement | null;
        const idx = owner ? flowers.indexOf(owner) : 0;
        master.fromTo(
          el,
          { autoAlpha: 0, scale: 0.8 },
          { autoAlpha: 1, scale: 1, duration: 1, ease: "back.out(1.4)" },
          idx * FLOWER_GAP + GLINT_TIME * 0.6,
        );
      });

      /* ============ 2. TEXT: soft blur-fade, line by line ============ */
      master.addLabel("text", "-=0.5");
      master.fromTo(
        lines,
        { autoAlpha: 0, y: 18, filter: "blur(8px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: TEXT_TIME,
          ease: "power3.out",
          stagger: TEXT_STAGGER,
          clearProps: "filter",
        },
        "text",
      );
      // a gold glow passes over the names as they appear
      master.fromTo(
        glows,
        { textShadow: "0 0 0px rgba(212,175,55,0)" },
        {
          textShadow: "0 0 16px rgba(212,175,55,0.9)",
          duration: 0.9,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
          stagger: 0.25,
        },
        `text+=${(lines.length - 2) * TEXT_STAGGER + 0.6}`,
      );

      /* ============ 3. LEAVES: blow out from behind flower1 ============ */
      master.addLabel(
        "leaves",
        `text+=${(lines.length - 1) * TEXT_STAGGER + 0.4}`,
      );

      // one landing spot per leaf along the BOTTOM edge, from the left corner to the
      // right corner, shuffled so neighbouring leaves don't land next to each other.
      // flower = tip of the triangle, bottom edge = its base.
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
        const speed = rand(220, 380);
        const flyTime = dist / speed;
        const at = (i / leaves.length) * 6 + rand(0, 0.5);
        const wobbleTime = rand(0.5, 0.9);

        master.to(
          leaf,
          { autoAlpha: 1, scale: rand(0.7, 1.3), duration: 0.35 },
          `leaves+=${at}`,
        );

        // same ease on x and y = a clean straight line along the triangle's edge
        master.to(
          leaf,
          {
            x: start[i].x + vx,
            y: start[i].y + vy,
            rotation: (vx < 0 ? -1 : 1) * rand(360, 900),
            rotationY: rand(540, 1440),
            duration: flyTime,
            ease: "power1.inOut",
          },
          `leaves+=${at}`,
        );

        // small flutter so it feels like wind, not laser beams
        master.to(
          leaf,
          {
            yPercent: rand(-200, 200),
            xPercent: rand(-100, 100),
            duration: wobbleTime,
            yoyo: true,
            repeat: Math.round(flyTime / wobbleTime),
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
      className="bg-[url('/envelope/secondbg.png')] z-2 relative overflow-x-clip bg-cover bg-no-repeat bg-center flex flex-col justify-center items-center -top-10 w-full h-[calc(100vh+2vh)]"
      style={{ backgroundSize: "100% 100%" }}
    >
      <div
        data-extra
        className="invisible bg-[url('/envelope/Asset_2_1.png')] absolute w-1/4 h-20 -inset-e-8 top-5 bg-center bg-contain bg-no-repeat"
      ></div>

      <div
        className="bg-[url('/envelope/border.png')] absolute w-[95%] h-[90%] top-10 bg-center bg-no-repeat"
        style={{ backgroundSize: "100% 100%" }}
      >
        <div className="flex flex-col items-center z-2 justify-center top-40 relative text-red-950 font-bold text-xs leading-7 text-center p-2">
          <div>
            <p data-reveal className="invisible">
              بكل الحب نعلن
            </p>
            <p data-reveal className="invisible">
              وبكل الحب ندعوكم لمشاركتنا بداية جديدة
            </p>
            <p data-reveal className="invisible">
              في أجمل أيام العمر نحتفل معًا بحضوركم
            </p>
            <p data-reveal className="invisible">
              الّذي يكمل حكايتنا
            </p>
          </div>

          <div className="mt-10 flex justify-between font-extrabold items-center w-full px-10">
            <p data-reveal className="invisible text-sm leading-7">
              حرم السيد
              <br />
              محمد
            </p>
            <p data-reveal className="invisible text-sm leading-7">
              حرم السيد
              <br />
              علي
            </p>
          </div>

          <div className="mt-10">
            <p data-reveal className="invisible">
              نتشرف بدعوتكم لحضور حفل زفاف نجليهما
            </p>
          </div>

          <div className="mt-10 flex justify-between items-center w-full px-10">
            <p
              data-reveal
              data-glow
              className="invisible text-2xl font-extrabold leading-7"
            >
              محمد
            </p>
            <p
              data-reveal
              data-glow
              className="invisible text-2xl font-extrabold leading-7"
            >
              سعاد
            </p>
          </div>
        </div>

        {/* flower1 box: leaves hide behind the flower, flower is on top */}
        <div className="absolute w-3/4 h-90 -inset-s-10 -top-30">
          {Array.from({ length: LEAF_COUNT }, (_, i) => (
            <div
              key={i}
              data-leaf
              className="bg-[url('/envelope/leaf1.png')] invisible absolute z-0 w-1/5 h-8 bg-center bg-contain bg-no-repeat"
              style={{ left: `${ORIGIN.x}%`, top: `${ORIGIN.y}%` }}
            ></div>
          ))}

          <ShineFlower
            src="/envelope/flower1.png"
            origin={ORIGIN}
            className="absolute inset-0"
          >
            <div
              data-extra
              className="invisible bg-[url('/envelope/leaf2.png')] absolute w-1/5 h-8 inset-s-15 -bottom-10 bg-center bg-contain bg-no-repeat"
            ></div>
          </ShineFlower>
        </div>

        <ShineFlower
          src="/envelope/flower2.png"
          origin={{ x: 50, y: 50 }}
          className="absolute w-[60%] h-90 -inset-e-5 -bottom-30"
        >
          <div
            data-extra
            className="invisible bg-[url('/envelope/Asset_2_2.png')] absolute w-1/4 h-20 inset-e-5 -top-14 bg-center bg-contain bg-no-repeat"
          ></div>
          <div
            data-extra
            className="invisible bg-[url('/envelope/leaf1.png')] absolute w-1/5 h-8 inset-e-5 -top-25 bg-center bg-contain bg-no-repeat"
          ></div>
        </ShineFlower>
      </div>
    </div>
  );
};

export default SecondSection;
