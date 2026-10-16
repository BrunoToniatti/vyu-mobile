import React, { useEffect, useId, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { ease, springTo, tween, utils } from '../motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EYE = 'M4 24C10.5 13 17 9.5 24 9.5S37.5 13 44 24C37.5 35 31 38.5 24 38.5S10.5 35 4 24Z';
const EYE_LENGTH = 96;

type Props = { size?: number; alive?: boolean; delay?: number };

/** VYU mark: an eye that draws itself, blinks and glances around. */
export default function VyuLogo({ size = 56, alive = true, delay = 0 }: Props) {
  const gid = `vyu${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const draw = useRef(new Animated.Value(EYE_LENGTH)).current;
  const pupil = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(1)).current;
  const gazeX = useRef(new Animated.Value(0)).current;
  const gazeY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        tween(draw, 0, { duration: 1300, easing: ease.inOut, native: false }),
        springTo(pupil, 1, { bounce: 0.6, duration: 600, delay: 550 }),
      ]),
    ]).start();

    if (!alive) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const live = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (utils.random(0, 1) === 0) {
          Animated.sequence([
            tween(lid, 0.08, { duration: 120, easing: ease.in3 }),
            tween(lid, 1, { duration: 180, easing: ease.out3 }),
          ]).start();
        } else {
          const angle = utils.random(0, 360) * (Math.PI / 180);
          const reach = size * 0.07;
          Animated.parallel([
            springTo(gazeX, Math.cos(angle) * reach, { bounce: 0.3, duration: 500 }),
            springTo(gazeY, Math.sin(angle) * reach * 0.6, { bounce: 0.3, duration: 500 }),
          ]).start();
        }
        live();
      }, 1800 + utils.random(0, 2600));
    };
    live();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pupilSize = size * 0.34;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scaleY: lid }] }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id={gid} x1="4" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.purple} />
            <Stop offset="0.55" stopColor={colors.violet} />
            <Stop offset="1" stopColor={colors.cyan} />
          </LinearGradient>
        </Defs>
        <AnimatedPath
          d={EYE}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={3.4}
          strokeLinejoin="round"
          strokeDasharray={`${EYE_LENGTH}`}
          strokeDashoffset={draw}
        />
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View
          style={{
            width: pupilSize, height: pupilSize,
            transform: [{ translateX: gazeX }, { translateY: gazeY }, { scale: pupil }],
          }}
        >
          <Svg width={pupilSize} height={pupilSize} viewBox="0 0 20 20">
            <Defs>
              <LinearGradient id={`${gid}p`} x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.purple} />
                <Stop offset="1" stopColor={colors.cyan} />
              </LinearGradient>
            </Defs>
            <Circle cx="10" cy="10" r="10" fill={`url(#${gid}p)`} />
            <Circle cx="13" cy="7" r="3" fill="#fff" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
