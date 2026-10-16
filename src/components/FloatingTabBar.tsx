import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Glass from './Glass';
import PressableScale from './PressableScale';
import { colors, fonts, gradients, shadow } from '../theme';
import { ease, haptic, springTo, useLoop } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ICONS: Record<string, IconName> = { Restaurants: 'home-filled', Map: 'explore', Profile: 'person' };
const LABELS: Record<string, string> = { Restaurants: 'Início', Map: 'Mapa', Profile: 'Perfil' };

function SideTab({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const on = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    springTo(on, focused ? 1 : 0, { bounce: 0.55, duration: 520 }).start();
  }, [focused, on]);
  return (
    <PressableScale containerStyle={styles.tab} style={styles.tabInner} onPress={onPress} feedback="none" scaleTo={0.85} accessibilityLabel={LABELS[name]} accessibilityState={{ selected: focused }}>
      <Animated.View style={{ transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { translateY: on.interpolate({ inputRange: [0, 1], outputRange: [5, -1] }) }] }}>
        <MaterialIcons name={ICONS[name]} size={24} color={focused ? colors.white : colors.textHint} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.label,
          { opacity: on, transform: [{ translateY: on.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
        ]}
      >
        {LABELS[name]}
      </Animated.Text>
    </PressableScale>
  );
}

function CenterOrb({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const pulse = useLoop(1800, { yoyo: false, easing: ease.out3 });
  const spin = useLoop(4000, { yoyo: false, easing: ease.linear });
  const on = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    springTo(on, focused ? 1 : 0, { bounce: 0.6, duration: 600 }).start();
  }, [focused, on]);

  return (
    <View style={styles.centerSlot} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbPulse,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
          },
        ]}
      />
      <PressableScale onPress={onPress} feedback="none" scaleTo={0.86} accessibilityLabel="Mapa" accessibilityState={{ selected: focused }} containerStyle={[styles.orbSlot, shadow(colors.purple, 0.7, 20, 8)]} style={styles.orb}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }, { scale: 1.4 }] }]}>
          <LinearGradient colors={[colors.cyan, colors.purple, colors.blue, colors.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.orbInner}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
          <Animated.View style={{ transform: [{ rotate: on.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }, { scale: on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
            <MaterialIcons name="explore" size={28} color="#fff" />
          </Animated.View>
        </View>
      </PressableScale>
    </View>
  );
}

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barW, setBarW] = useState(0);
  const bubble = useRef(new Animated.Value(state.index)).current;
  const stretch = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    springTo(bubble, state.index, { bounce: 0.38, duration: 560 }).start();
    stretch.setValue(1.35);
    springTo(stretch, 1, { bounce: 0.55, duration: 620 }).start();
  }, [state.index, bubble, stretch]);

  const slot = barW / Math.max(1, state.routes.length);
  const bubbleW = Math.max(0, slot - 18);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow('#000', 0.5, 24, 12)]}>
        <Glass strong intensity={60} style={[StyleSheet.absoluteFill, { borderRadius: 34 }]} />
          <View style={StyleSheet.absoluteFill} onLayout={e => setBarW(e.nativeEvent.layout.width)} pointerEvents="none">
            {barW > 0 && (
              <Animated.View
                style={[
                  styles.bubble,
                  {
                    width: bubbleW,
                    left: 9,
                    opacity: bubble.interpolate({
                      inputRange: state.routes.map((_, i) => i),
                      outputRange: state.routes.map((_, i) => (i === 1 ? 0 : 1)),
                    }),
                    transform: [
                      { translateX: bubble.interpolate({ inputRange: [0, Math.max(1, state.routes.length - 1)], outputRange: [0, slot * Math.max(1, state.routes.length - 1)] }) },
                      { scaleX: stretch },
                    ],
                  },
                ]}
              >
                <LinearGradient colors={['rgba(143,84,254,0.55)', 'rgba(100,235,226,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}
          </View>

          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic.select();
                navigation.navigate(route.name);
              }
            };
            if (index === 1) return <CenterOrb key={route.key} focused={focused} onPress={onPress} />;
            return <SideTab key={route.key} name={route.name} focused={focused} onPress={onPress} />;
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', width: '86%', maxWidth: 400, height: 68, borderRadius: 34 },
  bubble: { position: 'absolute', top: 8, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  tab: { flex: 1, height: '100%' },
  tabInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white, letterSpacing: 0.4, marginTop: 1 },
  centerSlot: { flex: 1, height: '100%', alignItems: 'center' },
  orbPulse: {
    position: 'absolute', top: -24, width: 66, height: 66, borderRadius: 33,
    borderWidth: 2, borderColor: colors.cyan,
  },
  orbSlot: { position: 'absolute', top: -24, width: 66, height: 66, borderRadius: 33 },
  orb: { width: 66, height: 66, borderRadius: 33, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  orbInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
