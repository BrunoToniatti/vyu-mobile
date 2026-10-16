import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { animate } from '../motion';

type Props = {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  style?: StyleProp<TextStyle>;
};

/** Number that rolls up to its value, driven by anime.js (outExpo). */
export default function CountUp({ value, duration = 1400, delay = 0, decimals = 0, suffix = '', prefix = '', style }: Props) {
  const [shown, setShown] = useState(0);
  const state = useRef({ v: 0 });

  useEffect(() => {
    const a = animate(state.current, {
      v: value,
      duration,
      delay,
      ease: 'outExpo',
      onUpdate: () => setShown(state.current.v),
    });
    return () => { a.pause(); };
  }, [value, duration, delay]);

  return (
    <Text style={style}>
      {prefix}{shown.toFixed(decimals).replace('.', ',')}{suffix}
    </Text>
  );
}
