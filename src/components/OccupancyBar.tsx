import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, OccLevel, occupancyTheme } from '../theme';
import { ease } from '../motion';

/** Thin gradient meter that fills to the live occupancy. */
export default function OccupancyBar({ pct, level, delay = 0, showLabel = true }: { pct: number; level: OccLevel; delay?: number; showLabel?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  const theme = occupancyTheme[level];
  useEffect(() => {
    Animated.timing(v, { toValue: pct, duration: 1300, delay, easing: ease.outExpo, useNativeDriver: false }).start();
  }, [pct, delay, v]);

  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
          <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: theme.color }]}>{pct}% · {theme.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.2 },
});
