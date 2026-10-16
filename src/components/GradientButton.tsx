import React, { useState } from 'react';
import { ActivityIndicator, Animated, GestureResponderEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, fonts, gradients, shadow } from '../theme';
import { ease, useLoop } from '../motion';

type Variant = 'primary' | 'danger' | 'ghost' | 'light';

type Props = {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  iconRight?: React.ComponentProps<typeof MaterialIcons>['name'];
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  shine?: boolean;
};

/** Pill CTA with a gradient fill, a periodic light sweep and spring press. */
export default function GradientButton({
  title, onPress, icon, iconRight, loading, disabled, variant = 'primary', size = 'lg', style, shine = true,
}: Props) {
  const [w, setW] = useState(0);
  const sweep = useLoop(2600, { yoyo: false, delay: 900, easing: ease.inOut });
  const height = size === 'lg' ? 58 : size === 'md' ? 50 : 40;
  const filled = variant === 'primary' || variant === 'danger';
  const textColor = variant === 'light' ? colors.deep : colors.white;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      feedback="press"
      containerStyle={style}
      style={[
        styles.base,
        { height, borderRadius: height / 2 },
        filled && shadow(variant === 'danger' ? colors.danger : colors.purple, 0.55, 22, 12),
        variant === 'ghost' && styles.ghost,
        variant === 'light' && styles.light,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: height / 2, overflow: 'hidden' }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {filled && (
          <LinearGradient
            colors={variant === 'danger' ? gradients.danger : gradients.primary}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {filled && shine && w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sweep,
              {
                height: height * 2,
                top: -height / 2,
                transform: [
                  { translateX: sweep.interpolate({ inputRange: [0, 0.6, 1], outputRange: [-80, w + 40, w + 40] }) },
                  { rotate: '22deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        {filled && <View style={[StyleSheet.absoluteFill, styles.innerHighlight, { borderRadius: height / 2 }]} />}
      </View>

      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <MaterialIcons name={icon} size={size === 'sm' ? 18 : 21} color={textColor} />}
          <Text style={[styles.text, { color: textColor, fontSize: size === 'sm' ? 14 : 16 }]}>{title}</Text>
          {iconRight && <MaterialIcons name={iconRight} size={size === 'sm' ? 18 : 21} color={textColor} />}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ghost: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLineStrong },
  light: { backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontFamily: fonts.bodyBold, letterSpacing: 0.2 },
  sweep: { position: 'absolute', left: 0, width: 56 },
  innerHighlight: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
});
