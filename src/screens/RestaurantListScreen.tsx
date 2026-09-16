import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, StatusBar,
  Platform, Image, TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { getAllCategories, getUserPreferences, CategoryItem, Category } from '../services/category';
import { Restaurant, RestaurantQueue } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'RestaurantList'>;
};

function getOccupancyLevel(q: RestaurantQueue): 'low' | 'medium' | 'high' {
  if (!q.max_tables) return 'low';
  const pct = Math.min(100, Math.round((q.current_tables / q.max_tables) * 100));
  return pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high';
}

const OCC_COLORS = {
  low:    { bar: '#43a047', bg: '#e8f5e9', text: '#2e7d32', label: 'Baixo' },
  medium: { bar: '#fb8c00', bg: '#fff8e1', text: '#e65100', label: 'Médio' },
  high:   { bar: '#e53935', bg: '#ffebee', text: '#b71c1c', label: 'Cheio' },
};

function QueueMiniBar({ queue }: { queue: RestaurantQueue }) {
  const pct = !queue.max_tables ? 0 : Math.min(100, Math.round((queue.current_tables / queue.max_tables) * 100));
  const level = getOccupancyLevel(queue);
  const colors = OCC_COLORS[level];
  return (
    <View style={qStyles.container}>
      <View style={qStyles.divider} />
      <View style={qStyles.row}>
        <MaterialIcons name="people" size={13} color={colors.text} />
        <View style={qStyles.barTrack}>
          <View style={[qStyles.barFill, { width: `${pct}%` as any, backgroundColor: colors.bar }]} />
        </View>
        <View style={[qStyles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[qStyles.badgeText, { color: colors.text }]}>{pct}% · {colors.label}</Text>
        </View>
      </View>
    </View>
  );
}

const qStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 12 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

export default function RestaurantListScreen({ navigation }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filtered, setFiltered] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [preferredIds, setPreferredIds] = useState<Set<number>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Map<number, { name: string; categoryName: string }>>(new Map());

  async function fetchData() {
    try {
      const [data, prefs, categories] = await Promise.all([
        getPublicRestaurants(),
        getUserPreferences().catch(() => [] as CategoryItem[]),
        getAllCategories().catch(() => [] as Category[]),
      ]);
      const map = new Map<number, { name: string; categoryName: string }>();
      categories.forEach((cat) => {
        cat.items.forEach((item) => map.set(item.id, { name: item.name, categoryName: cat.name }));
      });
      setCategoryMap(map);
      const prefItemIds = new Set(prefs.map((p) => p.id));
      setPreferredIds(prefItemIds);
      const sorted = [...data].sort((a, b) => {
        const aM = (a.category_items ?? []).some((id) => prefItemIds.has(id));
        const bM = (b.category_items ?? []).some((id) => prefItemIds.has(id));
        return aM === bM ? 0 : aM ? -1 : 1;
      });
      setRestaurants(sorted);
      setFiltered(sorted);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os restaurantes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(restaurants); return; }
    const q = search.toLowerCase();
    setFiltered(restaurants.filter((r) =>
      r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q)
    ));
  }, [search, restaurants]);

  function RestaurantCard({ item }: { item: Restaurant }) {
    const initials = item.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const itemIds = item.category_items ?? [];
    const isMatch = preferredIds.size > 0 && itemIds.some((id) => preferredIds.has(id));

    return (
      <TouchableOpacity
        style={[styles.card, isMatch && styles.cardHighlight]}
        onPress={() => navigation.navigate('RestaurantDetail', { restaurant: item })}
        activeOpacity={0.85}
      >
        {!!item.photo_url && (
          <Image source={{ uri: item.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
        )}
        <View style={styles.cardTop}>
          {!item.photo_url && (
            <View style={[styles.avatar, isMatch && styles.avatarMatch]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={12} color="#9ca3af" />
              <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
          {isMatch && (
            <View style={styles.matchDot}>
              <MaterialIcons name="stars" size={18} color="#3f51b5" />
            </View>
          )}
        </View>
        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <MaterialIcons name="phone" size={13} color="#6b7280" />
            <Text style={styles.contactText}>{item.contact_phone}</Text>
          </View>
          {!!item.instagram && (
            <View style={styles.contactItem}>
              <MaterialIcons name="tag" size={13} color="#6b7280" />
              <Text style={styles.contactText}>{item.instagram}</Text>
            </View>
          )}
        </View>
        {item.queue && item.queue.status === 'OPEN' && item.queue.max_tables > 0 && (
          <QueueMiniBar queue={item.queue} />
        )}
        {itemIds.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.tagsContainer}>
              {itemIds.map((id) => {
                const info = categoryMap.get(id);
                if (!info) return null;
                const matched = preferredIds.has(id);
                return (
                  <View key={id} style={[styles.tag, matched && styles.tagMatched]}>
                    {matched && <MaterialIcons name="check-circle" size={12} color="#3f51b5" style={{ marginRight: 3 }} />}
                    <Text style={[styles.tagText, matched && styles.tagTextMatched]}>{info.name}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurantes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou endereço..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <MaterialIcons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {!loading && (
        <Text style={styles.countText}>
          {filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}
          {preferredIds.size > 0 ? ' · ordenados por preferência' : ''}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3f51b5" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RestaurantCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#3f51b5']} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="restaurant" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {search ? 'Nenhum resultado encontrado' : 'Nenhum restaurante disponível'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const PRIMARY = '#1a237e';
const ACCENT = '#3f51b5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5fb' },

  header: {
    backgroundColor: PRIMARY,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', margin: 12,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#374151' },
  countText: { fontSize: 12, color: '#9ca3af', paddingHorizontal: 16, paddingBottom: 4, fontWeight: '500' },

  list: { padding: 12, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardHighlight: { borderWidth: 1.5, borderColor: ACCENT },
  cardPhoto: { width: '100%', height: 140, borderRadius: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarMatch: { backgroundColor: PRIMARY },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardInfo: { flex: 1 },
  restaurantName: { fontSize: 15, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  address: { fontSize: 12, color: '#9ca3af', flex: 1 },
  matchDot: { paddingLeft: 4 },
  contactRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactText: { fontSize: 12, color: '#6b7280' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, paddingHorizontal: 16, gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  tagMatched: { backgroundColor: '#e8eaf6', borderWidth: 1, borderColor: '#c5cae9' },
  tagText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  tagTextMatched: { color: ACCENT, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#9ca3af', marginTop: 12, textAlign: 'center' },
});
