import React, { useEffect, useMemo } from 'react';
import { Animated, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { ease, staggerDelays } from '../motion';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Words (by index) painted with the accent colour. */
  highlight?: number[];
  accent?: string;
  delay?: number;
  step?: number;
  from?: 'first' | 'center' | 'last';
};

/** Headline whose words fly up out of a mask with an elastic anime.js curve. */
export default function KineticText({
  text, style, containerStyle, highlight = [], accent = '#64EBE2', delay = 0, step = 70, from = 'first',
}: Props) {
  const words = useMemo(() => text.split(' ').filter(Boolean), [text]);
  const values = useMemo(() => words.map(() => new Animated.Value(0)), [words]);

  useEffect(() => {
    const delays = staggerDelays(words.length, step, { from, start: delay });
    const anims = values.map((v, i) =>
      Animated.timing(v, { toValue: 1, duration: 1100, delay: delays[i], easing: ease.softElastic, useNativeDriver: true }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, [values, words.length, step, from, delay]);

  return (
    <View style={[styles.row, containerStyle]}>
      {words.map((w, i) => (
        <View key={`${w}-${i}`} style={styles.mask}>
          <Animated.Text
            style={[
              style,
              highlight.includes(i) && { color: accent },
              {
                opacity: values[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: values[i].interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) },
                  { rotate: values[i].interpolate({ inputRange: [0, 1], outputRange: ['8deg', '0deg'] }) },
                ],
              },
            ]}
          >
            {w}{i < words.length - 1 ? ' ' : ''}
          </Animated.Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  mask: { overflow: 'hidden', paddingBottom: 2 },
});
