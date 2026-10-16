import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme';
import { ease, haptic, utils } from '../motion';

type FireOptions = { x?: number; y?: number; count?: number; power?: number; palette?: string[]; quiet?: boolean };
type BurstApi = { fire: (o?: FireOptions) => void; fromEvent: (e: GestureResponderEvent, o?: Omit<FireOptions, 'x' | 'y'>) => void };

const BurstContext = createContext<BurstApi>({ fire: () => {}, fromEvent: () => {} });
export const useBurst = () => useContext(BurstContext);

const PALETTE = [colors.purple, colors.cyan, colors.violet, '#FFFFFF', colors.gold, '#FF7AD9'];

type Particle = {
  dx: number; peak: number; fall: number; rot: number; size: number;
  shape: 'dot' | 'bar' | 'ring'; color: string; duration: number; delay: number;
};
type BurstSpec = { id: number; x: number; y: number; particles: Particle[]; power: number };

function makeParticles(count: number, power: number, palette: string[]): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = utils.random(0, 360) * (Math.PI / 180);
    const dist = utils.random(70, 190) * power;
    const shapeRoll = utils.random(0, 9);
    return {
      dx: Math.cos(angle) * dist,
      peak: Math.sin(angle) * dist - utils.random(40, 110) * power,
      fall: Math.sin(angle) * dist + utils.random(120, 260) * power,
      rot: utils.random(-540, 540),
      size: utils.random(6, 11),
      shape: shapeRoll < 4 ? 'dot' : shapeRoll < 8 ? 'bar' : 'ring',
      color: palette[utils.random(0, palette.length - 1)],
      duration: utils.random(1000, 1600),
      delay: utils.random(0, 90),
    };
  });
}

function ParticleView({ p }: { p: Particle }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: p.duration, delay: p.delay, easing: ease.out3, useNativeDriver: true }).start();
  }, [p, t]);

  const shapeStyle =
    p.shape === 'dot' ? { width: p.size, height: p.size, borderRadius: p.size, backgroundColor: p.color }
    : p.shape === 'bar' ? { width: p.size * 0.55, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color }
    : { width: p.size + 2, height: p.size + 2, borderRadius: p.size, borderWidth: 2, borderColor: p.color };

  return (
    <Animated.View
      style={[
        styles.particle,
        shapeStyle,
        {
          opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.peak, p.fall] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
            { scale: t.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1.25, 1, 0.5] }) },
          ],
        },
      ]}
    />
  );
}

function Shockwave({ power }: { power: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 700, easing: ease.outExpo, useNativeDriver: true }).start();
  }, [t]);
  const size = 120 * power;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: size,
        borderWidth: 3, borderColor: colors.cyan,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.1, 2.2] }) }],
      }}
    />
  );
}

function Flash() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 450, easing: ease.out4, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: -40, top: -40, width: 80, height: 80, borderRadius: 80,
        backgroundColor: '#fff',
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }],
      }}
    />
  );
}

export function BurstProvider({ children }: { children: React.ReactNode }) {
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  const seq = useRef(0);
  const { width, height } = useWindowDimensions();

  const fire = useCallback((o: FireOptions = {}) => {
    const id = ++seq.current;
    const power = o.power ?? 1;
    const spec: BurstSpec = {
      id,
      x: o.x ?? width / 2,
      y: o.y ?? height * 0.42,
      power,
      particles: makeParticles(o.count ?? 42, power, o.palette ?? PALETTE),
    };
    if (!o.quiet) haptic.success();
    setBursts(prev => [...prev, spec]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1900);
  }, [width, height]);

  const api = useMemo<BurstApi>(() => ({
    fire,
    fromEvent: (e, o) => fire({ ...o, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }),
  }), [fire]);

  return (
    <BurstContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        {bursts.map(b => (
          <View key={b.id} style={{ position: 'absolute', left: b.x, top: b.y }}>
            <Flash />
            <Shockwave power={b.power} />
            {b.particles.map((p, i) => <ParticleView key={i} p={p} />)}
          </View>
        ))}
      </View>
    </BurstContext.Provider>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0 },
});
