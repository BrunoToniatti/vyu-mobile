import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type Props = {
  items: string[];
  speed?: number;
  reverse?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  separator?: string;
};

/** Endless ticker band. Width is measured once, then a linear native loop slides it. */
export default function Marquee({ items, speed = 40, reverse, style, textStyle, separator = '  ✦  ' }: Props) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: (w / speed) * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [w, speed, x]);

  const line = items.join(separator) + separator;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-w, 0] : [0, -w] });

  return (
    <View style={[styles.band, style]}>
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
        <Text style={textStyle} numberOfLines={1} onLayout={e => setW(e.nativeEvent.layout.width)}>{line}</Text>
        <Text style={textStyle} numberOfLines={1}>{line}</Text>
        <Text style={textStyle} numberOfLines={1}>{line}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignSelf: 'flex-start' },
});
