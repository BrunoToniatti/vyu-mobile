import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Platform, Image, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList } from '../../App';
import { getPublicRestaurants, getMyReservations, MyReservation } from '../services/restaurant';
import { getStoredUser, logout } from '../services/auth';
import { getAllCategories, getUserPreferences, CategoryItem, Category } from '../services/category';
import { Restaurant, RestaurantQueue, UserApp } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Restaurants'>,
    StackNavigationProp<RootStackParamList>
  >;
};

const OCC_COLORS = {
  low:    { bar: '#43a047', bg: '#e8f5e9', text: '#2e7d32', label: 'Baixo' },
  medium: { bar: '#fb8c00', bg: '#fff8e1', text: '#e65100', label: 'Médio' },
  high:   { bar: '#e53935', bg: '#ffebee', text: '#b71c1c', label: 'Cheio' },
};

const RES_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:    { label: 'Pendente',           color: '#f57f17', bg: '#fff8e1', icon: 'hourglass-empty' },
  CONFIRMED:  { label: 'Confirmada',         color: '#2e7d32', bg: '#e8f5e9', icon: 'check-circle' },
  CHECKED_IN: { label: 'Check-in realizado', color: '#6a1b9a', bg: '#f3e5f5', icon: 'place' },
  CANCELLED:  { label: 'Cancelada',          color: '#c62828', bg: '#ffebee', icon: 'cancel' },
  COMPLETED:  { label: 'Concluída',          color: '#1565c0', bg: '#e3f2fd', icon: 'done-all' },
};

function getOccupancyLevel(q: RestaurantQueue): 'low' | 'medium' | 'high' {
  if (!q.max_tables) return 'low';
  const pct = Math.min(100, Math.round((q.current_tables / q.max_tables) * 100));
  return pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high';
}

function CarouselCard({ item, onPress }: { item: Restaurant; onPress: () => void }) {
  const initials = item.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const level = item.queue ? getOccupancyLevel(item.queue) : null;
  const occ = level ? OCC_COLORS[level] : null;
  const pct = item.queue?.max_tables
    ? Math.min(100, Math.round((item.queue.current_tables / item.queue.max_tables) * 100))
    : 0;

  return (
    <TouchableOpacity style={carouselStyles.card} onPress={onPress} activeOpacity={0.9}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={carouselStyles.photo} resizeMode="cover" />
      ) : (
        <View style={carouselStyles.photoFallback}>
          <Text style={carouselStyles.photoFallbackText}>{initials}</Text>
        </View>
      )}
      <View style={carouselStyles.info}>
        <Text style={carouselStyles.name} numberOfLines={1}>{item.name}</Text>
        <View style={carouselStyles.addressRow}>
          <MaterialIcons name="location-on" size={13} color="#9ca3af" />
          <Text style={carouselStyles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        {occ && item.queue && (
          <View style={carouselStyles.occRow}>
            <MaterialIcons name="people" size={13} color={occ.text} />
            <View style={carouselStyles.barTrack}>
              <View style={[carouselStyles.barFill, { width: `${pct}%` as any, backgroundColor: occ.bar }]} />
            </View>
            <View style={[carouselStyles.occBadge, { backgroundColor: occ.bg }]}>
              <Text style={[carouselStyles.occText, { color: occ.text }]}>{occ.label}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const carouselStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 8,
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 150 },
  photoFallback: {
    width: '100%', height: 150,
    backgroundColor: '#3f51b5',
    alignItems: 'center', justifyContent: 'center',
  },
  photoFallbackText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  info: { padding: 14, gap: 6 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a237e' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  address: { fontSize: 12, color: '#9ca3af', flex: 1 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  barTrack: { flex: 1, height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  occBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  occText: { fontSize: 11, fontWeight: '700' },
});

function ReservationMiniCard({ r, onPress }: { r: MyReservation; onPress: () => void }) {
  const cfg = RES_STATUS[r.status] ?? RES_STATUS['PENDING'];
  const [dd, mm] = r.date.split('-').slice(1).reverse();
  return (
    <TouchableOpacity style={[resMiniStyles.card, { borderLeftColor: cfg.color }]} onPress={onPress} activeOpacity={0.85}>
      <View style={resMiniStyles.dateBox}>
        <Text style={[resMiniStyles.day, { color: cfg.color }]}>{dd}</Text>
        <Text style={resMiniStyles.month}>/{mm}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={resMiniStyles.restName} numberOfLines={1}>{r.restaurant_name}</Text>
        <Text style={resMiniStyles.time}>{r.time.slice(0, 5)} · {r.party_size} {r.party_size === 1 ? 'pessoa' : 'pessoas'}</Text>
      </View>
      <View style={[resMiniStyles.badge, { backgroundColor: cfg.bg }]}>
        <MaterialIcons name={cfg.icon as any} size={13} color={cfg.color} />
        <Text style={[resMiniStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const resMiniStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 4,
    marginBottom: 8,
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  dateBox: { flexDirection: 'row', alignItems: 'baseline' },
  day: { fontSize: 22, fontWeight: '800' },
  month: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  restName: { fontSize: 14, fontWeight: '700', color: '#1a237e' },
  time: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

export default function RestaurantsScreen({ navigation }: Props) {
  const [user, setUser] = useState<UserApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [carouselRestaurants, setCarouselRestaurants] = useState<Restaurant[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<MyReservation[]>([]);

  const carouselRef = useRef<ScrollView>(null);
  const carouselIdx = useRef(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCarousel(count: number) {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    if (count < 2) return;
    carouselTimer.current = setInterval(() => {
      const next = (carouselIdx.current + 1) % count;
      carouselRef.current?.scrollTo({ x: next * (CARD_W + 16), animated: true });
      carouselIdx.current = next;
    }, 3500);
  }

  async function fetchData() {
    try {
      const [u, data, prefs, cats, reservations] = await Promise.all([
        getStoredUser(),
        getPublicRestaurants(),
        getUserPreferences().catch(() => [] as CategoryItem[]),
        getAllCategories().catch(() => [] as Category[]),
        getMyReservations().catch(() => [] as MyReservation[]),
      ]);
      setUser(u);

      // Build preferred item ids
      const prefItemIds = new Set(prefs.map((p) => p.id));

      // Sort restaurants: matched first
      const sorted = [...data].sort((a, b) => {
        const aM = (a.category_items ?? []).some((id) => prefItemIds.has(id));
        const bM = (b.category_items ?? []).some((id) => prefItemIds.has(id));
        return aM === bM ? 0 : aM ? -1 : 1;
      });

      // Carousel: top 3
      const top3 = sorted.slice(0, 3);
      setCarouselRestaurants(top3);
      startCarousel(top3.length);

      // Upcoming reservations: PENDING or CONFIRMED, date >= today
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const upcoming = reservations
        .filter((r) => ['PENDING', 'CONFIRMED'].includes(r.status) && r.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      setUpcomingReservations(upcoming);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
      return () => {
        if (carouselTimer.current) clearInterval(carouselTimer.current);
      };
    }, [])
  );

  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {user ? `Olá, ${user.first_name}! 👋` : 'VYU'}
          </Text>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={async () => { await logout(); navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] }); }}
          style={styles.logoutBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Upcoming reservations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={20} color="#1a237e" />
            <Text style={styles.sectionTitle}>Próximas Reservas</Text>
          </View>
          {loading ? (
            <ActivityIndicator color="#3f51b5" style={{ marginVertical: 16 }} />
          ) : upcomingReservations.length === 0 ? (
            <View style={styles.emptyReservations}>
              <MaterialIcons name="event-available" size={36} color="#c5cae9" />
              <Text style={styles.emptyText}>Nenhuma reserva próxima</Text>
              <Text style={styles.emptySubtext}>Explore restaurantes e faça uma reserva!</Text>
            </View>
          ) : (
            upcomingReservations.map((r) => (
              <ReservationMiniCard
                key={r.id}
                r={r}
                onPress={() => navigation.navigate('Profile' as any)}
              />
            ))
          )}
        </View>

        {/* Carousel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="stars" size={20} color="#1a237e" />
            <Text style={styles.sectionTitle}>Restaurantes para você</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#3f51b5" style={{ marginVertical: 24 }} />
          ) : carouselRestaurants.length === 0 ? (
            <View style={styles.emptyReservations}>
              <MaterialIcons name="restaurant" size={36} color="#c5cae9" />
              <Text style={styles.emptyText}>Nenhum restaurante disponível</Text>
            </View>
          ) : (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={CARD_W + 16}
              snapToAlignment="start"
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {carouselRestaurants.map((r) => (
                <CarouselCard
                  key={r.id}
                  item={r}
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurant: r })}
                />
              ))}
            </ScrollView>
          )}

          {/* Dots */}
          {carouselRestaurants.length > 1 && (
            <View style={styles.dots}>
              {carouselRestaurants.map((_, i) => (
                <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* See all button */}
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => navigation.navigate('RestaurantList' as any)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="restaurant" size={20} color="#3f51b5" />
          <Text style={styles.seeAllText}>Ver todos os restaurantes</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#3f51b5" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const PRIMARY = '#1a237e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5fb' },

  header: {
    backgroundColor: PRIMARY,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  dateLabel: { fontSize: 12, color: '#c5cae9', marginTop: 3, textTransform: 'capitalize' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  content: { padding: 16, paddingBottom: 110 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: PRIMARY },

  emptyReservations: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 12, color: '#d1d5db', textAlign: 'center' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c5cae9' },
  dotActive: { backgroundColor: PRIMARY, width: 18 },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#fff',
    paddingVertical: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#c5cae9',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  seeAllText: { fontSize: 15, fontWeight: '700', color: '#3f51b5' },
});
