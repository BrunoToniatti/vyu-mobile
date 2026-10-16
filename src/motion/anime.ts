import { Platform } from 'react-native';
import type * as AnimeJS from 'animejs';

/**
 * React Native defines `window` but has no DOM, which makes anime.js take its
 * browser path and touch `document`/`NodeList` (crash). Hiding `window` while the
 * module initialises puts anime.js on its pure-JS path; pointing `setImmediate` at
 * `requestAnimationFrame` meanwhile makes its engine tick once per frame and idle
 * when nothing is animating. Both globals are restored right after.
 */
function loadAnime(): typeof AnimeJS {
  if (Platform.OS === 'web') return require('animejs');
  const g = globalThis as any;
  const saved = { window: g.window, setImmediate: g.setImmediate, clearImmediate: g.clearImmediate };
  g.window = undefined;
  g.setImmediate = g.requestAnimationFrame;
  g.clearImmediate = g.cancelAnimationFrame;
  try {
    return require('animejs');
  } finally {
    g.window = saved.window;
    g.setImmediate = saved.setImmediate;
    g.clearImmediate = saved.clearImmediate;
  }
}

const anime = loadAnime();

export const { animate, createTimeline, eases, spring, stagger, utils } = anime;
export type { JSAnimation, Timeline } from 'animejs';
