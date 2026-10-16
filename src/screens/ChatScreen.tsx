import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { ChatMessage, UserApp } from '../types';
import { getChatMessages, sendChatMessage } from '../services/chat';
import { getStoredUser } from '../services/auth';
import Aurora from '../components/Aurora';
import Glass from '../components/Glass';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import KineticText from '../components/KineticText';
import Skeleton from '../components/Skeleton';
import { useUI } from '../components/Dialog';
import { colors, fonts, gradients, initialsOf } from '../theme';
import { ease, haptic, springTo, tween, useLoop } from '../motion';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
};

const POLL_INTERVAL = 4000;

function useCountdown(targetIso: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  useEffect(() => {
    if (!targetIso) return;
    function tick() {
      setSecondsLeft(Math.max(0, Math.floor((new Date(targetIso!).getTime() - Date.now()) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return { secondsLeft, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` };
}

function Bubble({ item, mine, fromRestaurant, restaurantName, restaurantPhoto, animate, delay }: {
  item: ChatMessage; mine: boolean; fromRestaurant: boolean; restaurantName: string; restaurantPhoto?: string | null;
  animate: boolean; delay: number;
}) {
  const t = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (animate) springTo(t, 1, { bounce: 0.45, duration: 560, delay }).start();
  }, [animate, delay, t]);

  const time = new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const name = fromRestaurant ? restaurantName : item.sender_name;

  return (
    <Animated.View
      style={[
        styles.row,
        mine && styles.rowMine,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [mine ? 30 : -30, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          ],
        },
      ]}
    >
      {!mine && (
        <View style={[styles.avatar, fromRestaurant && styles.avatarHouse]}>
          {fromRestaurant ? (
            restaurantPhoto ? <Image source={{ uri: restaurantPhoto }} style={styles.avatarImg} /> : <MaterialIcons name="storefront" size={16} color={colors.void} />
          ) : item.sender_photo ? (
            <Image source={{ uri: item.sender_photo }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(item.sender_name)}</Text>
          )}
        </View>
      )}

      {mine ? (
        <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
          <Text style={[styles.text, { color: '#fff' }]}>{item.text}</Text>
          <Text style={[styles.time, { color: 'rgba(255,255,255,0.75)' }]}>{time}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleOther, fromRestaurant && styles.bubbleHouse]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, fromRestaurant && { color: colors.cyan }]} numberOfLines={1}>{name}</Text>
            {fromRestaurant && (
              <View style={styles.houseBadge}>
                <Text style={styles.houseBadgeText}>casa</Text>
              </View>
            )}
          </View>
          <Text style={styles.text}>{item.text}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function ChatScreen({ navigation, route }: Props) {
  const { restaurant } = route.params;
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextResetAt, setNextResetAt] = useState<string | null>(null);
  const [me, setMe] = useState<UserApp | null>(null);
  const lastIdRef = useRef<number | undefined>(undefined);
  const sentIds = useRef<Set<number>>(new Set());
  const initialIds = useRef<Set<number>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const plane = useRef(new Animated.Value(0)).current;
  const float = useLoop(2400);
  const { secondsLeft, label: countdownLabel } = useCountdown(nextResetAt);

  useEffect(() => { getStoredUser().then(setMe).catch(() => {}); }, []);

  const loadInitial = useCallback(async () => {
    try {
      const res = await getChatMessages(restaurant.id);
      initialIds.current = new Set(res.messages.slice(0, Math.max(0, res.messages.length - 8)).map(m => m.id));
      setMessages(res.messages);
      if (res.messages.length > 0) lastIdRef.current = res.messages[res.messages.length - 1].id;
      if (res.nextResetAt) setNextResetAt(res.nextResetAt);
    } catch {
      // empty state covers it
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

  // When countdown hits 0, trigger a full reload
  const prevSecondsRef = useRef(secondsLeft);
  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0 && !loading) {
      lastIdRef.current = undefined;
      loadInitial();
    }
    prevSecondsRef.current = secondsLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const poll = useCallback(async () => {
    try {
      const res = await getChatMessages(restaurant.id, lastIdRef.current);
      if (res.nextResetAt) setNextResetAt(res.nextResetAt);
      if (res.wasReset) {
        setMessages(res.messages);
        lastIdRef.current = res.messages.length > 0 ? res.messages[res.messages.length - 1].id : undefined;
        return;
      }
      if (res.messages.length > 0) {
        setMessages(prev => [...prev, ...res.messages.filter(m => !prev.some(p => p.id === m.id))]);
        lastIdRef.current = res.messages[res.messages.length - 1].id;
        haptic.tap();
      }
    } catch {
      // keep polling
    }
  }, [restaurant.id]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (!loading) intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loading, poll]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    plane.setValue(0);
    tween(plane, 1, { duration: 520, easing: ease.in3 }).start(() => {
      plane.setValue(0);
    });
    try {
      const msg = await sendChatMessage(restaurant.id, trimmed);
      sentIds.current.add(msg.id);
      setMessages(prev => [...prev, msg]);
      lastIdRef.current = msg.id;
    } catch {
      setText(trimmed);
      ui.toast('Mensagem não enviada. Tente de novo.', 'error');
    } finally {
      setSending(false);
    }
  }

  const myName = me ? `${me.first_name} ${me.last_name}`.trim() : null;
  const isMine = (m: ChatMessage) =>
    m.sender_type === 'app_user' && (sentIds.current.has(m.id) || (!!myName && m.sender_name === myName) || (!!me && m.sender_name === me.username));

  const isNearReset = secondsLeft > 0 && secondsLeft <= 300;
  const canSend = !!text.trim() && !sending;

  return (
    <Aurora intensity="calm" grid={false} sparkles={6}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <Glass strong intensity={60} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} scaleTo={0.85} accessibilityLabel="Voltar">
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </PressableScale>
          <Avatar name={restaurant.name} photo={restaurant.photo_url} size={42} ring={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{restaurant.name}</Text>
            <View style={styles.subRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.sub}>Chat público · ao vivo</Text>
            </View>
          </View>
          {nextResetAt && secondsLeft > 0 && (
            <View style={[styles.timer, isNearReset && styles.timerWarn]}>
              <MaterialIcons name="timer" size={13} color={isNearReset ? colors.danger : colors.cyan} />
              <Text style={[styles.timerText, isNearReset && { color: colors.danger }]}>{countdownLabel}</Text>
            </View>
          )}
        </Glass>

        {nextResetAt && secondsLeft > 0 && (
          <View style={[styles.banner, isNearReset && styles.bannerWarn]}>
            <MaterialIcons name="autorenew" size={13} color={isNearReset ? colors.danger : colors.textHint} />
            <Text style={[styles.bannerText, isNearReset && { color: colors.danger }]}>
              {isNearReset ? `Atenção: o chat reseta em ${countdownLabel}` : `As mensagens somem em ${countdownLabel}`}
            </Text>
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {loading ? (
            <View style={styles.skeletons}>
              <Skeleton style={{ width: '62%', height: 64, borderRadius: 22 }} />
              <Skeleton style={{ width: '48%', height: 52, borderRadius: 22, alignSelf: 'flex-end' }} delay={120} />
              <Skeleton style={{ width: '70%', height: 72, borderRadius: 22 }} delay={240} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => String(item.id)}
              renderItem={({ item, index }) => {
                const animate = !initialIds.current.has(item.id);
                return (
                  <Bubble
                    item={item}
                    mine={isMine(item)}
                    fromRestaurant={item.sender_type === 'restaurant'}
                    restaurantName={restaurant.name}
                    restaurantPhoto={restaurant.photo_url}
                    animate={animate}
                    delay={animate && index < messages.length - 1 ? Math.min(8, messages.length - 1 - index) * 40 : 0}
                  />
                );
              }}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) }] }}>
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
                      <MaterialIcons name="forum" size={36} color="#fff" />
                    </LinearGradient>
                  </Animated.View>
                  <KineticText text="Seja o primeiro a falar!" highlight={[2]} style={styles.emptyTitle} containerStyle={{ justifyContent: 'center', marginTop: 20 }} />
                  <Text style={styles.emptySub}>Pergunte sobre a fila, o cardápio ou faça um pedido especial.</Text>
                </View>
              }
            />
          )}

          {/* Composer */}
          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
            <Glass strong intensity={50} style={styles.composer}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Escreva uma mensagem…"
                placeholderTextColor={colors.textHint}
                selectionColor={colors.cyan}
                multiline
                maxLength={1000}
              />
              <PressableScale onPress={handleSend} disabled={!canSend} scaleTo={0.82} feedback="press" style={styles.send} accessibilityLabel="Enviar mensagem">
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 23 }]} />
                <Animated.View
                  style={{
                    transform: [
                      { translateX: plane.interpolate({ inputRange: [0, 0.6, 0.61, 1], outputRange: [0, 40, -40, 0] }) },
                      { translateY: plane.interpolate({ inputRange: [0, 0.6, 0.61, 1], outputRange: [0, -30, 30, 0] }) },
                      { rotate: '-30deg' },
                    ],
                  }}
                >
                  <MaterialIcons name="send" size={20} color="#fff" />
                </Animated.View>
              </PressableScale>
            </Glass>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12,
    borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.cyan },
  sub: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSub },
  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99,
    backgroundColor: 'rgba(100,235,226,0.1)', borderWidth: 1, borderColor: 'rgba(100,235,226,0.3)',
  },
  timerWarn: { backgroundColor: 'rgba(255,92,122,0.12)', borderColor: 'rgba(255,92,122,0.4)' },
  timerText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.cyan, fontVariant: ['tabular-nums'] },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  bannerWarn: { backgroundColor: 'rgba(255,92,122,0.08)' },
  bannerText: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textHint },

  skeletons: { flex: 1, padding: 16, gap: 14 },
  list: { padding: 16, paddingBottom: 8, gap: 10, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '86%' },
  rowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.plum, borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  avatarHouse: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  avatarImg: { width: 32, height: 32 },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.text },
  bubble: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 22, flexShrink: 1 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: colors.glassLine, borderBottomLeftRadius: 6 },
  bubbleHouse: { backgroundColor: 'rgba(100,235,226,0.08)', borderColor: 'rgba(100,235,226,0.45)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.purple, flexShrink: 1 },
  houseBadge: { backgroundColor: colors.cyan, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  houseBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.void, letterSpacing: 0.6, textTransform: 'uppercase' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  time: { fontFamily: fonts.bodyMed, fontSize: 10, color: colors.textHint, alignSelf: 'flex-end', marginTop: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: -0.8 },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  composerWrap: { paddingHorizontal: 12, paddingTop: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 18, borderRadius: 30 },
  input: {
    // explicit position keeps the field above Glass's absolutely positioned blur layer on web
    position: 'relative',
    flex: 1, maxHeight: 120, minHeight: 46, paddingTop: 13, paddingBottom: 12,
    fontFamily: fonts.body, fontSize: 15, color: colors.text, outlineStyle: 'none',
  } as any,
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
