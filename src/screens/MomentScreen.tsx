import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import {
  addMomentComment, deleteMoment, deleteMomentComment, getMoment, getMomentComments, getPublicRestaurant, toggleMomentLike,
} from '../services/moment';
import { getStoredUser } from '../services/auth';
import { Moment, MomentComment, UserApp } from '../types';
import { timeAgo } from '../utils/time';
import Aurora from '../components/Aurora';
import Avatar from '../components/Avatar';
import Glass from '../components/Glass';
import PressableScale from '../components/PressableScale';
import Skeleton from '../components/Skeleton';
import { useUI } from '../components/Dialog';
import { useBurst } from '../components/Burst';
import { colors, fonts, gradients } from '../theme';
import { ease, haptic, springTo, useEntrance } from '../motion';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Moment'>;
  route: RouteProp<RootStackParamList, 'Moment'>;
};

function CommentRow({ c, mine, onDelete }: { c: MomentComment; mine: boolean; onDelete: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => { springTo(t, 1, { bounce: 0.3, duration: 520 }).start(); }, [t]);
  return (
    <Animated.View style={[styles.comment, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      <Avatar name={c.author_name} photo={c.author_photo_url} size={36} ring={2} spin={false} />
      <View style={{ flex: 1 }}>
        <View style={styles.commentHead}>
          <Text style={[styles.commentName, c.is_restaurant && { color: colors.cyan }]} numberOfLines={1}>{c.author_name}</Text>
          {c.is_restaurant && (
            <View style={styles.houseBadge}><Text style={styles.houseBadgeText}>casa</Text></View>
          )}
          <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{c.text}</Text>
      </View>
      {mine && (
        <PressableScale onPress={onDelete} scaleTo={0.8} accessibilityLabel="Apagar comentário" style={styles.trash}>
          <MaterialIcons name="delete-outline" size={18} color={colors.textHint} />
        </PressableScale>
      )}
    </Animated.View>
  );
}

export default function MomentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const ui = useUI();
  const burst = useBurst();
  const [moment, setMoment] = useState<Moment>(route.params.moment);
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [me, setMe] = useState<UserApp | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);
  const enter = useEntrance(2, { step: 100, delay: 150 });
  const imgH = Math.min(W * 1.2, 560);

  useEffect(() => {
    getStoredUser().then(setMe).catch(() => {});
    getMoment(moment.id).then(setMoment).catch(() => {});
    getMomentComments(moment.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoadingComments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const like = useCallback(async (forceOn = false) => {
    if (forceOn && moment.liked_by_me) return;
    const next = !moment.liked_by_me;
    // optimistic update, rolled back on failure
    setMoment(m => ({ ...m, liked_by_me: next, like_count: m.like_count + (next ? 1 : -1) }));
    haptic.tap();
    likeScale.setValue(0.6);
    Animated.timing(likeScale, { toValue: 1, duration: 700, easing: ease.elastic, useNativeDriver: true }).start();
    try {
      const res = await toggleMomentLike(moment.id);
      setMoment(m => ({ ...m, liked_by_me: res.liked, like_count: res.like_count }));
    } catch {
      setMoment(m => ({ ...m, liked_by_me: !next, like_count: m.like_count + (next ? -1 : 1) }));
      ui.toast('Não foi possível curtir agora.', 'error');
    }
  }, [moment.id, moment.liked_by_me, likeScale, ui]);

  function onImageTap(e: any) {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      heart.setValue(0);
      Animated.sequence([
        Animated.timing(heart, { toValue: 1, duration: 650, easing: ease.elastic, useNativeDriver: true }),
        Animated.timing(heart, { toValue: 0, duration: 250, easing: ease.in3, useNativeDriver: true }),
      ]).start();
      burst.fire({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, count: 18, power: 0.55, quiet: true, palette: [colors.danger, '#FF7AD9', '#fff'] });
      like(true);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  async function sendComment() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const c = await addMomentComment(moment.id, value);
      setComments(prev => [...prev, c]);
      setMoment(m => ({ ...m, comment_count: m.comment_count + 1 }));
      setText('');
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      ui.toast((errors && Object.values(errors).flat().join(' ')) || 'Não foi possível comentar.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function removeComment(c: MomentComment) {
    const ok = await ui.confirm({ tone: 'danger', icon: 'delete-outline', title: 'Apagar comentário?', confirmText: 'Apagar' });
    if (!ok) return;
    try {
      await deleteMomentComment(moment.id, c.id);
      setComments(prev => prev.filter(x => x.id !== c.id));
      setMoment(m => ({ ...m, comment_count: Math.max(0, m.comment_count - 1) }));
    } catch {
      ui.toast('Não foi possível apagar.', 'error');
    }
  }

  async function removeMoment() {
    const ok = await ui.confirm({
      tone: 'danger', icon: 'delete-outline', title: 'Apagar este momento?',
      message: 'A foto some da galeria do restaurante.', confirmText: 'Apagar',
    });
    if (!ok) return;
    try {
      await deleteMoment(moment.id);
      ui.toast('Momento apagado', 'info');
      navigation.goBack();
    } catch {
      ui.toast('Não foi possível apagar.', 'error');
    }
  }

  async function openRestaurant() {
    try {
      const restaurant = await getPublicRestaurant(moment.restaurant_id);
      navigation.navigate('RestaurantDetail', { restaurant });
    } catch {
      ui.toast('Não foi possível abrir o restaurante.', 'error');
    }
  }

  const isMine = !!me && me.id === moment.user_id;

  const header = (
    <View>
      <Pressable onPress={onImageTap}>
        <Animated.View style={[styles.imageWrap, { height: imgH }, enter(0)]}>
          <Image source={{ uri: moment.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['rgba(10,6,23,0.55)', 'rgba(10,6,23,0)', 'rgba(10,6,23,0.6)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.badges}>
            {moment.is_pinned && (
              <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                <MaterialIcons name="push-pin" size={13} color={colors.void} />
                <Text style={styles.badgeText}>Fixada</Text>
              </View>
            )}
            {moment.liked_by_restaurant && (
              <View style={[styles.badge, { backgroundColor: colors.cyan }]}>
                <MaterialIcons name="favorite" size={13} color={colors.void} />
                <Text style={styles.badgeText}>Curtida pelo restaurante</Text>
              </View>
            )}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[styles.bigHeart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] }) }] }]}
          >
            <MaterialIcons name="favorite" size={110} color={colors.danger} />
          </Animated.View>
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.info, enter(1)]}>
        <View style={styles.authorRow}>
          <Avatar name={moment.user_name} photo={moment.user_photo_url} size={44} ring={2.5} spin={false} />
          <View style={{ flex: 1 }}>
            <Text style={styles.author} numberOfLines={1}>{moment.user_name}</Text>
            <PressableScale onPress={openRestaurant} feedback="select" scaleTo={0.96} style={styles.placeLink}>
              <MaterialIcons name="place" size={13} color={colors.cyan} />
              <Text style={styles.placeName} numberOfLines={1}>{moment.restaurant_name}</Text>
              <Text style={styles.time}> · {timeAgo(moment.created_at)}</Text>
            </PressableScale>
          </View>
          <PressableScale onPress={() => like()} scaleTo={0.8} feedback="none" accessibilityLabel={moment.liked_by_me ? 'Descurtir' : 'Curtir'} style={styles.likeBtn}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <MaterialIcons name={moment.liked_by_me ? 'favorite' : 'favorite-border'} size={26} color={moment.liked_by_me ? colors.danger : colors.text} />
            </Animated.View>
            <Text style={styles.likeCount}>{moment.like_count}</Text>
          </PressableScale>
        </View>

        {!!moment.caption && <Text style={styles.caption}>{moment.caption}</Text>}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Comentários</Text>
          <Text style={styles.sectionCount}>{moment.comment_count}</Text>
        </View>
      </Animated.View>
    </View>
  );

  return (
    <Aurora intensity="calm" grid={false} sparkles={5}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={comments}
          keyExtractor={c => String(c.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <CommentRow c={item} mine={!!me && item.user_id === me.id} onDelete={() => removeComment(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListEmptyComponent={
            loadingComments ? (
              <View style={{ gap: 12, paddingHorizontal: 20 }}>
                <Skeleton style={{ height: 52, borderRadius: 18 }} />
                <Skeleton style={{ height: 52, borderRadius: 18 }} delay={120} />
              </View>
            ) : (
              <Text style={styles.empty}>Seja o primeiro a comentar.</Text>
            )
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <PressableScale onPress={() => navigation.goBack()} style={styles.roundBtn} scaleTo={0.85} accessibilityLabel="Voltar">
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </PressableScale>
          {isMine && (
            <PressableScale onPress={removeMoment} style={styles.roundBtn} scaleTo={0.85} accessibilityLabel="Apagar momento">
              <MaterialIcons name="delete-outline" size={22} color="#fff" />
            </PressableScale>
          )}
        </View>

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
          <Glass strong intensity={50} style={styles.composer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Escreva um comentário…"
              placeholderTextColor={colors.textHint}
              selectionColor={colors.cyan}
              maxLength={500}
              multiline
            />
            <PressableScale onPress={sendComment} disabled={!text.trim() || sending} scaleTo={0.82} feedback="press" style={styles.send} accessibilityLabel="Enviar comentário">
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 23 }]} />
              <MaterialIcons name="send" size={20} color="#fff" />
            </PressableScale>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  imageWrap: { width: '100%', backgroundColor: colors.night },
  badges: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', gap: 8, flexWrap: 'wrap', right: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.void },
  bigHeart: { position: 'absolute', alignSelf: 'center', top: '38%' },
  info: { paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  author: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  placeLink: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 2 },
  placeName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.cyan },
  time: { fontFamily: fonts.body, fontSize: 12, color: colors.textHint },
  likeBtn: { alignItems: 'center', gap: 2, padding: 4, minWidth: 44 },
  likeCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textSub },
  caption: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: -0.5 },
  sectionCount: {
    fontFamily: fonts.bodyBold, fontSize: 12, color: colors.cyan, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 99, backgroundColor: 'rgba(100,235,226,0.12)', overflow: 'hidden',
  },
  comment: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, alignItems: 'flex-start' },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  commentTime: { fontFamily: fonts.body, fontSize: 11, color: colors.textHint },
  commentText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSub, marginTop: 2 },
  houseBadge: { backgroundColor: colors.cyan, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  houseBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.void, letterSpacing: 0.6, textTransform: 'uppercase' },
  trash: { padding: 6 },
  empty: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textHint, textAlign: 'center', paddingVertical: 30 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  roundBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,6,23,0.55)', borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 18, borderRadius: 30 },
  input: {
    position: 'relative', flex: 1, maxHeight: 100, minHeight: 46, paddingTop: 13, paddingBottom: 12,
    fontFamily: fonts.body, fontSize: 15, color: colors.text, outlineStyle: 'none',
  } as any,
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
