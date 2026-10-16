import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { getRestaurantReviews } from '../services/restaurant';
import { Review, RestaurantQueue } from '../types';
import Aurora from '../components/Aurora';
import Glass from '../components/Glass';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import KineticText from '../components/KineticText';
import LivePill from '../components/LivePill';
import OccupancyRing from '../components/OccupancyRing';
import CountUp from '../components/CountUp';
import Avatar from '../components/Avatar';
import Skeleton from '../components/Skeleton';
import LeafletView, { LEAFLET_HEAD } from '../components/LeafletView';
import { useUI } from '../components/Dialog';
import { useBurst } from '../components/Burst';
import { colors, fonts, gradients, initialsOf, occupancyOf } from '../theme';
import { useEntrance } from '../motion';
import StarRating from './detail/StarRating';
import ReservationSheet, { formatLongDate } from './detail/ReservationSheet';
import { ReviewSheet, ReviewerSheet } from './detail/ReviewSheets';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'RestaurantDetail'>;
  route: RouteProp<RootStackParamList, 'RestaurantDetail'>;
};
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const QUEUE_STATUS: Record<string, { icon: IconName; color: string; label: string }> = {
  OPEN: { icon: 'lock-open', color: colors.cyan, label: 'Fila aberta' },
  CLOSED: { icon: 'lock', color: colors.danger, label: 'Fila fechada' },
  PAUSED: { icon: 'pause-circle-outline', color: colors.warning, label: 'Fila pausada' },
};

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function LiveQueue({ queue }: { queue: RestaurantQueue }) {
  const status = QUEUE_STATUS[queue.status] ?? QUEUE_STATUS.OPEN;
  const occ = occupancyOf(queue);
  const showNumbers = queue.status !== 'CLOSED' && queue.max_tables > 0;

  return (
    <Glass strong style={styles.live}>
      <View style={styles.liveHead}>
        <View>
          <Text style={styles.eyebrow}>agora mesmo</Text>
          <Text style={styles.sectionTitle}>Lotação</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: status.color + '66', backgroundColor: status.color + '1A' }]}>
          <MaterialIcons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {showNumbers ? (
        <View style={styles.liveBody}>
          <OccupancyRing pct={occ.pct} level={occ.level} size={132} stroke={11} caption={occ.label} delay={350} />
          <View style={styles.liveStats}>
            <View style={styles.liveStat}>
              <MaterialIcons name="table-restaurant" size={18} color={colors.purple} />
              <View>
                <Text style={styles.liveValue}>
                  <CountUp value={queue.current_tables} delay={400} style={styles.liveValue} />
                  <Text style={styles.liveOf}>/{queue.max_tables}</Text>
                </Text>
                <Text style={styles.liveLabel}>mesas ocupadas</Text>
              </View>
            </View>
            <View style={styles.liveStat}>
              <MaterialIcons name="groups" size={18} color={colors.cyan} />
              <View>
                <CountUp value={queue.current_size} delay={500} style={styles.liveValue} />
                <Text style={styles.liveLabel}>na fila</Text>
              </View>
            </View>
            {queue.estimated_wait_minutes > 0 && (
              <View style={styles.liveStat}>
                <MaterialIcons name="schedule" size={18} color={colors.warning} />
                <View>
                  <CountUp value={queue.estimated_wait_minutes} delay={600} suffix=" min" style={[styles.liveValue, { color: colors.warning }]} />
                  <Text style={styles.liveLabel}>de espera</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.closedBox}>
          <MaterialIcons name={status.icon} size={22} color={status.color} />
          <Text style={styles.closedText}>
            {queue.status === 'CLOSED' ? 'A fila está fechada no momento.' : 'Sem dados de mesas por enquanto.'}
          </Text>
        </View>
      )}
    </Glass>
  );
}

function InfoRow({ icon, text, onPress, accent }: { icon: IconName; text: string; onPress?: () => void; accent?: boolean }) {
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><MaterialIcons name={icon} size={18} color={colors.cyan} /></View>
      <Text style={[styles.infoText, accent && { color: colors.cyan }]} numberOfLines={2}>{text}</Text>
      {onPress && <MaterialIcons name="north-east" size={16} color={colors.textHint} />}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} scaleTo={0.97} feedback="select">{content}</PressableScale> : content;
}

export default function RestaurantDetailScreen({ navigation, route }: Props) {
  const { restaurant } = route.params;
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const ui = useUI();
  const burst = useBurst();
  const HERO = Math.min(420, W * 1.05);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [profileReview, setProfileReview] = useState<Review | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const enter = useEntrance(5, { step: 90, delay: 250 });

  useEffect(() => {
    getRestaurantReviews(restaurant.id)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, [restaurant.id]);

  const hasCoords = !!(restaurant.latitude && restaurant.longitude);
  const occ = occupancyOf(restaurant.queue);
  const averageRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : null;

  const miniMapHtml = hasCoords ? `<!DOCTYPE html><html><head>${LEAFLET_HEAD}</head><body><div id="map"></div><script>
    function init(){ if(typeof L==='undefined'){return setTimeout(init,100)}
      var map=L.map('map',{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false,attributionControl:false})
        .setView([${restaurant.latitude},${restaurant.longitude}],16);
      L.tileLayer(DARK_TILES,{maxZoom:19,subdomains:'abcd'}).addTo(map);
      L.marker([${restaurant.latitude},${restaurant.longitude}],{icon:L.divIcon({className:'',html:pinHtml('${occ.color}','active'),iconSize:[44,44],iconAnchor:[22,22]})}).addTo(map);
      setTimeout(function(){map.invalidateSize()},300);
    }
    if(document.readyState==='complete'){init()}else{window.addEventListener('load',init)}
  </script></body></html>` : '';

  function openDirections(app: 'maps' | 'waze') {
    const { latitude: lat, longitude: lng } = restaurant;
    if (!lat || !lng) return;
    const url = app === 'waze'
      ? `waze://?ll=${lat},${lng}&navigate=yes`
      : Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(restaurant.name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`));
  }

  async function askDirections() {
    const app = await ui.choose({
      title: 'Como chegar',
      message: 'Abrir com qual aplicativo?',
      icon: 'directions',
      options: [
        { key: 'maps', label: 'Google Maps', icon: 'map' },
        { key: 'waze', label: 'Waze', icon: 'navigation' },
      ],
    });
    if (app === 'maps' || app === 'waze') openDirections(app);
  }

  function onReserved(dateStr: string) {
    setShowReservation(false);
    setTimeout(() => {
      ui.alert({
        tone: 'success',
        title: 'Reserva enviada!',
        message: `Reserva para ${formatLongDate(dateStr)} registrada com sucesso.`,
        confirmText: 'Perfeito',
      });
    }, 280);
  }

  function onReviewed(review: Review) {
    setReviews(prev => [review, ...prev]);
    setShowReview(false);
    setTimeout(() => {
      burst.fire({ power: 1.1, palette: [colors.gold, '#FFFFFF', colors.purple, colors.cyan] });
      ui.toast('Avaliação publicada. Valeu!', 'success');
    }, 260);
  }

  const heroImageStyle = {
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [-HERO, 0, HERO], outputRange: [-HERO / 2, 0, HERO * 0.55] }) },
      { scale: scrollY.interpolate({ inputRange: [-HERO, 0], outputRange: [2.2, 1], extrapolateRight: 'clamp' }) },
    ],
  };
  const heroTextStyle = {
    opacity: scrollY.interpolate({ inputRange: [0, HERO * 0.55], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [{ translateY: scrollY.interpolate({ inputRange: [0, HERO], outputRange: [0, -60], extrapolate: 'clamp' }) }],
  };
  const barOpacity = scrollY.interpolate({ inputRange: [HERO * 0.55, HERO * 0.8], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Aurora intensity="calm" sparkles={6} grid={false}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Hero */}
        <View style={{ height: HERO }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImageStyle]}>
            {restaurant.photo_url ? (
              <Image source={{ uri: restaurant.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[colors.blue, colors.purple, colors.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.heroFallback]}>
                <Text style={styles.heroInitials}>{initialsOf(restaurant.name)}</Text>
              </LinearGradient>
            )}
            <LinearGradient colors={['rgba(10,6,23,0.55)', 'rgba(10,6,23,0)', 'rgba(10,6,23,0.6)', colors.void]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
          </Animated.View>

          <Animated.View style={[styles.heroText, heroTextStyle]}>
            {restaurant.queue && restaurant.queue.max_tables > 0 && restaurant.queue.status !== 'CLOSED' ? (
              <LivePill label={`${occ.pct}% · ${occ.label}`} color={occ.color} />
            ) : null}
            <KineticText text={restaurant.name} style={styles.heroName} delay={200} containerStyle={{ marginTop: 10 }} />
            {averageRating !== null && (
              <View style={styles.heroRating}>
                <StarRating value={Math.round(averageRating)} size={16} />
                <Text style={styles.heroRatingText}>{averageRating.toFixed(1)} · {reviews.length} avaliaç{reviews.length === 1 ? 'ão' : 'ões'}</Text>
              </View>
            )}
          </Animated.View>
        </View>

        <View style={styles.body}>
          {/* Live occupancy */}
          {restaurant.queue && (
            <Animated.View style={enter(0)}>
              <LiveQueue queue={restaurant.queue} />
            </Animated.View>
          )}

          {/* Info */}
          <Animated.View style={[styles.block, enter(1)]}>
            <Text style={styles.eyebrow}>endereço & contato</Text>
            <Glass style={styles.infoCard}>
              <InfoRow icon="place" text={restaurant.address} onPress={hasCoords ? askDirections : undefined} />
              <View style={styles.sep} />
              <InfoRow icon="call" text={restaurant.contact_phone} onPress={() => Linking.openURL(`tel:${restaurant.contact_phone.replace(/[^\d+]/g, '')}`).catch(() => {})} />
              {!!restaurant.site && (
                <>
                  <View style={styles.sep} />
                  <InfoRow icon="language" text={restaurant.site} accent onPress={() => Linking.openURL(restaurant.site!).catch(() => {})} />
                </>
              )}
              {!!restaurant.instagram && (
                <>
                  <View style={styles.sep} />
                  <InfoRow icon="alternate-email" text={restaurant.instagram} />
                </>
              )}
            </Glass>
          </Animated.View>

          {/* Mini map */}
          {hasCoords && (
            <Animated.View style={[styles.block, enter(2)]}>
              <PressableScale onPress={askDirections} scaleTo={0.98}>
                <View style={styles.mapCard}>
                  <LeafletView html={miniMapHtml} interactive={false} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['rgba(10,6,23,0)', 'rgba(10,6,23,0.9)']} style={styles.mapShade} pointerEvents="none" />
                  <View style={styles.mapCta} pointerEvents="none">
                    <MaterialIcons name="directions" size={18} color={colors.cyan} />
                    <Text style={styles.mapCtaText}>Traçar rota</Text>
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          )}

          {/* Reviews */}
          <Animated.View style={[styles.block, enter(3)]}>
            <View style={styles.reviewsHead}>
              <View>
                <Text style={styles.eyebrow}>quem foi, conta</Text>
                <Text style={styles.sectionTitle}>Avaliações</Text>
              </View>
              <GradientButton title="Avaliar" icon="rate-review" size="sm" variant="ghost" onPress={() => setShowReview(true)} />
            </View>

            {averageRating !== null && (
              <Glass style={styles.scoreCard}>
                <CountUp value={averageRating} decimals={1} style={styles.score} />
                <View style={{ gap: 4 }}>
                  <StarRating value={Math.round(averageRating)} size={20} />
                  <Text style={styles.scoreSub}>{reviews.length} avaliaç{reviews.length === 1 ? 'ão' : 'ões'}</Text>
                </View>
              </Glass>
            )}

            {loadingReviews ? (
              <View style={{ gap: 10 }}>
                <Skeleton style={{ height: 110, borderRadius: 22 }} />
                <Skeleton style={{ height: 110, borderRadius: 22 }} delay={120} />
              </View>
            ) : reviews.length === 0 ? (
              <Glass style={styles.empty}>
                <MaterialIcons name="auto-awesome" size={30} color={colors.gold} />
                <Text style={styles.emptyTitle}>Nenhuma avaliação ainda</Text>
                <Text style={styles.emptySub}>Seja a primeira pessoa a avaliar!</Text>
              </Glass>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.map(r => (
                  <Glass key={r.id} style={styles.review}>
                    <View style={styles.reviewTop}>
                      <PressableScale onPress={() => setProfileReview(r)} style={styles.reviewUser} scaleTo={0.96} feedback="select">
                        <Avatar name={r.user_name} photo={r.user_photo_url} size={40} spin={false} ring={2} />
                        <View style={{ flexShrink: 1 }}>
                          <Text style={styles.reviewName} numberOfLines={1}>{r.user_name}</Text>
                          <Text style={styles.reviewDate}>{relativeDate(r.created_at)}</Text>
                        </View>
                      </PressableScale>
                      <StarRating value={r.stars} size={14} />
                    </View>
                    {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                    {!!r.manager_response && (
                      <View style={styles.answer}>
                        <LinearGradient colors={gradients.primaryShort} style={styles.answerBar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.answerLabel}>resposta da casa</Text>
                          <Text style={styles.answerText}>{r.manager_response}</Text>
                        </View>
                      </View>
                    )}
                  </Glass>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.ScrollView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: barOpacity }]} pointerEvents="none">
          <Glass strong intensity={60} style={[StyleSheet.absoluteFill, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1 }]} />
        </Animated.View>
        <PressableScale onPress={() => navigation.goBack()} style={styles.roundBtn} scaleTo={0.85} accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </PressableScale>
        <Animated.Text style={[styles.barTitle, { opacity: barOpacity }]} numberOfLines={1}>{restaurant.name}</Animated.Text>
        {hasCoords ? (
          <PressableScale onPress={askDirections} style={styles.roundBtn} scaleTo={0.85} accessibilityLabel="Como chegar">
            <MaterialIcons name="directions" size={22} color="#fff" />
          </PressableScale>
        ) : <View style={{ width: 44 }} />}
      </View>

      {/* Sticky actions */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <Glass strong intensity={60} style={styles.dockInner}>
          <PressableScale onPress={() => navigation.navigate('Chat', { restaurant })} style={styles.dockBtn} scaleTo={0.85} accessibilityLabel="Abrir chat">
            <MaterialIcons name="forum" size={22} color={colors.text} />
          </PressableScale>
          <GradientButton title="Reservar mesa" icon="event-seat" size="md" onPress={() => setShowReservation(true)} style={{ flex: 1 }} />
        </Glass>
      </View>

      <ReservationSheet visible={showReservation} restaurant={restaurant} onClose={() => setShowReservation(false)} onDone={onReserved} />
      <ReviewSheet visible={showReview} restaurant={restaurant} onClose={() => setShowReview(false)} onSubmitted={onReviewed} />
      <ReviewerSheet review={profileReview} onClose={() => setProfileReview(null)} />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroInitials: { fontFamily: fonts.display, fontSize: 140, color: 'rgba(255,255,255,0.16)', letterSpacing: -6 },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  heroName: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.6, color: '#fff' },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  heroRatingText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSub },

  body: { paddingHorizontal: 18, gap: 4 },
  block: { marginTop: 26, gap: 12 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2.2, color: colors.cyan, textTransform: 'uppercase' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.6, marginTop: 2 },

  live: { padding: 18, borderRadius: 30, gap: 18 },
  liveHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  liveBody: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  liveStats: { flex: 1, gap: 14 },
  liveStat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveValue: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
  liveOf: { fontFamily: fonts.displayMed, fontSize: 16, color: colors.textHint },
  liveLabel: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textHint, marginTop: -2 },
  closedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)' },
  closedText: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSub },

  infoCard: { borderRadius: 24, paddingVertical: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,235,226,0.1)' },
  infoText: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.text },
  sep: { height: 1, backgroundColor: colors.glassLine, marginLeft: 62 },

  mapCard: { height: 190, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassLine, backgroundColor: colors.night },
  mapShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  mapCta: {
    position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(10,6,23,0.75)', borderWidth: 1, borderColor: colors.glassLine,
  },
  mapCtaText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text },

  reviewsHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 24 },
  score: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, color: colors.gold, letterSpacing: -2 },
  scoreSub: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textHint },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28, borderRadius: 24 },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text, marginTop: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textHint },
  review: { padding: 14, borderRadius: 22, gap: 10 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  reviewName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  reviewDate: { fontFamily: fonts.body, fontSize: 11, color: colors.textHint },
  reviewComment: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSub },
  answer: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(143,84,254,0.1)' },
  answerBar: { width: 3, borderRadius: 2 },
  answerLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4, color: colors.purple, textTransform: 'uppercase' },
  answerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 3 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  roundBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,6,23,0.55)', borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  barTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text, textAlign: 'center' },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  dockInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 34, maxWidth: 520, width: '100%', alignSelf: 'center' },
  dockBtn: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassLineStrong,
  },
});
