import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { ease, springTo, tween } from '../motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional element placed at the left of the title (e.g. a back button). */
  leading?: React.ReactNode;
};

/**
 * Bottom sheet rendered inside the screen (not a native Modal), so dialogs,
 * toasts and bursts mounted at the app root always appear above it.
 * Slides up on an anime.js spring and can be flicked down to dismiss.
 */
export default function Sheet({ visible, onClose, title, subtitle, children, leading }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const show = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      springTo(show, 1, { bounce: 0.22, duration: 560 }).start();
    } else if (mounted) {
      tween(show, 0, { duration: 260, easing: ease.in3 }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closeRef.current(); return true; });
    return () => sub.remove();
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.1) closeRef.current();
        else springTo(drag, 0, { bounce: 0.4, duration: 420 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: show }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.anchor}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: height * 0.9,
              paddingBottom: insets.bottom + 18,
              transform: [
                { translateY: Animated.add(show.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag) },
              ],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.grab}>
            <View style={styles.handle} />
            {(title || leading) && (
              <View style={styles.head}>
                {leading}
                <View style={{ flex: 1 }}>
                  {!!title && <Text style={styles.title}>{title}</Text>}
                  {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
                </View>
              </View>
            )}
          </View>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(6,3,16,0.7)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#130C2E',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.glassLineStrong,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grab: { paddingTop: 10, paddingHorizontal: 22 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: -0.6 },
  subtitle: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textSub, marginTop: 2 },
  body: { paddingHorizontal: 22, paddingTop: 12 },
});
