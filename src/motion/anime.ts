import { Platform } from 'react-native';
import * as portable from './portable';

/**
 * Web runs the real anime.js. Native runs a pure-JS port of the same easing/spring/stagger
 * formulas (see portable.ts): anime.js cannot be imported in React Native 0.88, where `window`
 * is read-only and there is no `document`.
 */
const impl: typeof portable = Platform.OS === 'web' ? (require('animejs') as any) : portable;

export const animate = impl.animate;
export const createTimeline = impl.createTimeline;
export const eases = impl.eases;
export const spring = impl.spring;
export const stagger = impl.stagger;
export const utils = impl.utils;
