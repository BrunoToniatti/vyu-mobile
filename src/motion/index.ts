import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { eases, spring, stagger } from './anime';

export { animate, createTimeline, utils } from './anime';

export type EaseFn = (t: number) => number;

/** anime.js curves, usable as `easing` for native-driven Animated timings. */
export const ease = {
  linear: eases.linear as EaseFn,
  out3: eases.out(3) as EaseFn,
  out4: eases.out(4) as EaseFn,
  outExpo: eases.outExpo as EaseFn,
  inOut: eases.inOut(2) as EaseFn,
  inOutSine: eases.inOutSine as EaseFn,
  in3: eases.in(3) as EaseFn,
  outBack: eases.outBack(1.7) as EaseFn,
  elastic: eases.outElastic(1, 0.55) as EaseFn,
  softElastic: eases.outElastic(0.8, 0.8) as EaseFn,
};

/** A spring solved by anime.js, expressed as a duration + easing pair. */
export function springCurve(bounce = 0.45, duration = 520): { duration: number; easing: EaseFn } {
  const s = spring({ bounce, duration });
  return { duration: s.settlingDuration, easing: s.ease as EaseFn };
}

type TweenOpts = { duration?: number; easing?: EaseFn; delay?: number; native?: boolean };

export function tween(value: Animated.Value, toValue: number, o: TweenOpts = {}) {
  return Animated.timing(value, {
    toValue,
    duration: o.duration ?? 650,
    easing: o.easing ?? ease.out4,
    delay: o.delay ?? 0,
    useNativeDriver: o.native ?? true,
  });
}

export function springTo(
  value: Animated.Value,
  toValue: number,
  o: { bounce?: number; duration?: number; delay?: number; native?: boolean } = {},
) {
  const s = springCurve(o.bounce, o.duration);
  return Animated.timing(value, {
    toValue,
    duration: s.duration,
    easing: s.easing,
    delay: o.delay ?? 0,
    useNativeDriver: o.native ?? true,
  });
}

/** Delays (ms) for `count` items using anime.js stagger (supports from: 'center' | 'last' | 'random' …). */
export function staggerDelays(
  count: number,
  step: number,
  params: { from?: 'first' | 'center' | 'last' | 'random' | number; start?: number } = {},
): number[] {
  const fn = stagger(step, { ...params, total: count });
  const targets = Array.from({ length: count }, () => ({}));
  return targets.map((t, i) => Number(fn(t, i, targets)));
}

/**
 * Staggered entrance for a fixed number of blocks. Returns a style factory.
 * Each block rises, un-scales and fades in on a native-driven anime.js curve.
 */
export function useEntrance(
  count: number,
  o: { step?: number; delay?: number; distance?: number; from?: 'first' | 'center' | 'last'; run?: boolean } = {},
) {
  const values = useMemo(() => Array.from({ length: count }, () => new Animated.Value(0)), [count]);
  const run = o.run ?? true;

  useEffect(() => {
    if (!run) return;
    const delays = staggerDelays(count, o.step ?? 70, { from: o.from, start: o.delay ?? 0 });
    const anims = values.map((v, i) => tween(v, 1, { duration: 900, delay: delays[i], easing: ease.out4 }));
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, count]);

  const distance = o.distance ?? 28;
  return (i: number) => {
    const v = values[Math.min(i, values.length - 1)];
    return {
      opacity: v,
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    };
  };
}

/** Endless 0→1→0 loop (native), handy for ambient float/pulse effects. */
export function useLoop(duration = 3000, o: { easing?: EaseFn; delay?: number; yoyo?: boolean } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const easing = o.easing ?? ease.inOutSine;
    const seq = o.yoyo === false
      ? Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, easing, useNativeDriver: true }),
        ]);
    const loop = Animated.loop(seq, { resetBeforeIteration: o.yoyo === false });
    const t = setTimeout(() => loop.start(), o.delay ?? 0);
    return () => { clearTimeout(t); loop.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** Tactile feedback; silently ignored where unsupported (web). */
export const haptic = {
  tap: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  press: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  heavy: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); },
  select: () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  error: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};

/** Horizontal shake (e.g. invalid form). */
export function shake(value: Animated.Value) {
  value.setValue(0);
  return Animated.timing(value, {
    toValue: 1,
    duration: 520,
    easing: ease.linear,
    useNativeDriver: true,
  });
}
export function shakeX(value: Animated.Value) {
  return value.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
    outputRange: [0, -14, 12, -9, 6, -3, 0],
  });
}
