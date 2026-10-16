import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { ease, haptic, springTo, tween } from '../motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  feedback?: 'tap' | 'press' | 'select' | 'none';
};

/** Pressable that squishes on touch and springs back with an anime.js spring. */
export default function PressableScale({
  children, style, containerStyle, scaleTo = 0.95, feedback = 'tap', onPress, onPressIn, onPressOut, disabled, ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e) => {
        tween(scale, scaleTo, { duration: 140, easing: ease.out3 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        springTo(scale, 1, { bounce: 0.6, duration: 480 }).start();
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (feedback !== 'none') haptic[feedback]();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.5 } : null]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
