import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { getStoredUser, logout } from '../services/auth';
import { getUserPreferences } from '../services/category';
import { Restaurant, UserApp } from '../types';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Restaurants'> };

export default function RestaurantsScreen({ navigation }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserApp | null>(null);
  const [preferredIds, setPreferredIds] = useState<Set<number>>(new Set());

  async function fetchData(query?: string) {
    try {
      const [data, prefs] = await Promise.all([
        getPublicRestaurants(query),
        getUserPreferences().catch(() => []),
      ]);
      const prefItemIds = new Set(prefs.map((p: any) => p.id));
      setPreferredIds(prefItemIds as Set<number>);

      // Sort: restaurants matching user preferences first
      const sorted = [...data].sort((a, b) => {
        const aMatch = (a.category_items ?? []).some((id: number) => prefItemIds.has(id));
        const bMatch = (b.category_items ?? []).some((id: number) => prefItemIds.has(id));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
      setRestaurants(sorted);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os restaurantes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then(setUser);
      fetchData();
    }, [])
  );

  function onSearch() {
    setLoading(true);
    fetchData(search.trim() || undefined);
  }

  function onRefresh() {
    setRefreshing(true);
    setSearch('');
    fetchData();
  }

  async function handleLogout() {
    await logout();
    navigation.replace('Login');
  }

  function RestaurantCard({ item, index }: { item: Restaurant; index: number }) {
    const initials = item.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    const isMatch = preferredIds.size > 0 &&
      (item.category_items ?? []).some((id: number) => preferredIds.has(id));

    return (
      <View style={[styles.card, isMatch && styles.cardHighlight]}>
        {isMatch && (
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>✨ Combina com você</Text>
          </View>
        )}
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.address} numberOfLines={1}>📍 {item.address}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>📞</Text>
            <Text style={styles.metaText}>{item.contact_phone}</Text>
          </View>
          {!!item.instagram && (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📷</Text>
              <Text style={styles.metaText}>{item.instagram}</Text>
            </View>
          )}
          {!!item.site && (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>🌐</Text>
              <Text style={styles.metaText} numberOfLines={1}>{item.site}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  const greeting = user ? `Olá, ${user.first_name}! 👋` : 'Restaurantes';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>🍽️ VYU</Text>
            <Text style={styles.headerSub}>{greeting}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.iconBtnText}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar restaurante..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={onSearch} style={styles.searchBtn} activeOpacity={0.8}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!loading && restaurants.length > 0 && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} encontrado{restaurants.length !== 1 ? 's' : ''}
            {preferredIds.size > 0 ? ' · ordenado por preferência' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3f51b5" />
          <Text style={styles.loadingText}>Carregando restaurantes...</Text>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <RestaurantCard item={item} index={index} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3f51b5']} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyTitle}>Nenhum restaurante encontrado</Text>
              <Text style={styles.emptySubtitle}>Tente buscar por outro nome</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#c5cae9', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  iconBtnText: { fontSize: 18 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchBtnText: { fontSize: 18 },

  countBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 },
  countText: { fontSize: 12, color: '#6b7280', fontWeight: '600', letterSpacing: 0.3 },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  cardHighlight: {
    borderWidth: 2,
    borderColor: '#3f51b5',
  },
  matchBadge: {
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeText: { fontSize: 12, color: '#3f51b5', fontWeight: '700' },

  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardInfo: { flex: 1 },
  restaurantName: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginBottom: 3 },
  address: { fontSize: 12, color: '#6b7280' },

  cardDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  cardMeta: { padding: 12, paddingHorizontal: 16, gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 13 },
  metaText: { fontSize: 12, color: '#6b7280', flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: '#9ca3af' },
});
