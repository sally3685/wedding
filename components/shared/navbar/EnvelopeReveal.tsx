"use client";

/**
 * EnvelopeOpening
 * ---------------------------------------------------------------
 * Full-screen 3D envelope overlay. Tap it and the four flaps swing
 * open (left + right first, top + bottom after a short delay) and
 * leave the screen, revealing the page underneath.
 *
 * - Three.js (via React Three Fiber) handles lights + shadows
 * - GSAP handles the animation timeline
 * - Every flap and the wax seal is its own image
 * - The canvas is transparent: nothing sits under the envelope
 * - On tap, a gold glint plays on the seal first. When it ends, a circle grows from
 *   the seal to every edge and swaps the normal flap images for their shine versions
 *   (the circle itself is only a mask), and the flaps start opening
 *
 * Images go in /public/envelope/ (or pass your own paths):
 *   left.png  right.png  top.png  bottom.png  seal.png
 *   left_shine.png  right_shine.png  top_shine.png  bottom_shine.png
 * Each *_shine image must have the SAME size and the SAME cut-out shape as its
 * normal image, so the two line up pixel for pixel.
 * Flap images should be FLAT-LIT (no baked shadows/highlights).
 * Each flap image is mapped onto the bounding box of its triangle:
 *   left / right -> (W/2 x H)     top / bottom -> (W x H/2)
 * Transparent pixels outside the triangle are fine.
 *
 * Install:  npm i three @react-three/fiber gsap
 *           npm i -D @types/three
 * (R3F v8 for React 18, R3F v9 for React 19 / Next 15)
 *
 * Use it with a client-only import:
 *   const EnvelopeOpening = dynamic(
 *     () => import("@/components/EnvelopeOpening"),
 *     { ssr: false }
 *   );
 */

import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import * as THREE from "three";
import EnvelopeLoader from "./EnvelopeLoader";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import gsap from "gsap";

/* ------------------------------------------------------------------ */
/* Types + defaults                                                    */
/* ------------------------------------------------------------------ */

export interface EnvelopeImages {
  left: string;
  right: string;
  top: string;
  bottom: string;
  seal: string;
}

/** The "shine" version of each flap (same size + shape as the normal one). */
export type ShineImages = Omit<EnvelopeImages, "seal">;

export interface EnvelopeOpeningProps {
  /** Image paths for each part. */
  images?: EnvelopeImages;
  /** Image paths for the shine version of each flap. */
  shineImages?: ShineImages;
  /** Called when every flap has left the screen (canvas is unmounted right after). */
  onOpened?: () => void;
  /** Seconds the glint on the seal plays. The reveal circle starts when it ends. */
  sealShineDuration?: number;
  /** Seconds the shine circle takes to grow from the seal to the farthest corner. */
  revealDuration?: number;
  /** Seconds between the reveal circle starting and the flaps starting to open. */
  openDelay?: number;
  /** Seconds between the side flaps starting and the top/bottom flaps starting. */
  verticalDelay?: number;
  /** Seconds each flap takes to swing open. */
  duration?: number;
  /** Colour of the back of the flaps (seen briefly while they swing). */
  paperColor?: string;
  /** Seal diameter as a fraction of the shorter screen side. */
  sealSize?: number;
  /** Light strength multiplier (1 = flaps look like your images at rest). */
  lightIntensity?: number;
  /** Opacity of the envelope shadow cast onto your page (0 - 1). */
  pageShadowOpacity?: number;
  /** Shadow blur. Higher = softer, more "sunlight" like. Try 8 - 24. */
  shadowSoftness?: number;
  /**
   * Depth between the stacked layers (world units). This is what makes the
   * flaps cast visible soft shadows onto each other while the envelope is
   * still closed. Bigger = deeper, wider shadows. Try 0.03 - 0.1.
   */
  layerGap?: number;
  /** Darkness of all shadows, 0 (none) - 1 (full). */
  shadowIntensity?: number;
  zIndex?: number;
}

const DEFAULT_IMAGES: EnvelopeImages = {
  left: "/envelope/red/left.png",
  right: "/envelope/red/right.png",
  top: "/envelope/red/top.png",
  bottom: "/envelope/red/bottom.png",
  seal: "/envelope/red/seal.png",
};

const DEFAULT_SHINE_IMAGES: ShineImages = {
  left: "/envelope/red/goldLeft.png",
  right: "/envelope/red/goldRight.png",
  top: "/envelope/red/goldTop.png",
  bottom: "/envelope/red/goldBottom.png",
};

// "Sun" comes from the left (and a little from above / the front).
// Calibrated so a flat flap facing the camera renders at EXACTLY its image colour:
//   (AMBIENT + KEY * cos(angle to the light)) / PI = 1
// A flap that turns away from the sun falls back to mostly ambient light (darker);
// one that turns toward it is capped at its image colour (never washed out).
const AMBIENT_BASE = 1.1;
const KEY_BASE = 3.587;
const KEY_START: [number, number, number] = [-6, 2.5, 4.5];

// Radius range of the seal's glint ring (0 = seal centre, 1 = seal rim). It starts just
// inside the centre so the glint appears at once, and ends past the rim so it fully leaves.
const SEAL_SHINE_START = -0.15;
const SEAL_SHINE_END = 1.25;
// The glint ring has fully left the seal after this fraction of its duration, so the reveal
// circle starts then (no dead time between the two). Raise it if the circle starts too early.
const REVEAL_AT = 0.94;

// Gold of the seal's glint: the wide soft ring, and the thin brighter line inside it.
// (Hex colours are converted to linear for you, so they look like the hex you pick.)
const SEAL_SHINE_COLOR = new THREE.Color("#f9da63");
const SEAL_SHINE_CORE = new THREE.Color("#ffe39a");

/* ------------------------------------------------------------------ */
/* Mutable animation singletons                                        */
/* ------------------------------------------------------------------ */
/*
 * Three.js shaders + the GSAP timeline drive these values every frame,
 * far outside React's render cycle. They must be:
 *   - stable (same object for the life of the scene),
 *   - readable during render by the shader hook factories,
 *   - writable by GSAP after render.
 *
 * A module-level object satisfies all three: React Compiler treats
 * module-scope values as opaque external state and won't flag them.
 * (Refs and state both trip its "no mutation / no ref access in render"
 * rules, because their whole point is to be React-owned.)
 */

const revealUniforms: RevealUniforms = {
  radius: { value: 0 },
  feather: { value: 0.4 },
  center: { value: new THREE.Vector2(0, 0) },
};

const flapPivots = {
  left: new THREE.Vector2(),
  right: new THREE.Vector2(),
  top: new THREE.Vector2(),
  bottom: new THREE.Vector2(),
};

const sealShineState = { value: SEAL_SHINE_START };
const sealShineAmpState = { value: 0 };

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

/**
 * Triangle in pivot-local space. UVs are mapped to the bounding box of the
 * ORIGINAL triangle so a flap image lines up with where it sits on screen.
 * `inflate` grows the triangle around its centroid WITHOUT moving the image,
 * so the lower layers (top/bottom) extend a little underneath the side flaps.
 * That gives a real overlap, so the side flaps cast a shadow onto them
 * with no gap or seam showing the page behind.
 */
function makeTriangle(points: [Pt, Pt, Pt], inflate = 1): THREE.BufferGeometry {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (xs[0] + xs[1] + xs[2]) / 3;
  const cy = (ys[0] + ys[1] + ys[2]) / 3;

  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];

  for (const [x, y] of points) {
    const px = cx + (x - cx) * inflate;
    const py = cy + (y - cy) * inflate;
    uvs.push((px - minX) / (maxX - minX), (py - minY) / (maxY - minY));
    positions.push(px, py, 0);
    normals.push(0, 0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex([0, 1, 2]);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Shine reveal (circle growing from the seal)                         */
/* ------------------------------------------------------------------ */

type ShaderLike = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

/** Uniforms shared by all four flaps, so they reveal together as ONE circle. */
interface RevealUniforms {
  radius: { value: number };
  feather: { value: number };
  center: { value: THREE.Vector2 };
}

/**
 * Patches a flap's material so it shows its shine image inside the circle and
 * its normal image outside. The distance to the seal is measured from where
 * each pixel sits on the CLOSED envelope (local position + the flap's pivot),
 * so the circle stays correct while the flaps swing open.
 */
function makeRevealHook(
  shineMap: THREE.Texture,
  pivot: THREE.Vector2,
  u: RevealUniforms,
) {
  return (shader: ShaderLike) => {
    shader.uniforms.uShineMap = { value: shineMap };
    shader.uniforms.uPivot = { value: pivot };
    shader.uniforms.uRadius = u.radius;
    shader.uniforms.uFeather = u.feather;
    shader.uniforms.uCenter = u.center;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec2 uPivot;
        varying vec2 vRevealUv;
        varying vec2 vClosed;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vRevealUv = uv;
        vClosed = position.xy + uPivot;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uShineMap;
        uniform float uRadius;
        uniform float uFeather;
        uniform vec2 uCenter;
        varying vec2 vRevealUv;
        varying vec2 vClosed;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        // 1 inside the growing circle, 0 outside, with a soft feathered edge
        float revealD = length(vClosed - uCenter);
        float revealM = 1.0 - smoothstep(uRadius - uFeather, uRadius, revealD);
        vec4 shineTex = texture2D(uShineMap, vRevealUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, shineTex.rgb, revealM);
        diffuseColor.a = mix(diffuseColor.a, shineTex.a, revealM);`,
      )
      .replace(
        "#include <tonemapping_fragment>",
        `// Never let a lit flap go brighter than its image. Plain clipping would turn
        // bright colours white / faded; scaling by the brightest channel keeps the hue.
        float flapMax = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
        if (flapMax > 1.0) gl_FragColor.rgb /= flapMax;
        #include <tonemapping_fragment>`,
      );
  };
}

/* ------------------------------------------------------------------ */
/* One flap: textured front + plain paper back, pivoting at its hinge  */
/* ------------------------------------------------------------------ */

interface FlapProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  position: [number, number, number];
  paperColor: string;
  /** Shader patch for the front face (the shine reveal). */
  onBeforeCompile?: (shader: ShaderLike) => void;
  children?: ReactNode;
}

const Flap = forwardRef<THREE.Group, FlapProps>(function Flap(
  { geometry, texture, position, paperColor, onBeforeCompile, children },
  ref,
) {
  return (
    <group ref={ref} position={position}>
      {/* front: the image. Lambert = pure diffuse, no white specular sheen on top of your colours */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial
          map={texture}
          alphaTest={0.5}
          side={THREE.FrontSide}
          shadowSide={THREE.DoubleSide}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>
      {/* back: plain paper */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial
          color={paperColor}
          side={THREE.BackSide}
          shadowSide={THREE.DoubleSide}
        />
      </mesh>
      {children}
    </group>
  );
});

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

interface SceneProps extends Required<
  Omit<EnvelopeOpeningProps, "onOpened" | "zIndex">
> {
  open: boolean;
  onReady: () => void;
  onDone: () => void;
}

function Scene({
  images,
  shineImages,
  open,
  onReady,
  onDone,
  sealShineDuration,
  revealDuration,
  openDelay,
  verticalDelay,
  duration,
  paperColor,
  sealSize,
  lightIntensity,
  pageShadowOpacity,
  shadowSoftness,
  layerGap,
  shadowIntensity,
}: SceneProps) {
  // World-space size of the visible area at z = 0 -> the envelope fills it exactly.
  const { viewport } = useThree();
  const W = viewport.width;
  const H = viewport.height;

  const [left, right, top, bottom, seal, leftS, rightS, topS, bottomS] =
    useLoader(THREE.TextureLoader, [
      images.left,
      images.right,
      images.top,
      images.bottom,
      images.seal,
      shineImages.left,
      shineImages.right,
      shineImages.top,
      shineImages.bottom,
    ]);

  // Correct colour space so the images keep their real colours.
  useLayoutEffect(() => {
    for (const t of [
      left,
      right,
      top,
      bottom,
      seal,
      leftS,
      rightS,
      topS,
      bottomS,
    ]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
  }, [left, right, top, bottom, seal, leftS, rightS, topS, bottomS]);

  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const topRef = useRef<THREE.Group>(null);
  const bottomRef = useRef<THREE.Group>(null);

  // Keep the module-level singletons in sync with the current screen size.
  useLayoutEffect(() => {
    flapPivots.left.set(-W / 2, 0);
    flapPivots.right.set(W / 2, 0);
    flapPivots.top.set(0, H / 2);
    flapPivots.bottom.set(0, -H / 2);
    revealUniforms.feather.value = Math.min(W, H) * 0.25;
  }, [W, H]);

  const revealHooks = useMemo(
    () => ({
      left: makeRevealHook(leftS, flapPivots.left, revealUniforms),
      right: makeRevealHook(rightS, flapPivots.right, revealUniforms),
      top: makeRevealHook(topS, flapPivots.top, revealUniforms),
      bottom: makeRevealHook(bottomS, flapPivots.bottom, revealUniforms),
    }),
    [leftS, rightS, topS, bottomS],
  );

  // Adds a glint to the seal's material that expands as a ring from the CENTRE of the
  // seal outward, the same direction the reveal circle then continues in. It only
  // affects pixels the seal image actually covers (transparent pixels are discarded
  // before this runs).
  const sealShine = useMemo(
    () =>
      (shader: {
        uniforms: Record<string, { value: unknown }>;
        vertexShader: string;
        fragmentShader: string;
      }) => {
        shader.uniforms.uShine = sealShineState;
        shader.uniforms.uShineAmp = sealShineAmpState;
        shader.uniforms.uShineColor = { value: SEAL_SHINE_COLOR };
        shader.uniforms.uShineCore = { value: SEAL_SHINE_CORE };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 vShineUv;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvShineUv = uv;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 vShineUv;\nuniform float uShine;\nuniform vec3 uShineColor;\nuniform vec3 uShineCore;\nuniform float uShineAmp;\nfloat sLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }\nfloat sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
          // ---- a glint that catches the RELIEF of the gold, like real light would ----
          // Use the seal's own brightness as a height map: ridges and edges of the
          // embossing catch the light, flat areas barely do.
          float sE = 0.004;
          float sCentre = sLum(texture2D(map, vShineUv).rgb);
          vec2 sGrad = vec2(
            sLum(texture2D(map, vShineUv + vec2(sE, 0.0)).rgb) - sLum(texture2D(map, vShineUv - vec2(sE, 0.0)).rgb),
            sLum(texture2D(map, vShineUv + vec2(0.0, sE)).rgb) - sLum(texture2D(map, vShineUv - vec2(0.0, sE)).rgb)
          );
          float sEdge = clamp(length(sGrad) * 7.0, 0.0, 1.0);

          // distance from the centre of the seal: 0 at the centre, ~1 at the rim
          float shineD = length(vShineUv - vec2(0.5)) * 2.0;

          // the light travels outward from the centre: slopes that face outward flash hardest
          vec2 sOut = normalize(vShineUv - vec2(0.5) + vec2(1e-5));
          float sFacing = clamp(dot(normalize(sGrad + vec2(1e-5)), sOut) * 0.5 + 0.5, 0.0, 1.0);
          float sRelief = 0.18 + 0.82 * sEdge * (0.35 + 0.65 * sFacing) + 0.30 * smoothstep(0.35, 0.85, sCentre);

          // comet-like front: a sharp leading edge and a long soft tail behind it
          float sd = shineD - uShine;
          float sBand = exp(-pow(sd / (sd < 0.0 ? 0.34 : 0.09), 2.0));

          float sGlint = sBand * sRelief * uShineAmp;

          // gold is a metal: it reflects light tinted by its OWN colour, with a hotter core
          totalEmissiveRadiance += (diffuseColor.rgb * 1.8 + uShineColor * 0.4) * sGlint;
          totalEmissiveRadiance += uShineCore * (sGlint * sGlint) * 1.3;

          // a few tiny glints that flicker on the ridges as the light passes
          float sSpark = step(0.965, sHash(floor(vShineUv * 110.0) + floor(uShine * 24.0)));
          totalEmissiveRadiance += uShineCore * sSpark * sBand * sEdge * uShineAmp * 1.6;`,
          );
      },
    [],
  );
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Four triangles meeting in the centre, rebuilt when the screen size changes.
  const geos = useMemo(
    () => ({
      // side flaps are the TOP layer: exact triangles
      left: makeTriangle([
        [0, H / 2 + 0.6],
        [0, -H / 2 - 0.6],
        [W / 2 + 0.1, 0],
      ]),
      right: makeTriangle([
        [0, H / 2 + 0.6],
        [-W / 2 - 0.1, 0],
        [0, -H / 2 - 0.6],
      ]),
      // top / bottom are the layer BELOW: slightly larger, tucked under the sides
      top: makeTriangle(
        [
          [-W / 2, 0],
          [0, -H / 2],
          [W / 2, 0],
        ],
        1.06,
      ),
      bottom: makeTriangle(
        [
          [-W / 2, 0],
          [W / 2, 0],
          [0, H / 2],
        ],
        1.06,
      ),
    }),
    [W, H],
  );
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
    },
    [geos],
  );

  // Shadow camera must cover the whole screen + the flaps swinging toward the viewer.
  useLayoutEffect(() => {
    const light = keyLightRef.current;
    if (!light) return;
    const s = Math.max(W, H) * 1.2;
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = 20;
    cam.updateProjectionMatrix();
  }, [W, H]);

  // Tell the wrapper the textures are loaded so it can drop its placeholder background.
  useEffect(() => {
    onReady();
  }, [onReady]);

  // The opening animation.
  useEffect(() => {
    if (!open) return;
    const l = leftRef.current;
    const r = rightRef.current;
    const t = topRef.current;
    const b = bottomRef.current;
    const light = keyLightRef.current;
    if (!l || !r || !t || !b || !light) return;

    const ease = "power2.in"; // slow start, accelerates out of frame
    const total = duration + verticalDelay;
    const u = revealUniforms;
    const shine = sealShineState;
    const shineAmp = sealShineAmpState;

    const tl = gsap.timeline({ onComplete: () => onDoneRef.current() });

    // 0. the wax seal catches the light: a gold glint expands from its centre to its rim.
    //    The ring speeds up as it goes, so it flows straight into the reveal circle.
    //    Its strength flares up and dies away like a real flash.
    shine.value = SEAL_SHINE_START;
    shineAmp.value = 0;
    tl.to(
      shine,
      { value: SEAL_SHINE_END, duration: sealShineDuration, ease: "power1.in" },
      0,
    );
    tl.to(
      shineAmp,
      { value: 1, duration: sealShineDuration * 0.5, ease: "power2.out" },
      0,
    );
    tl.to(
      shineAmp,
      {
        value: 0,
        duration: sealShineDuration * (REVEAL_AT - 0.5),
        ease: "power1.in",
      },
      sealShineDuration * 0.5,
    );

    // 1. the reveal starts the instant the glint leaves the seal: a circle grows from the
    //    seal's rim to the farthest corner (+ feather), swapping every flap to its shine
    //    image. It is only a mask. It begins AT the rim (not at 0) so it shows at once.
    tl.addLabel("reveal", sealShineDuration * REVEAL_AT);
    const sealR = (Math.min(W, H) * sealSize) / 2;
    const startR = sealR + u.feather.value * 0.5;
    const maxR = Math.hypot(W / 2 + 0.3, H / 2 + 0.3) + u.feather.value;
    u.radius.value = 0; // nothing revealed until the glint is done
    tl.fromTo(
      u.radius,
      { value: startR },
      {
        value: maxR,
        duration: revealDuration,
        ease: "power2.out",
        immediateRender: false,
      },
      "reveal",
    );

    // 2. left + right start first, only `openDelay` after the reveal began
    tl.addLabel("sides", `reveal+=${openDelay}`);
    tl.to(l.rotation, { y: -Math.PI, duration, ease }, "sides");
    tl.to(r.rotation, { y: Math.PI, duration, ease }, "sides");

    // 3. top + bottom start after a delay, while the sides are still moving
    tl.to(
      t.rotation,
      { x: -Math.PI, duration, ease },
      `sides+=${verticalDelay}`,
    );
    tl.to(
      b.rotation,
      { x: Math.PI, duration, ease },
      `sides+=${verticalDelay}`,
    );

    // 4. the sun stays on the LEFT the whole time (so the left side stays bright and
    //    the right side stays in shade). It only swells and drifts a little in height.
    tl.to(
      light,
      {
        intensity: KEY_BASE * lightIntensity * 1.15,
        duration: total / 2,
        yoyo: true,
        repeat: 1,
        ease: "sine.inOut",
      },
      "sides",
    );
    tl.to(
      light.position,
      { y: 3.5, duration: total, ease: "sine.inOut" },
      "sides",
    );

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sealImg = seal.image as unknown as { width: number; height: number };
  const sealW = Math.min(W, H) * sealSize;
  const sealH = sealW * (sealImg.height / sealImg.width);

  return (
    <>
      <ambientLight intensity={AMBIENT_BASE * lightIntensity} />
      <directionalLight
        ref={keyLightRef}
        position={KEY_START}
        intensity={KEY_BASE * lightIntensity}
        castShadow
        // Variance shadow maps blur their edges (radius / blurSamples), which
        // is what gives the soft, sun-like falloff instead of a hard edge.
        shadow-mapSize={[1024, 1024]}
        shadow-radius={shadowSoftness}
        shadow-intensity={shadowIntensity}
        shadow-blurSamples={25}
        shadow-bias={-0.0002}
        shadow-normalBias={0}
      />

      {/* Invisible plane that only shows shadows -> envelope shadow falls on your page */}
      <mesh position={[0, 0, -0.05]} receiveShadow>
        <planeGeometry args={[W * 3, H * 3]} />
        <shadowMaterial transparent opacity={pageShadowOpacity} />
      </mesh>

      {/* left + right: hinged on the side edges, the TOP layer (they overlap top/bottom, like a real envelope) */}
      <Flap
        ref={leftRef}
        geometry={geos.left}
        texture={left}
        position={[-W / 2, 0, layerGap]}
        paperColor={paperColor}
        onBeforeCompile={revealHooks.left}
      >
        {/* wax seal: glued to the left flap, sitting at the envelope's centre point.
            z is above the top/bottom flaps so they never hide it. */}
        <mesh position={[W / 2, 0, layerGap]} castShadow receiveShadow>
          <planeGeometry args={[sealW, sealH]} />
          <meshStandardMaterial
            map={seal}
            alphaTest={0.5}
            roughness={0.35}
            metalness={0.15}
            side={THREE.FrontSide}
            shadowSide={THREE.DoubleSide}
            onBeforeCompile={sealShine}
          />
        </mesh>
      </Flap>
      <Flap
        ref={rightRef}
        geometry={geos.right}
        texture={right}
        position={[W / 2, 0, layerGap]}
        paperColor={paperColor}
        onBeforeCompile={revealHooks.right}
      />

      {/* bottom + top: the lower layer, tucked under the side flaps */}
      <Flap
        ref={bottomRef}
        geometry={geos.bottom}
        texture={bottom}
        position={[0, -H / 2, 0]}
        paperColor={paperColor}
        onBeforeCompile={revealHooks.bottom}
      />

      {/* (top sits a hair above bottom so the two never z-fight under the seal) */}
      <Flap
        ref={topRef}
        geometry={geos.top}
        texture={top}
        position={[0, H / 2, 0.006]}
        paperColor={paperColor}
        onBeforeCompile={revealHooks.top}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export default function EnvelopeOpening({
  images = DEFAULT_IMAGES,
  shineImages = DEFAULT_SHINE_IMAGES,
  onOpened,
  sealShineDuration = 1,
  revealDuration = 2.9,
  openDelay = 0,
  verticalDelay = 0.7,
  duration = 3,
  paperColor = "#f3ece0",
  sealSize = 0.3,
  lightIntensity = 1,
  pageShadowOpacity = 0.1,
  shadowSoftness = 8,
  layerGap = 0.05,
  shadowIntensity = 1.3,
  zIndex = 9999,
}: EnvelopeOpeningProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);

  // Wait two animation frames so the envelope has really been painted
  // before the loader starts fading (no flash of an empty canvas).
  const handleReady = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  const handleDone = useCallback(() => {
    setVisible(false); // unmounts the canvas: frees the GPU, page is fully interactive
    onOpened?.();
  }, [onOpened]);

  const handleOpen = useCallback(() => {
    if (open || !ready) return;
    setOpen(true);

    // Respect reduced motion: simple fade instead of the 3D swing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.to(wrapperRef.current, {
        opacity: 0,
        duration: 0.4,
        onComplete: handleDone,
      });
    }
  }, [open, ready, handleDone]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={wrapperRef}
      role="button"
      tabIndex={0}
      aria-label="Open the invitation"
      onClick={handleOpen}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        zIndex,
        cursor: open ? "default" : "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        // Only while images load, so the page doesn't flash before the envelope shows.
        background: "transparent",
      }}
    >
      <Canvas
        shadows="variance"
        flat // no tone mapping: your images keep their exact colours
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 50 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.NoToneMapping; // tone mapping would fade your colours
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene
            images={images}
            shineImages={shineImages}
            open={open}
            onReady={handleReady}
            onDone={handleDone}
            sealShineDuration={sealShineDuration}
            revealDuration={revealDuration}
            openDelay={openDelay}
            verticalDelay={verticalDelay}
            duration={duration}
            paperColor={paperColor}
            sealSize={sealSize}
            lightIntensity={lightIntensity}
            pageShadowOpacity={pageShadowOpacity}
            shadowSoftness={shadowSoftness}
            layerGap={layerGap}
            shadowIntensity={shadowIntensity}
          />
        </Suspense>
      </Canvas>
      {!loaderGone && (
        <EnvelopeLoader
          paperColor={paperColor}
          fading={ready}
          onFaded={() => setLoaderGone(true)}
          zIndex={zIndex + 1}
        />
      )}
    </div>
  );
}
