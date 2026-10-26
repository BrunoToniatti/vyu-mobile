import React, { useCallback, useRef, useState } from 'react';
import { Animated, Image, RefreshControl, ScrollView, ScrollViewInstance, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, MainTabParamList } from '../../App';
import { getPublicRestaurants, getMyReservations, MyReservation } from '../services/restaurant';
import { getStoredUser, logout } from '../services/auth';
import { getAllCategories, getUserPreferences, CategoryItem, Category } from '../services/category';
import { Moment, Restaurant, UserApp } from '../types';
import { getMomentFeed } from '../services/moment';
import MomentTile from '../components/MomentTile';
import Aurora from '../components/Aurora';
import Avatar from '../components/Avatar';
import KineticText from '../components/KineticText';
import Glass from '../components/Glass';
import PressableScale from '../components/PressableScale';
import CountUp from '../components/CountUp';
import LivePill from '../components/LivePill';
import Marquee from '../components/Marquee';
import OccupancyRing from '../components/OccupancyRing';
import Skeleton from '../components/Skeleton';
import Ticket from '../components/Ticket';
import { useUI } from '../components/Dialog';
import { colors, fonts, gradients, initialsOf, occupancyOf } from '../theme';
import { useEntrance, useLoop } from '../motion';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Restaurants'>,
    StackNavigationProp<RootStackParamList>
  >;
};

type Featured = Restaurant & { matched: boolean };

const GAP = 14;

function greetingFor(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Poster card in a 3D coverflow: rotates, shrinks and parallaxes with the scroll. */
function PosterCard({ item, index, scrollX, width, onPress }: {
  item: Featured; index: number; scrollX: Animated.Value; width: number; onPress: () => void;
}) {
  const I = width + GAP;
  const range = [(index - 1) * I, index * I, (index + 1) * I];
  const occ = occupancyOf(item.queue);
  const hasQueue = !!item.queue && !!item.queue.max_tables;

  return (
    <Animated.View
      style={{
        width,
        marginRight: GAP,
        opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp' }),
        transform: [
          { perspective: 1000 },
          { rotateY: scrollX.interpolate({ inputRange: range, outputRange: ['26deg', '0deg', '-26deg'], extrapolate: 'clamp' }) },
          { scale: scrollX.interpolate({ inputRange: range, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' }) },
        ],
      }}
    >
      <PressableScale onPress={onPress} scaleTo={0.96} style={styles.poster}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              left: -40, right: -40,
              transform: [{ translateX: scrollX.interpolate({ inputRange: range, outputRange: [-36, 0, 36], extrapolate: 'clamp' }) }],
            },
          ]}
        >
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[colors.plum, colors.violet, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.posterFallback]}>
              <Text style={styles.posterInitials}>{initialsOf(item.name)}</Text>
            </LinearGradient>
          )}
        </Animated.View>
        <LinearGradient colors={gradients.shade} locations={[0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.posterTop}>
          {hasQueue ? <LivePill label={occ.label} color={occ.color} /> : <View />}
          {item.average_rating ? (
            <View style={styles.rating}>
              <MaterialIcons name="star" size={13} color={colors.gold} />
              <Text style={styles.ratingText}>{item.average_rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.posterBottom}>
          <View style={{ flex: 1, gap: 6 }}>
            {item.matched && (
              <View style={styles.match}>
                <MaterialIcons name="favorite" size={11} color={colors.void} />
                <Text style={styles.matchText}>combina com você</Text>
              </View>
            )}
            <Text style={styles.posterName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.addrRow}>
              <MaterialIcons name="place" size={13} color={colors.textSub} />
              <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
          {hasQueue && <OccupancyRing pct={occ.pct} level={occ.level} size={62} stroke={6} delay={400 + index * 150} live={false} />}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function StatTile({ icon, value, label, color, delay }: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']; value: number; label: string; color: string; delay: number;
}) {
  return (
    <Glass style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <CountUp value={value} delay={delay} style={styles.statValue} />
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </Glass>
  );
}

export default function RestaurantsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const ui = useUI();
  const CARD_W = Math.min(W * 0.76, 340);
  const I = CARD_W + GAP;

  const [user, setUser] = useState<UserApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [all, setAll] = useState<Restaurant[]>([]);
  const [upcoming, setUpcoming] = useState<MyReservation[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);

  const scrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<ScrollViewInstance>(null);
  const carouselIdx = useRef(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const enter = useEntrance(6, { step: 90, delay: 150 });
  const arrow = useLoop(900);

  function stopCarousel() {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    carouselTimer.current = null;
  }

  function startCarousel(count: number) {
    stopCarousel();
    if (count < 2) return;
    carouselTimer.current = setInterval(() => {
      const next = (carouselIdx.current + 1) % count;
      carouselRef.current?.scrollTo({ x: next * I, animated: true });
      carouselIdx.current = next;
    }, 3500);
  }

  async function fetchData() {
    try {
      getMomentFeed().then(setMoments).catch(() => {});
      const [u, data, prefs, cats, reservations] = await Promise.all([
        getStoredUser(),
        getPublicRestaurants(),
        getUserPreferences().catch(() => [] as CategoryItem[]),
        getAllCategories().catch(() => [] as Category[]),
        getMyReservations().catch(() => [] as MyReservation[]),
      ]);
      setUser(u);
      setAll(data);

      const prefItemIds = new Set(prefs.map(p => p.id));
      const marked: Featured[] = data.map(r => ({ ...r, matched: (r.category_items ?? []).some(id => prefItemIds.has(id)) }));
      const sorted = [...marked].sort((a, b) => (a.matched === b.matched ? 0 : a.matched ? -1 : 1));

      const top3 = sorted.slice(0, 3);
      setFeatured(top3);
      carouselIdx.current = 0;
      startCarousel(top3.length);

      const names = cats.flatMap(c => c.items.map(i => i.name));
      setTags(names.length ? names.slice(0, 14) : ['Pizza', 'Sushi', 'Burger', 'Drinks', 'Café', 'Massas', 'Vegano']);

      const today = todayISO();
      setUpcoming(
        reservations
          .filter(r => ['PENDING', 'CONFIRMED'].includes(r.status) && r.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
      );
    } catch {
      // keep whatever is on screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
      return stopCarousel;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function confirmLogout() {
    const ok = await ui.confirm({
      tone: 'danger',
      icon: 'logout',
      title: 'Sair da conta?',
      message: 'Você vai precisar entrar de novo para ver suas reservas.',
      confirmText: 'Sair',
    });
    if (!ok) return;
    await logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  const openCount = all.filter(r => r.queue?.status === 'OPEN').length;
  const calmCount = all.filter(r => r.queue?.max_tables && occupancyOf(r.queue).level === 'low').length;
  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Aurora intensity="calm" sparkles={10}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={colors.cyan}
            colors={[colors.purple, colors.cyan]}
            progressBackgroundColor={colors.night}
          />
        }
      >
        {/* Header */}
        <Animated.View style={[styles.header, enter(0)]}>
          <PressableScale onPress={() => navigation.navigate('Profile')} scaleTo={0.9} accessibilityLabel="Abrir perfil">
            <Avatar name={user ? `${user.first_name} ${user.last_name}` : undefined} photo={user?.photo_url} size={50} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.date}>{dateLabel}</Text>
            <Text style={styles.hello} numberOfLines={1}>{greetingFor()}</Text>
          </View>
          <PressableScale onPress={confirmLogout} style={styles.iconBtn} scaleTo={0.88} accessibilityLabel="Sair da conta">
            <MaterialIcons name="logout" size={20} color={colors.text} />
          </PressableScale>
        </Animated.View>

        <View style={styles.pad}>
          <KineticText
            key={user?.first_name ?? 'anon'}
            text={user ? `${user.first_name}, onde vai ser hoje?` : 'Onde vai ser hoje?'}
            highlight={user ? [0] : [2]}
            delay={250}
            style={styles.headline}
            containerStyle={{ marginTop: 18 }}
          />
        </View>

        {/* Live stats */}
        <Animated.View style={[styles.stats, enter(1)]}>
          <StatTile icon="storefront" value={openCount} label="abertos agora" color={colors.cyan} delay={500} />
          <StatTile icon="self-improvement" value={calmCount} label="tranquilos" color={colors.purple} delay={650} />
          <StatTile icon="confirmation-number" value={upcoming.length} label="suas reservas" color={colors.gold} delay={800} />
        </Animated.View>

        {/* Featured coverflow */}
        <Animated.View style={enter(2)}>
          <View style={[styles.sectionHead, styles.pad]}>
            <View>
              <Text style={styles.eyebrow}>curadoria</Text>
              <Text style={styles.sectionTitle}>Feitos pra você</Text>
            </View>
            <LivePill />
          </View>

          {loading && featured.length === 0 ? (
            <View style={{ flexDirection: 'row', paddingLeft: (W - CARD_W) / 2, gap: GAP }}>
              <Skeleton style={{ width: CARD_W, height: 380, borderRadius: 30 }} />
              <Skeleton style={{ width: CARD_W, height: 380, borderRadius: 30 }} delay={150} />
            </View>
          ) : featured.length === 0 ? (
            <Glass style={[styles.empty, { marginHorizontal: 20 }]}>
              <MaterialIcons name="restaurant" size={34} color={colors.textHint} />
              <Text style={styles.emptyTitle}>Nenhum restaurante disponível</Text>
            </Glass>
          ) : (
            <>
              <Animated.ScrollView
                ref={carouselRef as any}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={I}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: (W - CARD_W) / 2, paddingVertical: 8 }}
                scrollEventThrottle={16}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
                onScrollBeginDrag={stopCarousel}
                onMomentumScrollEnd={(e) => {
                  carouselIdx.current = Math.round(e.nativeEvent.contentOffset.x / I);
                  startCarousel(featured.length);
                }}
              >
                {featured.map((r, i) => (
                  <PosterCard
                    key={r.id}
                    item={r}
                    index={i}
                    scrollX={scrollX}
                    width={CARD_W}
                    onPress={() => navigation.navigate('RestaurantDetail', { restaurant: r })}
                  />
                ))}
              </Animated.ScrollView>
              {featured.length > 1 && (
                <View style={styles.dots}>
                  {featured.map((_, i) => {
                    const range = [(i - 1) * I, i * I, (i + 1) * I];
                    return (
                      <Animated.View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
                            transform: [{ scaleX: scrollX.interpolate({ inputRange: range, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }) }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Moments feed */}
        <Animated.View style={enter(3)}>
          <View style={[styles.sectionHead, styles.pad]}>
            <View>
              <Text style={styles.eyebrow}>da galera</Text>
              <Text style={styles.sectionTitle}>Momentos</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.momentsRow}>
            <PressableScale onPress={() => navigation.navigate('NewMoment')} scaleTo={0.94} feedback="press" style={styles.addMoment} accessibilityLabel="Registrar momento">
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.addIcon}><MaterialIcons name="photo-camera" size={26} color={colors.deep} /></View>
              <Text style={styles.addTitle}>Registrar{'\n'}momento</Text>
            </PressableScale>
            {moments.map(m => (
              <MomentTile key={m.id} moment={m} showPlace width={150} height={200} onPress={() => navigation.navigate('Moment', { moment: m })} />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Ticker band */}
        <Animated.View style={[styles.bandWrap, enter(3)]}>
          <View style={styles.bandTilt}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.band}>
              <Marquee items={tags.length ? tags : ['Lotação ao vivo', 'Reserve em segundos', 'Chat com a casa']} textStyle={styles.bandText} speed={45} />
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Upcoming reservations */}
        <Animated.View style={[styles.pad, enter(4)]}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.eyebrow}>na agenda</Text>
              <Text style={styles.sectionTitle}>Próximas reservas</Text>
            </View>
            {upcoming.length > 0 && (
              <PressableScale onPress={() => navigation.navigate('Profile')} feedback="select">
                <Text style={styles.link}>ver todas</Text>
              </PressableScale>
            )}
          </View>

          {loading && upcoming.length === 0 ? (
            <View style={{ gap: 10 }}>
              <Skeleton style={{ height: 96, borderRadius: 22 }} />
              <Skeleton style={{ height: 96, borderRadius: 22 }} delay={120} />
            </View>
          ) : upcoming.length === 0 ? (
            <Glass style={styles.empty}>
              <MaterialIcons name="event-available" size={34} color={colors.textHint} />
              <Text style={styles.emptyTitle}>Nenhuma reserva por enquanto</Text>
              <Text style={styles.emptySub}>Escolha um lugar e garanta sua mesa.</Text>
            </Glass>
          ) : (
            <View style={{ gap: 10 }}>
              {upcoming.map(r => (
                <Ticket key={r.id} r={r} onPress={() => navigation.navigate('Profile')} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* Explore CTA */}
        <Animated.View style={[styles.pad, { marginTop: 26 }, enter(5)]}>
          <PressableScale onPress={() => navigation.navigate('RestaurantList')} scaleTo={0.97} feedback="press">
            <LinearGradient colors={gradients.electric} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaEyebrow}>{all.length} lugares no radar</Text>
                <Text style={styles.ctaTitle}>Explorar todos os restaurantes</Text>
              </View>
              <View style={styles.ctaArrow}>
                <Animated.View style={{ transform: [{ translateX: arrow.interpolate({ inputRange: [0, 1], outputRange: [-3, 4] }) }] }}>
                  <MaterialIcons name="arrow-forward" size={24} color={colors.blue} />
                </Animated.View>
              </View>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </Animated.ScrollView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  date: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, color: colors.textHint, textTransform: 'uppercase' },
  hello: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.text },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  headline: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -1.4, color: colors.text },

  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 22 },
  stat: { flex: 1, padding: 12, borderRadius: 20, gap: 2 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: -1 },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textHint },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, marginBottom: 14 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2.2, color: colors.cyan, textTransform: 'uppercase' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.6, marginTop: 2 },
  link: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.cyan },

  poster: { height: 380, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.night, borderWidth: 1, borderColor: colors.glassLine },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterInitials: { fontFamily: fonts.display, fontSize: 96, color: 'rgba(255,255,255,0.22)', letterSpacing: -4 },
  posterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rating: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99,
    backgroundColor: 'rgba(10,6,23,0.6)',
  },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text },
  posterBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  match: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.cyan, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
  },
  matchText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.void, letterSpacing: 0.3 },
  posterName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: '#fff', letterSpacing: -0.8 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addr: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSub },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 12 },
  dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: colors.cyan },

  momentsRow: { gap: 12, paddingHorizontal: 20 },
  addMoment: { width: 150, height: 200, borderRadius: 24, overflow: 'hidden', padding: 16, justifyContent: 'space-between' },
  addIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: '#fff', letterSpacing: -0.5 },
  bandWrap: { marginTop: 34, marginBottom: 6, overflow: 'hidden', paddingVertical: 14 },
  bandTilt: { transform: [{ rotate: '-3deg' }], marginHorizontal: -30 },
  band: { paddingVertical: 12 },
  bandText: { fontFamily: fonts.display, fontSize: 18, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },

  empty: { alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSub, marginTop: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textHint },

  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 22, borderRadius: 28, overflow: 'hidden' },
  ctaEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  ctaTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: '#fff', letterSpacing: -0.6, marginTop: 4 },
  ctaArrow: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
