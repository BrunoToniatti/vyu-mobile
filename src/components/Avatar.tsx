import React from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, initialsOf } from '../theme';
import { ease, useLoop } from '../motion';

type Props = {
  name?: string;
  photo?: string | null;
  size?: number;
  ring?: number;
  spin?: boolean;
  loading?: boolean;
};

/** Photo or initials inside a rotating gradient halo. */
export default function Avatar({ name, photo, size = 44, ring = 2.5, spin = true, loading }: Props) {
  const t = useLoop(5000, { yoyo: false, easing: ease.linear });
  const inner = size - ring * 2;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: spin ? t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '0deg' }, { scale: 1.3 }] },
        ]}
      >
        <LinearGradient colors={[...gradients.primary, colors.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <ActivityIndicator color={colors.cyan} />
        ) : photo ? (
          <Image source={{ uri: photo }} style={{ width: inner, height: inner }} />
        ) : (
          <Text style={[styles.initials, { fontSize: inner * 0.38 }]}>{initialsOf(name)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { fontFamily: fonts.display, color: colors.text, letterSpacing: -0.5 },
});
