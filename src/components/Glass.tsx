import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii } from '../theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  strong?: boolean;
};

/** Frosted panel: real blur on iOS/web, translucent tint elsewhere. */
export default function Glass({ children, style, intensity = 28, strong }: Props) {
  return (
    <View style={[styles.base, strong && styles.strong, style]}>
      {Platform.OS !== 'android' && (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: Platform.OS === 'android' ? 'rgba(33,24,74,0.72)' : colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  strong: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(33,24,74,0.9)' : 'rgba(33,24,74,0.55)',
    borderColor: colors.glassLineStrong,
  },
});
