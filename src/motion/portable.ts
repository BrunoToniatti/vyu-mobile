/**
 * Pure-JS port of the anime.js pieces the app uses (easings, spring, stagger, random, animate).
 * Used on native, where anime.js cannot be loaded: React Native 0.88 makes `window` read-only
 * and defines no `document`, so anime.js's browser detection crashes at import time.
 * The formulas are the same as anime.js v4, so motion looks identical.
 */
type EaseFn = (t: number) => number;
const PI2 = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const eases = {
  linear: ((t: number) => t) as EaseFn,
  in: (p = 1.675): EaseFn => (t) => Math.pow(t, p),
  out: (p = 1.675): EaseFn => (t) => 1 - Math.pow(1 - t, p),
  inOut: (p = 1.675): EaseFn => (t) => (t < 0.5 ? 0.5 * Math.pow(2 * t, p) : 1 - 0.5 * Math.pow(2 * (1 - t), p)),
  outExpo: ((t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))) as EaseFn,
  inOutSine: ((t: number) => -(Math.cos(Math.PI * t) - 1) / 2) as EaseFn,
  outBack: (overshoot = 1.7): EaseFn => (t) => 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2),
  outElastic: (amplitude = 1, period = 0.3): EaseFn => {
    const a = Math.max(1, amplitude);
    const p = clamp(period, 0, 2);
    const s = (p / PI2) * Math.asin(1 / a);
    return (t) => (t === 0 || t === 1 ? t : a * Math.pow(2, -10 * t) * Math.sin(((t - s) * PI2) / p) + 1);
  },
};

/** Damped spring: `duration` is the perceived duration (ms), `bounce` 0..1 the amount of overshoot. */
export function spring({ bounce = 0.5, duration = 628 }: { bounce?: number; duration?: number } = {}) {
  const zeta = clamp(1 - bounce, 0.05, 1);
  const wd = Math.PI / (Math.max(duration, 50) / 1000); // first peak ≈ perceived duration
  const wn = zeta < 1 ? wd / Math.sqrt(1 - zeta * zeta) : wd;
  const settlingDuration = Math.round(clamp((Math.log(1 / 0.006) / (zeta * wn)) * 1000, duration, 4000));
  const at = (sec: number) => {
    if (zeta >= 1) return 1 - Math.exp(-wn * sec) * (1 + wn * sec);
    return 1 - Math.exp(-zeta * wn * sec) * (Math.cos(wd * sec) + ((zeta * wn) / wd) * Math.sin(wd * sec));
  };
  const ease: EaseFn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : at((t * settlingDuration) / 1000));
  return { ease, settlingDuration };
}

type From = 'first' | 'center' | 'last' | 'random' | number;

export function stagger(step: number, params: { from?: From; start?: number; total?: number } = {}) {
  const { from = 'first', start = 0 } = params;
  return (_target: unknown, i: number, targets: unknown[]) => {
    const total = params.total ?? targets.length;
    const origin =
      from === 'first' ? 0
      : from === 'last' ? total - 1
      : from === 'center' ? (total - 1) / 2
      : from === 'random' ? Math.floor(Math.random() * total)
      : from;
    return start + Math.abs(i - origin) * step;
  };
}

export const utils = {
  random(min: number, max: number, decimals = 0) {
    const v = Math.random() * (max - min) + min;
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  },
};

const NAMED: Record<string, EaseFn> = {
  linear: eases.linear, outExpo: eases.outExpo, inOutSine: eases.inOutSine, outQuad: eases.out(2), outCubic: eases.out(3),
};

type AnimateParams = {
  duration?: number;
  delay?: number;
  ease?: string | EaseFn;
  onUpdate?: () => void;
  onComplete?: () => void;
  [prop: string]: any;
};

const RESERVED = new Set(['duration', 'delay', 'ease', 'onUpdate', 'onComplete']);

/** Tweens numeric properties of a plain object on requestAnimationFrame. */
export function animate(target: Record<string, any>, params: AnimateParams) {
  const { duration = 1000, delay = 0, onUpdate, onComplete } = params;
  const ease: EaseFn = typeof params.ease === 'function' ? params.ease : NAMED[params.ease as string] ?? eases.out(3);
  const from: Record<string, number> = {};
  const to: Record<string, number> = {};
  for (const key of Object.keys(params)) {
    if (RESERVED.has(key)) continue;
    from[key] = Number(target[key]) || 0;
    to[key] = Number(params[key]);
  }

  let raf: ReturnType<typeof requestAnimationFrame> | null = null;
  let startAt = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    if (!startAt) startAt = now + delay;
    const t = clamp((now - startAt) / duration, 0, 1);
    if (now >= startAt) {
      const k = ease(t);
      for (const key of Object.keys(to)) target[key] = from[key] + (to[key] - from[key]) * k;
      onUpdate?.();
    }
    if (t >= 1) { onComplete?.(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pause() { stopped = true; if (raf !== null) cancelAnimationFrame(raf); },
  };
}

export function createTimeline() {
  throw new Error('createTimeline is not available on native');
}
