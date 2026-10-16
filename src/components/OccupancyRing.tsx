import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import CountUp from './CountUp';
import { colors, fonts, occupancyTheme, OccLevel } from '../theme';
import { ease, useLoop } from '../motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  pct: number;
  level: OccLevel;
  size?: number;
  stroke?: number;
  delay?: number;
  caption?: string;
  live?: boolean;
};

let gid = 0;

/** Gradient arc that sweeps to the occupancy value with a pulsing halo. */
export default function OccupancyRing({ pct, level, size = 120, stroke = 10, delay = 200, caption, live = true }: Props) {
  const id = useMemo(() => `occ${++gid}`, []);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useLoop(1600, { yoyo: false, easing: ease.out3 });
  const theme = occupancyTheme[level];

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(100, pct)) / 100,
      duration: 1500,
      delay,
      easing: ease.outExpo,
      useNativeDriver: false,
    }).start();
  }, [pct, delay, progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {live && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size,
              borderWidth: 2,
              borderColor: theme.color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.25] }) }],
            },
          ]}
        />
      )}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.gradient[0]} />
            <Stop offset="1" stopColor={theme.gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [c, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <CountUp value={pct} delay={delay} suffix="%" style={[styles.value, { fontSize: size * 0.24 }]} />
        {!!caption && <Text style={[styles.caption, { color: theme.color }]}>{caption}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { fontFamily: fonts.display, color: colors.text, letterSpacing: -1 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: -2 },
});
