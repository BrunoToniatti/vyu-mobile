import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Glass from './Glass';
import GradientButton from './GradientButton';
import PressableScale from './PressableScale';
import { useBurst } from './Burst';
import { colors, fonts, gradients } from '../theme';
import { ease, haptic, springTo, tween } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type Tone = 'primary' | 'success' | 'danger';
type Option = { key: string; label: string; icon?: IconName; destructive?: boolean };

type Base = { title: string; message?: string; icon?: IconName; tone?: Tone };
type Request = { id: number } & (
  | (Base & { kind: 'alert'; confirmText?: string; resolve: () => void })
  | (Base & { kind: 'confirm'; confirmText?: string; cancelText?: string; resolve: (v: boolean) => void })
  | (Base & { kind: 'choose'; options: Option[]; cancelText?: string; resolve: (v: string | null) => void })
);

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
type ToastTone = 'success' | 'error' | 'info';

type UiApi = {
  alert: (o: Base & { confirmText?: string }) => Promise<void>;
  confirm: (o: Base & { confirmText?: string; cancelText?: string }) => Promise<boolean>;
  choose: (o: Base & { options: Option[]; cancelText?: string }) => Promise<string | null>;
  toast: (message: string, tone?: ToastTone) => void;
};

const UiContext = createContext<UiApi | null>(null);
export function useUI(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUI must be used inside <DialogProvider>');
  return ctx;
}

const toneGradient: Record<Tone, readonly [string, string, ...string[]]> = {
  primary: gradients.primary,
  success: ['#64EBE2', '#8F54FE'],
  danger: gradients.danger,
};
const toneIcon: Record<Tone, IconName> = { primary: 'auto-awesome', success: 'celebration', danger: 'error-outline' };

function DialogCard({ req, onDone }: { req: Request; onDone: () => void }) {
  const { height } = useWindowDimensions();
  const burst = useBurst();
  const backdrop = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const icon = useRef(new Animated.Value(0)).current;
  const tone = req.tone ?? 'primary';
  const closing = useRef(false);

  useEffect(() => {
    tween(backdrop, 1, { duration: 260 }).start();
    springTo(pop, 1, { bounce: 0.42, duration: 560 }).start();
    Animated.timing(icon, { toValue: 1, duration: 900, delay: 120, easing: ease.elastic, useNativeDriver: true }).start();
    if (tone === 'success') setTimeout(() => burst.fire({ y: height * 0.36, power: 1.15 }), 160);
    else if (tone === 'danger') haptic.error();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback((settle: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      tween(backdrop, 0, { duration: 200, easing: ease.in3 }),
      tween(pop, 0, { duration: 200, easing: ease.in3 }),
    ]).start(() => { settle(); onDone(); });
  }, [backdrop, pop, onDone]);

  const cancel = useCallback(() => {
    close(() => {
      if (req.kind === 'alert') req.resolve();
      else if (req.kind === 'confirm') req.resolve(false);
      else req.resolve(null);
    });
  }, [close, req]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { cancel(); return true; });
    return () => sub.remove();
  }, [cancel]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: pop,
              transform: [
                { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
              ],
            },
          ]}
        >
          <Glass strong style={styles.card} intensity={50}>
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  transform: [
                    { scale: icon },
                    { rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) },
                  ],
                },
              ]}
            >
              <LinearGradient colors={toneGradient[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBg}>
                <MaterialIcons name={req.icon ?? toneIcon[tone]} size={30} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.title}>{req.title}</Text>
            {!!req.message && <Text style={styles.message}>{req.message}</Text>}

            {req.kind === 'choose' ? (
              <View style={styles.options}>
                {req.options.map(o => (
                  <PressableScale
                    key={o.key}
                    style={styles.option}
                    feedback="select"
                    onPress={() => close(() => req.resolve(o.key))}
                  >
                    {o.icon && (
                      <View style={[styles.optionIcon, o.destructive && styles.optionIconDanger]}>
                        <MaterialIcons name={o.icon} size={20} color={o.destructive ? colors.danger : colors.cyan} />
                      </View>
                    )}
                    <Text style={[styles.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textHint} />
                  </PressableScale>
                ))}
                <GradientButton title={req.cancelText ?? 'Cancelar'} variant="ghost" size="md" onPress={cancel} style={{ marginTop: 6 }} />
              </View>
            ) : (
              <View style={styles.actions}>
                {req.kind === 'confirm' && (
                  <GradientButton
                    title={req.cancelText ?? 'Cancelar'}
                    variant="ghost"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={cancel}
                  />
                )}
                <GradientButton
                  title={req.confirmText ?? (req.kind === 'confirm' ? 'Confirmar' : 'Entendi')}
                  variant={tone === 'danger' && req.kind === 'confirm' ? 'danger' : 'primary'}
                  size="md"
                  shine={false}
                  style={{ flex: 1 }}
                  onPress={() => close(() => {
                    if (req.kind === 'confirm') req.resolve(true);
                    else if (req.kind === 'alert') req.resolve();
                  })}
                />
              </View>
            )}
          </Glass>
        </Animated.View>
      </View>
    </View>
  );
}

function Toast({ message, tone, onDone }: { message: string; tone: ToastTone; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (tone === 'error') haptic.error(); else haptic.tap();
    Animated.sequence([
      springTo(t, 1, { bounce: 0.5, duration: 520 }),
      Animated.delay(2400),
      tween(t, 0, { duration: 260, easing: ease.in3 }),
    ]).start(onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const icon: IconName = tone === 'success' ? 'check-circle' : tone === 'error' ? 'error-outline' : 'info-outline';
  const color = tone === 'success' ? colors.cyan : tone === 'error' ? colors.danger : colors.purple;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        {
          top: insets.top + 10,
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          ],
        },
      ]}
    >
      <Glass strong style={styles.toast} intensity={60}>
        <MaterialIcons name={icon} size={20} color={color} />
        <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
      </Glass>
    </Animated.View>
  );
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([]);
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const toastSeq = useRef(0);

  const seq = useRef(0);
  const push = useCallback((r: DistributiveOmit<Request, 'id'>) => setQueue(q => [...q, { ...r, id: ++seq.current } as Request]), []);

  const api = useMemo<UiApi>(() => ({
    alert: (o) => new Promise<void>(resolve => push({ ...o, kind: 'alert', resolve })),
    confirm: (o) => new Promise<boolean>(resolve => push({ ...o, kind: 'confirm', resolve })),
    choose: (o) => new Promise<string | null>(resolve => push({ ...o, kind: 'choose', resolve })),
    toast: (message, tone = 'info') => setToast({ id: ++toastSeq.current, message, tone }),
  }), [push]);

  const current = queue[0];
  return (
    <UiContext.Provider value={api}>
      {children}
      {current && (
        <DialogCard key={current.id} req={current} onDone={() => setQueue(q => q.slice(1))} />
      )}
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </UiContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(6,3,16,0.72)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardWrap: { width: '100%', maxWidth: 400 },
  card: { padding: 24, paddingTop: 28, alignItems: 'center', borderRadius: 30 },
  iconWrap: { marginBottom: 16 },
  iconBg: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSub, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  options: { alignSelf: 'stretch', marginTop: 18, gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(100,235,226,0.12)',
  },
  optionIconDanger: { backgroundColor: 'rgba(255,92,122,0.14)' },
  optionText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, maxWidth: 420 },
  toastText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
});
