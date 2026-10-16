import React, { useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { getAllCategories, saveUserPreferences, Category } from '../services/category';
import Aurora from '../components/Aurora';
import KineticText from '../components/KineticText';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import Glass from '../components/Glass';
import Skeleton from '../components/Skeleton';
import { useBurst } from '../components/Burst';
import { useUI } from '../components/Dialog';
import { colors, fonts, gradients } from '../theme';
import { ease, springTo, staggerDelays, tween, useEntrance } from '../motion';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Preferences'> };

function Chip({ label, selected, delay, onPress }: {
  label: string; selected: boolean; delay: number; onPress: (e: GestureResponderEvent) => void;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 800, delay, easing: ease.elastic, useNativeDriver: true }).start();
  }, [appear, delay]);

  useEffect(() => {
    tween(on, selected ? 1 : 0, { duration: 260, easing: ease.out3 }).start();
    if (selected) {
      pop.setValue(0.8);
      Animated.timing(pop, { toValue: 1, duration: 700, easing: ease.elastic, useNativeDriver: true }).start();
    }
  }, [selected, on, pop]);

  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale: Animated.multiply(appear, pop) }] }}>
      <PressableScale onPress={onPress} feedback="select" scaleTo={0.9} style={styles.chip}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: on }]}>
          <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {selected && <MaterialIcons name="check" size={16} color="#fff" />}
        <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
      </PressableScale>
    </Animated.View>
  );
}

export default function PreferencesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const burst = useBurst();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const counter = useRef(new Animated.Value(0)).current;
  const enter = useEntrance(2, { step: 100, delay: 250 });

  useEffect(() => {
    getAllCategories()
      .then(setCategories)
      .catch(() => ui.alert({ tone: 'danger', title: 'Ops', message: 'Não foi possível carregar as categorias.' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    counter.setValue(0.6);
    springTo(counter, 1, { bounce: 0.6, duration: 500 }).start();
  }, [selected.size, counter]);

  function toggle(id: number, e: GestureResponderEvent) {
    const adding = !selected.has(id);
    if (adding) burst.fromEvent(e, { count: 18, power: 0.45, quiet: true });
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveUserPreferences(Array.from(selected));
      await AsyncStorage.setItem('onboarding_done', 'true');
      burst.fire({ power: 1.3, count: 60 });
      setTimeout(() => navigation.replace('Main'), 450);
    } catch {
      ui.alert({ tone: 'danger', title: 'Não salvou', message: 'Não foi possível salvar suas preferências.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Main');
  }

  let chipIndex = 0;
  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  const chipDelays = staggerDelays(Math.max(totalItems, 1), 28, { start: 350 });

  return (
    <Aurora intensity="calm" sparkles={8}>
      <View style={{ flex: 1, paddingTop: insets.top + 18 }}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Animated.Text style={[styles.eyebrow, enter(0)]}>seus gostos</Animated.Text>
            <PressableScale onPress={handleSkip} feedback="select">
              <Text style={styles.skip}>Pular</Text>
            </PressableScale>
          </View>
          <KineticText text="Do que você curte?" highlight={[3]} style={styles.title} containerStyle={{ marginTop: 6 }} />
          <Animated.Text style={[styles.sub, enter(1)]}>Toque em tudo que combina com você. Sem limite.</Animated.Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 150 }]}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={{ gap: 26 }}>
              {[0, 1, 2].map(s => (
                <View key={s} style={{ gap: 12 }}>
                  <Skeleton style={{ width: 140, height: 18 }} delay={s * 120} />
                  <View style={styles.itemsWrap}>
                    {[90, 120, 70, 110, 84].map((w, i) => (
                      <Skeleton key={i} style={{ width: w, height: 42, borderRadius: 21 }} delay={s * 120 + i * 60} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {categories.map((cat, ci) => (
            <View key={cat.id} style={styles.catSection}>
              <View style={styles.catHead}>
                <Text style={styles.catIndex}>{String(ci + 1).padStart(2, '0')}</Text>
                <Text style={styles.catName}>{cat.name}</Text>
              </View>
              {cat.description ? <Text style={styles.catDesc}>{cat.description}</Text> : null}
              <View style={styles.itemsWrap}>
                {cat.items.map(item => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    selected={selected.has(item.id)}
                    delay={chipDelays[chipIndex++] ?? 0}
                    onPress={(e) => toggle(item.id, e)}
                  />
                ))}
              </View>
            </View>
          ))}

          {!loading && categories.length === 0 && (
            <View style={styles.empty}>
              <MaterialIcons name="category" size={40} color={colors.textHint} />
              <Text style={styles.emptyText}>Nenhuma categoria disponível ainda.</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footerWrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Glass strong style={styles.footer} intensity={50}>
            <View style={styles.countBox}>
              <Animated.Text style={[styles.countNum, { transform: [{ scale: counter }] }]}>{selected.size}</Animated.Text>
              <Text style={styles.countLabel}>{selected.size === 1 ? 'escolha' : 'escolhas'}</Text>
            </View>
            <GradientButton
              title="Salvar"
              iconRight="check"
              loading={saving}
              onPress={handleSave}
              size="md"
              style={{ flex: 1 }}
            />
          </Glass>
        </View>
      </View>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2.4, color: colors.cyan, textTransform: 'uppercase' },
  skip: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSub, padding: 6 },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.4, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSub, marginTop: 8 },
  scroll: { paddingHorizontal: 22, paddingTop: 20 },
  catSection: { marginBottom: 28 },
  catHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  catIndex: { fontFamily: fonts.display, fontSize: 13, color: colors.purple },
  catName: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.text, letterSpacing: -0.4 },
  catDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.textHint, marginTop: 4 },
  itemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 42, paddingHorizontal: 16, borderRadius: 21, overflow: 'hidden',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSub },
  chipTextOn: { color: '#fff' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textHint },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 10, paddingLeft: 20, borderRadius: 32 },
  countBox: { alignItems: 'center', minWidth: 54 },
  countNum: { fontFamily: fonts.display, fontSize: 26, color: colors.cyan, lineHeight: 28 },
  countLabel: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textHint, letterSpacing: 0.6, textTransform: 'uppercase' },
});
