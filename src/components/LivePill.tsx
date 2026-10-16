import React from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';
import { ease, useLoop } from '../motion';

/** "AO VIVO" badge with a radar-pulse dot. */
export default function LivePill({ label = 'ao vivo', color = colors.cyan, style }: { label?: string; color?: string; style?: StyleProp<ViewStyle> }) {
  const p = useLoop(1400, { yoyo: false, easing: ease.out3 });
  return (
    <View style={[styles.pill, { borderColor: color + '55' }, style]}>
      <View style={styles.dotBox}>
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: color,
              position: 'absolute',
              opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
            },
          ]}
        />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
    backgroundColor: 'rgba(10,6,23,0.55)',
  },
  dotBox: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
});
