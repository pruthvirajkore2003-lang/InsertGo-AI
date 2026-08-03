/**
 * ThinkingOrb — canvas "thinking orb" for AI-processing states, ported from
 * orbs.jakubantalik.com (de-minified 1:1: same math, same per-mode/per-size
 * tunables) and re-branded for InsertGo. Six dot-field modes (orbits, globe,
 * rubik, wave, ribbon, morph) map 1:1 onto the app's AI states; a rAF loop
 * draws depth-sorted dots each frame, pausing off-screen / on hidden tab and
 * collapsing to a single static frame under prefers-reduced-motion.
 *
 * BRANDING: the source drew grayscale ink (inverted per theme). Here every dot
 * is mixed from the app's --ig-accent cobalt TOWARD WHITE by the dot's `white`
 * depth factor — bright white-cobalt front, deep cobalt back — identical in
 * dark and light themes (brand look, no light-theme inversion). The accent is
 * resolved from the CSS token once and re-resolved when [data-theme] flips on
 * <html> (e.g. high-contrast re-skins the orb). Alpha logic is untouched.
 *
 * SIZE: the source ships tuning presets only for 64 and 20 — any other size
 * would crash its lookup. We snap internally to the nearest preset for config
 * + canvas resolution and honor the requested `size` purely by CSS-scaling the
 * canvas element.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react";

export type OrbState =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "composing"
  | "shaping";

type OrbMode = "orbits" | "globe" | "rubik" | "wave" | "ribbon" | "morph";

type RGB = { r: number; g: number; b: number };

/** One dot in the shared draw pass: screen position + depth, base radius,
 *  `white` depth factor (0 = pure accent, 1 = pure white), optional alpha. */
type OrbDot = {
  x: number;
  y: number;
  z: number;
  r: number;
  white: number;
  a?: number;
};

/** Loose numeric bag of per-mode tunables (each renderer reads its own keys
 *  with the source site's defaults as `??` fallbacks). */
type OrbOpts = Record<string, number | undefined>;

type Renderer = (
  ctx: CanvasRenderingContext2D,
  size: number,
  t: number,
  accent: RGB,
  opts: OrbOpts,
) => void;

/* ---------------------------------------------------------------- helpers */

/** Deterministic hash noise in [0,1) — stable per (seed, salt) so layouts
 *  (orbit tilts, rubik move tables) don't shimmer frame to frame. */
function hashNoise(seed: number, salt: number): number {
  const n = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Fibonacci sphere: even point distribution over the unit sphere. */
function fibSphere(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const rad = Math.sqrt(1 - y * y);
  const theta = i * golden;
  return [rad * Math.cos(theta), y, rad * Math.sin(theta)];
}

/** Wrapped angle delta in [-PI, PI]. */
function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** 3D yaw/pitch projector factory: returns point → [screenX, screenY, z]. */
function makeProjector(
  yaw: number,
  pitch: number,
  cx: number,
  cy: number,
  scale: number,
) {
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  return (x: number, y: number, z: number): [number, number, number] => {
    const rx = x * cosY + z * sinY;
    const rz = -x * sinY + z * cosY;
    const ry = y * cosP - rz * sinP;
    const rz2 = y * sinP + rz * cosP;
    return [cx + rx * scale, cy - ry * scale, rz2];
  };
}

/** Radius scaling so dot density feels constant across canvas sizes. */
function radiusScale(size: number, pow: number): number {
  return (size / 300) ** pow;
}

/** Shared draw pass: depth-sort back-to-front, skip near-invisible dots, then
 *  fill each as brand cobalt lerped TOWARD WHITE by its `white` depth factor
 *  (replaces the source's grayscale ink; alpha logic unchanged). */
function drawDots(
  ctx: CanvasRenderingContext2D,
  dots: OrbDot[],
  accent: RGB,
  rMin = 0.3,
) {
  dots.sort((a, b) => a.z - b.z);
  for (const d of dots) {
    const alpha = d.a ?? 1;
    if (alpha < 0.02) continue;
    const w = Math.min(1, Math.max(0, d.white));
    const r = Math.round(accent.r + (255 - accent.r) * w);
    const g = Math.round(accent.g + (255 - accent.g) * w);
    const b = Math.round(accent.b + (255 - accent.b) * w);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, Math.max(rMin, d.r), 0, Math.PI * 2);
    ctx.fill();
  }
}

/* --------------------------------------------------------- rubik helpers */

type RubikMove = { axis: number; lo: number; hi: number; ang: number };

/** Deterministic quarter-turn move table (seeded noise → axis, layer, dir). */
function rubikMoveTable(count: number): RubikMove[] {
  const moves: RubikMove[] = [];
  for (let i = 0; i < count; i++) {
    const axis = Math.min(2, Math.floor(hashNoise(i, 2.3) * 3));
    const lo = -1 + 0.5 * Math.min(3, Math.floor(hashNoise(i, 5.9) * 4));
    const dir = hashNoise(i, 7.7) < 0.5 ? 1 : -1;
    moves.push({ axis, lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
  }
  return moves;
}

/** Per-frame move amounts: eases each move in sequence, then unwinds them. */
function rubikMoveAmounts(
  t: number,
  count: number,
  step: number,
  pause: number,
): { amount: number[]; active: number } {
  const cycle = 2 * count * step + pause;
  const tt = t % cycle;
  const amount = new Array<number>(count).fill(0);
  let active = -1;
  if (tt < 2 * count * step) {
    const idx = Math.floor(tt / step);
    const frac = (tt - idx * step) / step;
    const eased = 1 - (1 - Math.min(1, frac / 0.7)) ** 3;
    if (idx < count) {
      for (let i = 0; i < idx; i++) amount[i] = 1;
      amount[idx] = eased;
      active = idx;
    } else {
      const back = 2 * count - 1 - idx;
      for (let i = 0; i < back; i++) amount[i] = 1;
      amount[back] = 1 - eased;
      active = back;
    }
  }
  return { amount, active };
}

/** Rotates a unit-sphere point through every active layer turn. Returns
 *  [x, y, z, onActiveLayer] — the flag brightens dots on the turning layer. */
function applyRubikMoves(
  p: [number, number, number],
  moves: RubikMove[],
  state: { amount: number[]; active: number },
): [number, number, number, boolean] {
  let [x, y, z] = p;
  let onActive = false;
  for (let i = 0; i < moves.length; i++) {
    if (state.amount[i] <= 0) continue;
    const m = moves[i];
    const c = m.axis === 0 ? x : m.axis === 1 ? y : z;
    if (c < m.lo || c >= m.hi) continue;
    if (i === state.active) onActive = true;
    const ang = m.ang * state.amount[i];
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    if (m.axis === 0) {
      const ny = y * cos - z * sin;
      z = y * sin + z * cos;
      y = ny;
    } else if (m.axis === 1) {
      const nx = x * cos + z * sin;
      z = -x * sin + z * cos;
      x = nx;
    } else {
      const nx = x * cos - y * sin;
      y = x * sin + y * cos;
      x = nx;
    }
  }
  return [x, y, z, onActive];
}

/* --------------------------------------------------------- morph helpers */

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Arc-length parameterised sampler over a closed polyline. */
function polylineSampler(points: [number, number][]): (u: number) => [number, number] {
  const n = points.length;
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(len);
    total += len;
  }
  return (u) => {
    let d = u * total;
    let i = 0;
    for (; d > segs[i] && i < n - 1; ) {
      d -= segs[i];
      i++;
    }
    const a = points[i];
    const b = points[(i + 1) % n];
    const f = segs[i] ? Math.min(1, d / segs[i]) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
}

const circleShape = (u: number): [number, number] => {
  const a = -Math.PI / 2 + u * 2 * Math.PI;
  return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
};
const triangleShape = polylineSampler([
  [0, -0.26],
  [0.24, 0.16],
  [-0.24, 0.16],
]);
const squareShape = polylineSampler([
  [0, -0.2],
  [0.2, -0.2],
  [0.2, 0.2],
  [-0.2, 0.2],
  [-0.2, -0.2],
]);
const MORPH_SHAPES = [circleShape, triangleShape, squareShape];

/** Hold per shape, then blend to the next (seconds, in orb-time). */
const MORPH_HOLD = 1.4;
const MORPH_BLEND = 0.9;
const MORPH_CYCLE = MORPH_HOLD + MORPH_BLEND;

const iconDotCount = (density: number) => Math.max(6, Math.round(34 * density));

/* -------------------------------------------------------------- renderers */

const renderGlobe: Renderer = (ctx, size, t, accent, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.82;
  const project = makeProjector(t * 0.5, 0.4 + 0.06 * Math.sin(t * 0.35), cx, cy, scale);
  const scan = t * (0.5 + (1.7 - 0.5) * (o.scanMul ?? 1));
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const dimBase = o.dimBase ?? 1;
  const latRings = o.latRings ?? 17;
  const lonDensity = o.lonDensity ?? 44;
  const dots: OrbDot[] = [];
  for (let i = 0; i <= latRings; i++) {
    const lat = -Math.PI / 2 + (i / latRings) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const ringCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
    for (let j = 0; j < ringCount; j++) {
      const lon = (j / ringCount) * 2 * Math.PI;
      const [x, y, z] = project(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
      const depth = (z + 1) / 2;
      const scanDelta = angleDelta(lon + t * 0.5, scan);
      const boost = Math.exp(-(scanDelta * scanDelta) / 0.18) * Math.max(0, z);
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (o.rBoost ?? 1) * boost) * rs,
        white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth,
        a: dimBase + (1 - dimBase) * Math.min(1, boost),
      });
    }
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const renderRubik: Renderer = (ctx, size, t, accent, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.82;
  const project = makeProjector(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, scale);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const moveCount = o.moveCount ?? 14;
  const moves = rubikMoveTable(moveCount);
  const moveState = rubikMoveAmounts(t, moveCount, 0.42, 1.2);
  const latRings = o.latRings ?? 15;
  const lonDensity = o.lonDensity ?? 40;
  const dots: OrbDot[] = [];
  for (let i = 0; i <= latRings; i++) {
    const lat = -Math.PI / 2 + (i / latRings) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const ringCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
    for (let j = 0; j < ringCount; j++) {
      const lon = (j / ringCount) * 2 * Math.PI;
      const [px, py, pz, onActive] = applyRubikMoves(
        [cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)],
        moves,
        moveState,
      );
      const [x, y, z] = project(px, py, pz);
      const depth = (z + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r:
          ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (onActive ? (o.rActive ?? 0.3) : 0)) * rs,
        white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth - (onActive ? 0.14 : 0),
      });
    }
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const renderWave: Renderer = (ctx, size, t, accent, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.874;
  const project = makeProjector(t * 0.18, 0.38, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const rings = o.rings ?? 15;
  const lonDensity = o.lonDensity ?? 40;
  const dots: OrbDot[] = [];
  for (let i = 0; i <= rings; i++) {
    const lat = -Math.PI / 2 + (i / rings) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const wobble = 0.62 * Math.sin(t * 2.1 - i * 0.52) + 0.38 * Math.sin(t * 1.27 + i * 0.83);
    const rad = scale * (0.88 + 0.105 * wobble);
    const ringCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
    for (let j = 0; j < ringCount; j++) {
      const lon = (j / ringCount) * 2 * Math.PI;
      const [x, y, z] = project(
        cosLat * Math.cos(lon) * rad,
        sinLat * rad,
        cosLat * Math.sin(lon) * rad,
      );
      const depth = (z / scale + 1) / 2;
      const crest = Math.max(0, wobble);
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth) * (1 + 0.4 * crest) * rs,
        white: 0.66 - 0.56 * depth - 0.1 * crest,
      });
    }
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const renderMorph: Renderer = (ctx, size, t, accent, o) => {
  const shapeCount = MORPH_SHAPES.length;
  const tt = t % (MORPH_CYCLE * shapeCount);
  const shapeIdx = Math.floor(tt / MORPH_CYCLE);
  const phase = tt - shapeIdx * MORPH_CYCLE;
  const blend = phase > MORPH_HOLD ? smoothstep((phase - MORPH_HOLD) / MORPH_BLEND) : 0;
  const spread = o.spread ?? 1;
  const from = MORPH_SHAPES[shapeIdx];
  const to = MORPH_SHAPES[(shapeIdx + 1) % shapeCount];
  const SAMPLES = 160;
  const outline: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / SAMPLES;
    const a = from(u);
    const b = to(u);
    outline.push([
      (a[0] + (b[0] - a[0]) * blend) * spread,
      (a[1] + (b[1] - a[1]) * blend) * spread,
    ]);
  }
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % SAMPLES];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(len);
    total += len;
  }
  const dotCount = iconDotCount(o.iconD ?? 1);
  const dotR = (o.rDot ?? 0.021) * 1.35 * spread;
  const breathe = 1 + 0.02 * Math.sin(phase * 3.1);
  const c = size / 2;
  const dots: OrbDot[] = [];
  let seg = 0;
  let acc = 0;
  for (let i = 0; i < dotCount; i++) {
    const target = (i / dotCount) * total;
    for (; acc + segs[seg] < target && seg < SAMPLES - 1; ) {
      acc += segs[seg];
      seg++;
    }
    const a = outline[seg];
    const b = outline[(seg + 1) % SAMPLES];
    const f = segs[seg] ? Math.min(1, (target - acc) / segs[seg]) : 0;
    const px = (a[0] + (b[0] - a[0]) * f) * breathe;
    const py = (a[1] + (b[1] - a[1]) * f) * breathe;
    dots.push({ x: c + px * size, y: c + py * size, z: 0, r: Math.max(0.35, dotR * size), white: 0.1 });
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const renderOrbits: Renderer = (ctx, size, t, accent, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.82;
  const project = makeProjector(t * 0.12, 0.3, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const orbitCount = o.orbitN ?? 12;
  const ghostCount = o.ghostN ?? 40;
  const particles = o.particles ?? 3;
  const dots: OrbDot[] = [];
  for (let i = 0; i < orbitCount; i++) {
    const n1 = hashNoise(i, 1.7);
    const n2 = hashNoise(i, 5.2);
    const n3 = hashNoise(i, 8.9);
    const rad = scale * (0.45 + 0.52 * n1);
    const theta = n1 * 2 * Math.PI;
    const phi = Math.acos(2 * n2 - 1);
    const sx = Math.sin(phi) * Math.cos(theta);
    const sy = Math.cos(phi);
    const sz = Math.sin(phi) * Math.sin(theta);
    // Orbit basis: u in the xy-plane perpendicular to the axis, v = axis × u.
    let ux = -sy;
    let uy = sx;
    const uz = 0;
    const un = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
    ux /= un;
    uy /= un;
    const vx = sy * uz - sz * uy;
    const vy = sz * ux - sx * uz;
    const vz = sx * uy - sy * ux;
    const spin = (0.25 + 0.55 * n3) * (n3 > 0.5 ? 1 : -1);
    for (let j = 0; j < ghostCount; j++) {
      const a = (j / ghostCount) * 2 * Math.PI;
      const [x, y, z] = project(
        (ux * Math.cos(a) + vx * Math.sin(a)) * rad,
        (uy * Math.cos(a) + vy * Math.sin(a)) * rad,
        (uz * Math.cos(a) + vz * Math.sin(a)) * rad,
      );
      const depth = (z / rad + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: (o.ghostR ?? 0.9) * rs,
        white: 0.72,
        a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * depth),
      });
    }
    for (let j = 0; j < particles; j++) {
      const a = t * spin + (j / particles) * 2 * Math.PI + n2 * 6;
      const [x, y, z] = project(
        (ux * Math.cos(a) + vx * Math.sin(a)) * rad,
        (uy * Math.cos(a) + vy * Math.sin(a)) * rad,
        (uz * Math.cos(a) + vz * Math.sin(a)) * rad,
      );
      const depth = (z / rad + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs,
        white: 0.3 - 0.22 * depth,
      });
    }
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const renderRibbon: Renderer = (ctx, size, t, accent, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.78;
  const spin = o.spin ?? 1;
  const project = makeProjector(t * 0.1 * spin, 0.3, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const dots: OrbDot[] = [];
  const ghostCount = o.ghostN ?? 150;
  for (let i = 0; i < ghostCount; i++) {
    const p = fibSphere(i, ghostCount);
    const [x, y, z] = project(p[0] * scale, p[1] * scale, p[2] * scale);
    const depth = (z / scale + 1) / 2;
    dots.push({ x, y, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
  }
  const ang = t * 0.24 * spin;
  const tilt = 0.55 + 0.3 * Math.sin(t * 0.18) * spin;
  const cw = Math.cos(ang);
  const sw = Math.sin(ang);
  // Ring basis: (cw, 0, sw) around Y, tilted by `tilt`, third = cross product.
  const ux = -sw * Math.sin(tilt);
  const uy = Math.cos(tilt);
  const uz = cw * Math.sin(tilt);
  const vx = -sw * uy;
  const vy = sw * ux - cw * uz;
  const vz = cw * uy;
  const lanes = o.lanes ?? 5;
  const segs = o.segs ?? 88;
  const bandCount = Math.max(1, Math.round(lanes * (o.bandMul ?? 1)));
  for (let lane = 0; lane < bandCount; lane++) {
    const offset = (lane - (bandCount - 1) / 2) * 0.075;
    const edge = Math.abs(lane - (bandCount - 1) / 2) / Math.max(1, (bandCount - 1) / 2);
    for (let s = 0; s < segs; s++) {
      const ae = (s / segs) * 2 * Math.PI;
      const wobble =
        (0.16 * Math.sin(ae * 3 - t * 1.7 + lane * 0.22) + 0.07 * Math.sin(ae * 5 + t * 1.1)) *
        (o.wobMul ?? 1);
      const yy = offset + wobble;
      const px = cw * Math.cos(ae) + ux * Math.sin(ae) + vx * yy;
      const py = uy * Math.sin(ae) + vy * yy;
      const pz = sw * Math.cos(ae) + uz * Math.sin(ae) + vz * yy;
      const len = Math.sqrt(px * px + py * py + pz * pz);
      const [x, y, z] = project((px / len) * scale, (py / len) * scale, (pz / len) * scale);
      const depth = (z / scale + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 1.1) + (o.rDepth ?? 1.7) * depth) * (1 - 0.25 * edge) * rs,
        white: 0.52 - 0.44 * depth + 0.18 * edge,
        a: 0.4 + 0.6 * depth,
      });
    }
  }
  drawDots(ctx, dots, accent, o.rMin);
};

const RENDERERS: Record<OrbMode, Renderer> = {
  orbits: renderOrbits,
  globe: renderGlobe,
  rubik: renderRubik,
  wave: renderWave,
  ribbon: renderRibbon,
  morph: renderMorph,
};

/* ------------------------------------------------------------ config tables */

const STATE_TO_MODE: Record<OrbState, OrbMode> = {
  working: "orbits",
  searching: "globe",
  solving: "rubik",
  listening: "wave",
  composing: "ribbon",
  shaping: "morph",
};

const BASE_OPTS: Record<OrbMode, OrbOpts> = {
  globe: { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
  orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3, partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 },
  rubik: { latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7, rActive: 0.3, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
  wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  morph: { rDot: 0.021, iconD: 1, rMin: 0.25 },
};

/** The source site only ships tuning for these two canvas sizes. */
const ORB_PRESETS = [20, 64] as const;
type OrbPreset = (typeof ORB_PRESETS)[number];

type SizeTuning = { speed: number; count: number; size: number; extra?: OrbOpts };

const SIZE_TUNING: Record<OrbMode, Record<OrbPreset, SizeTuning>> = {
  orbits: {
    64: { speed: 1.885, count: 1, size: 1 },
    20: { speed: 3.9, count: 0.238, size: 2.4 },
  },
  globe: {
    64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } },
  },
  rubik: {
    64: { speed: 1.82, count: 0.35, size: 1.05 },
    20: { speed: 1.95, count: 0.088, size: 1.9 },
  },
  wave: {
    64: { speed: 4.388, count: 0.341, size: 1 },
    20: { speed: 3.998, count: 0.105, size: 1.6 },
  },
  ribbon: {
    64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } },
  },
  morph: {
    64: { speed: 2.405, count: 0.54, size: 0.395, extra: { spread: 1.45 } },
    20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } },
  },
};

/** Snap any requested size to the nearest tuned preset — midpoint (42) and
 *  below resolve to 20, above to 64. The requested size is still honored via
 *  CSS scaling of the canvas element; only config + backing resolution snap. */
function snapPreset(size: number): OrbPreset {
  return Math.abs(size - ORB_PRESETS[0]) <= Math.abs(size - ORB_PRESETS[1])
    ? ORB_PRESETS[0]
    : ORB_PRESETS[1];
}

/** Density keys that scale with the AREA of the count factor (sqrt). */
const DENSITY_PAIRS: [string, string][] = [
  ["latRings", "lonDensity"],
  ["rings", "lonDensity"],
  ["lanes", "segs"],
];
/** Density keys that scale LINEARLY with the count factor. */
const DENSITY_LINEAR = ["orbitN", "ghostN"];
/** Density keys with a small floor (icon dot density). */
const DENSITY_FLOOR = ["iconD"];
/** Radius keys scaled by the size factor. */
const RADIUS_KEYS = ["rBase", "rDepth", "rActive", "rDot", "ghostR", "partR", "partRDepth"];

function scaleDensity(opts: OrbOpts, factor: number): OrbOpts {
  const out: OrbOpts = { ...opts };
  const done = new Set<string>();
  const area = Math.sqrt(factor);
  for (const [a, b] of DENSITY_PAIRS) {
    const va = out[a];
    const vb = out[b];
    if (va != null && vb != null && !done.has(a) && !done.has(b)) {
      out[a] = Math.max(2, Math.round(va * area));
      out[b] = Math.max(2, Math.round(vb * area));
      done.add(a);
      done.add(b);
    }
  }
  for (const k of DENSITY_LINEAR) {
    const v = out[k];
    if (v != null && !done.has(k)) out[k] = Math.max(1, Math.round(v * factor));
  }
  for (const k of DENSITY_FLOOR) {
    const v = out[k];
    if (v != null) out[k] = Math.max(0.02, v * factor);
  }
  return out;
}

function scaleRadius(opts: OrbOpts, factor: number): OrbOpts {
  const out: OrbOpts = { ...opts };
  for (const k of RADIUS_KEYS) {
    const v = out[k];
    if (v != null) out[k] = v * factor;
  }
  out.rSizeMul = (out.rSizeMul ?? 1) * factor;
  return out;
}

type ResolvedConfig = { mode: OrbMode; speed: number; opts: OrbOpts };

const configCache = new Map<string, ResolvedConfig>();

function resolveConfig(state: OrbState, preset: OrbPreset): ResolvedConfig {
  const key = `${state}-${preset}`;
  const hit = configCache.get(key);
  if (hit) return hit;
  const mode = STATE_TO_MODE[state];
  const tuning = SIZE_TUNING[mode][preset];
  let opts: OrbOpts = { ...BASE_OPTS[mode] };
  if (tuning.count !== 1) opts = scaleDensity(opts, tuning.count);
  if (tuning.size !== 1) opts = scaleRadius(opts, tuning.size);
  if (tuning.extra) opts = { ...opts, ...tuning.extra };
  const resolved: ResolvedConfig = { mode, speed: tuning.speed, opts };
  configCache.set(key, resolved);
  return resolved;
}

/* --------------------------------------------------------- theme + motion */

const FALLBACK_ACCENT: RGB = { r: 0x2f, g: 0x6b, b: 0xff }; // --ig-accent

function parseAccent(raw: string): RGB | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  return null;
}

function resolveAccent(): RGB {
  if (typeof getComputedStyle === "undefined") return FALLBACK_ACCENT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--ig-accent");
  return parseAccent(raw) ?? FALLBACK_ACCENT;
}

/** Brand cobalt from the --ig-accent token, parsed + cached once and
 *  re-resolved when [data-theme] flips on <html> (same MutationObserver
 *  pattern as the source site's theme hook) — high-contrast re-skins the orb. */
function useAccentColor(): RGB {
  const [accent, setAccent] = useState<RGB>(FALLBACK_ACCENT);
  useEffect(() => {
    const update = () => setAccent(resolveAccent());
    update();
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);
  return accent;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------- component */

const STATE_LABELS: Record<OrbState, string> = {
  working: "Working…",
  searching: "Searching…",
  solving: "Solving…",
  listening: "Listening…",
  composing: "Composing…",
  shaping: "Shaping…",
};

export type ThinkingOrbProps = {
  /** AI state; maps to one of the six dot-field modes (default "working"). */
  state?: OrbState;
  /** Requested CSS size in px (default 64). Internally snapped to the nearest
   *  tuned preset (20/64) for config + canvas resolution. */
  size?: number;
  /** Speed multiplier on top of the per-mode tuned speed (default 1). */
  speed?: number;
  /** Freeze on the current frame (one static frame is still drawn). */
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function ThinkingOrb({
  state = "working",
  size = 64,
  speed = 1,
  paused = false,
  className,
  style,
  "aria-label": ariaLabel,
}: ThinkingOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accent = useAccentColor();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preset = snapPreset(size);
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    canvas.width = Math.round(preset * dpr);
    canvas.height = Math.round(preset * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { mode, speed: baseSpeed, opts } = resolveConfig(state, preset);
    const render = RENDERERS[mode];
    const timeScale = baseSpeed * speed;
    const drawFrame = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, preset, preset);
      render(ctx, preset, t, accent, opts);
    };
    if (reducedMotion) {
      // Single static frame at the source site's frozen instant.
      drawFrame(0.6);
      return;
    }
    let rafId = 0;
    let running = false;
    const tick = () => {
      drawFrame((performance.now() / 1000) * timeScale);
      if (running) rafId = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || paused) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
    drawFrame((performance.now() / 1000) * timeScale);
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== "hidden") start();
            else stop();
          })
        : null;
    io?.observe(canvas);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!io) start();
    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state, size, accent, speed, paused, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className ? `ig-orb ${className}` : "ig-orb"}
      role="img"
      aria-label={ariaLabel ?? STATE_LABELS[state]}
      style={{ width: size, height: size, ...style }}
    />
  );
}
