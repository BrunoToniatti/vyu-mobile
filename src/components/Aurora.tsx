import React, { useId, useMemo } from 'react';
import { Animated, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';
import { ease, useLoop, utils } from '../motion';

const svgId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

function Orb({ size, color, left, top, dx, dy, duration, delay, opacity = 0.6 }: {
  size: number; color: string; left: number; top: number; dx: number; dy: number;
  duration: number; delay: number; opacity?: number;
}) {
  const id = svgId(`orb${useId()}`);
  const t = useLoop(duration, { delay });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left, top, width: size, height: size,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useLoop(1600 + delay % 900, { delay, easing: ease.inOutSine });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size,
        backgroundColor: '#fff',
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.85] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
      }}
    />
  );
}

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'calm' | 'vivid';
  grid?: boolean;
  sparkles?: number;
};

/** Living background: drifting purple / cyan / electric-blue light over the void. */
export default function Aurora({ children, style, intensity = 'vivid', grid = true, sparkles = 14 }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const gridId = svgId(`grid${useId()}`);
  const k = intensity === 'vivid' ? 1 : 0.6;

  const stars = useMemo(
    () => Array.from({ length: sparkles }, (_, i) => ({
      x: utils.random(0, W - 4),
      y: utils.random(0, H * 0.75),
      size: utils.random(2, 4),
      delay: i * 230,
    })),
    [W, H, sparkles],
  );

  return (
    <View style={[styles.root, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Orb size={W * 1.5} color={colors.purple} left={-W * 0.7} top={-W * 0.75} dx={W * 0.22} dy={W * 0.3} duration={9000} delay={0} opacity={0.75 * k} />
        <Orb size={W * 1.2} color={colors.blue} left={W * 0.35} top={H * 0.18} dx={-W * 0.3} dy={W * 0.2} duration={11000} delay={600} opacity={0.55 * k} />
        <Orb size={W * 1.3} color={colors.cyan} left={-W * 0.35} top={H * 0.62} dx={W * 0.25} dy={-W * 0.28} duration={12500} delay={1200} opacity={0.4 * k} />

        {grid && (
          <>
            <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
              <Defs>
                <Pattern id={gridId} width={36} height={36} patternUnits="userSpaceOnUse">
                  <Line x1="0" y1="0" x2="36" y2="0" stroke="#fff" strokeOpacity={0.05} strokeWidth={1} />
                  <Line x1="0" y1="0" x2="0" y2="36" stroke="#fff" strokeOpacity={0.05} strokeWidth={1} />
                </Pattern>
              </Defs>
              <Rect width={W} height={H} fill={`url(#${gridId})`} />
            </Svg>
            <LinearGradient
              colors={['rgba(10,6,23,0)', 'rgba(10,6,23,0.35)', colors.void]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}

        {stars.map((s, i) => <Sparkle key={i} {...s} />)}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void, overflow: 'hidden' },
});
