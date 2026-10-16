import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import Aurora from '../components/Aurora';
import KineticText from '../components/KineticText';
import GradientButton from '../components/GradientButton';
import VyuLogo from '../components/VyuLogo';
import { useBurst } from '../components/Burst';
import { colors, fonts, gradients } from '../theme';
import { ease, staggerDelays, useEntrance, useLoop } from '../motion';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Onboarding'> };
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ORBIT: { icon: IconName; color: string }[] = [
  { icon: 'local-pizza', color: colors.warning },
  { icon: 'ramen-dining', color: colors.cyan },
  { icon: 'local-bar', color: '#FF7AD9' },
  { icon: 'icecream', color: colors.gold },
  { icon: 'set-meal', color: colors.cyan },
  { icon: 'coffee', color: colors.warning },
  { icon: 'lunch-dining', color: colors.purple },
  { icon: 'wine-bar', color: '#FF7AD9' },
];

/** Food icons orbiting the VYU eye on two counter-rotating rings. */
function Orbit({ size }: { size: number }) {
  const spin = useLoop(26000, { yoyo: false, easing: ease.linear });
  const breathe = useLoop(2600);
  const pops = useMemo(() => ORBIT.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    const delays = staggerDelays(ORBIT.length, 90, { from: 'center', start: 500 });
    Animated.parallel(
      pops.map((v, i) => Animated.timing(v, { toValue: 1, duration: 1000, delay: delays[i], easing: ease.elastic, useNativeDriver: true })),
    ).start();
  }, [pops]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const r = size / 2 - 28;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.ring, { width: size - 56, height: size - 56, borderRadius: size }]} />
      <View style={[styles.ring, { width: size * 0.56, height: size * 0.56, borderRadius: size, borderStyle: 'dashed' }]} />

      <Animated.View
        style={[
          styles.core,
          {
            transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] }),
          },
        ]}
      >
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.coreInner}>
        <VyuLogo size={66} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        {ORBIT.map((o, i) => {
          const a = (i / ORBIT.length) * Math.PI * 2;
          return (
            <Animated.View
              key={o.icon}
              style={[
                styles.planet,
                {
                  left: size / 2 + Math.cos(a) * r - 24,
                  top: size / 2 + Math.sin(a) * r - 24,
                  transform: [{ rotate: counter }, { scale: pops[i] }],
                },
              ]}
            >
              <MaterialIcons name={o.icon} size={22} color={o.color} />
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const burst = useBurst();
  const enter = useEntrance(3, { step: 110, delay: 900 });

  async function handleYes() {
    burst.fire({ power: 1.2 });
    setTimeout(() => navigation.replace('Preferences'), 380);
  }

  async function handleNo() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Main');
  }

  return (
    <Aurora intensity="vivid" sparkles={20}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.visual}>
          <Orbit size={Math.min(width - 40, 340)} />
        </View>

        <View>
          <Animated.Text style={[styles.eyebrow, enter(0)]}>passo extra · 20 segundos</Animated.Text>
          <KineticText
            text="Podemos te conhecer melhor?"
            highlight={[3]}
            delay={300}
            style={styles.title}
            containerStyle={{ marginTop: 10 }}
          />
          <Animated.Text style={[styles.subtitle, enter(1)]}>
            Conte seus gostos e a gente coloca no topo os restaurantes que combinam com você.
          </Animated.Text>

          <Animated.View style={[styles.buttons, enter(2)]}>
            <GradientButton title="Sim, quero personalizar!" icon="auto-awesome" onPress={handleYes} />
            <GradientButton title="Talvez mais tarde" variant="ghost" onPress={handleNo} />
          </Animated.View>
        </View>
      </View>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', maxWidth: 520, width: '100%', alignSelf: 'center' },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  core: { position: 'absolute', width: 120, height: 120, borderRadius: 60, overflow: 'hidden' },
  coreInner: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.void,
    alignItems: 'center', justifyContent: 'center',
  },
  planet: {
    position: 'absolute', width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(33,24,74,0.85)', borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2.4, color: colors.cyan, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.5, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSub, marginTop: 12 },
  buttons: { gap: 12, marginTop: 28 },
});
