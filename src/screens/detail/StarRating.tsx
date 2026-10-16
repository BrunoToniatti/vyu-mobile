import React, { useEffect, useMemo } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { ease, haptic, staggerDelays } from '../../motion';

/** Five stars; when editable each pick makes the lit stars pop in a stagger. */
export default function StarRating({ value, onChange, size = 18, gap = 2 }: {
  value: number; onChange?: (v: number) => void; size?: number; gap?: number;
}) {
  const pops = useMemo(() => [1, 2, 3, 4, 5].map(() => new Animated.Value(1)), []);

  useEffect(() => {
    if (!onChange || value === 0) return;
    const delays = staggerDelays(value, 45);
    pops.slice(0, value).forEach((v, i) => {
      v.setValue(0.4);
      Animated.timing(v, { toValue: 1, duration: 700, delay: delays[i], easing: ease.elastic, useNativeDriver: true }).start();
    });
  }, [value, onChange, pops]);

  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((s, i) => {
        const on = s <= value;
        const star = (
          <Animated.View style={{ transform: [{ scale: pops[i] }] }}>
            <MaterialIcons name={on ? 'star' : 'star-border'} size={size} color={on ? colors.gold : 'rgba(255,255,255,0.25)'} />
          </Animated.View>
        );
        return onChange ? (
          <Pressable key={s} hitSlop={4} onPress={() => { haptic.select(); onChange(s); }}>{star}</Pressable>
        ) : (
          <View key={s}>{star}</View>
        );
      })}
    </View>
  );
}
