import React, { useState } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ease, useLoop } from '../motion';

/** Placeholder block with a light beam sweeping across it. */
export default function Skeleton({ style, delay = 0 }: { style?: StyleProp<ViewStyle>; delay?: number }) {
  const [w, setW] = useState(0);
  const t = useLoop(1400, { yoyo: false, delay, easing: ease.inOutSine });
  return (
    <View style={[styles.base, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { width: w * 0.6, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.6, w] }) }] },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(143,84,254,0.18)', 'rgba(100,235,226,0.14)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' },
});
