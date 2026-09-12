import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { MaterialIcons } from '@expo/vector-icons';
import { MainTabParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { getStoredUser, logout } from '../services/auth';
import { getAllCategories, getUserPreferences, CategoryItem, Category } from '../services/category';
import { Restaurant, UserApp } from '../types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Restaurants'>,
    StackNavigationProp<RootStackParamList>
  >;
};

export default function RestaurantsScreen({ navigation }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserApp | null>(null);
  const [preferredIds, setPreferredIds] = useState<Set<number>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Map<number, { name: string; categoryName: string }>>(new Map());

  async function fetchData() {
    try {
      const [data, prefs, categories] = await Promise.all([
        getPublicRestaurants(),
        getUserPreferences().catch(() => [] as CategoryItem[]),
        getAllCategories().catch(() => [] as Category[]),
      ]);

      // Build item id → { name, categoryName } map
      const map = new Map<number, { name: string; categoryName: string }>();
      categories.forEach((cat) => {
        cat.items.forEach((item) => {
          map.set(item.id, { name: item.name, categoryName: cat.name });
        });
      });
      setCategoryMap(map);

      const prefItemIds = new Set(prefs.map((p) => p.id));
      setPreferredIds(prefItemIds);

      const sorted = [...data].sort((a, b) => {
        const aMatch = (a.category_items ?? []).some((id) => prefItemIds.has(id));
        const bMatch = (b.category_items ?? []).some((id) => prefItemIds.has(id));
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

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  async function handleLogout() {
    await logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  function RestaurantCard({ item }: { item: Restaurant }) {
    const initials = item.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    const itemIds = item.category_items ?? [];
    const isMatch = preferredIds.size > 0 && itemIds.some((id) => preferredIds.has(id));

    return (
      <TouchableOpacity
        style={[styles.card, isMatch && styles.cardHighlight]}
        onPress={() => navigation.navigate('RestaurantDetail', { restaurant: item })}
        activeOpacity={0.85}
      >
        {/* Header do card */}
        <View style={styles.cardTop}>
          <View style={[styles.avatar, isMatch && styles.avatarMatch]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
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

        {/* Contatos */}
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

        {/* Categorias */}
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
                    {matched && (
                      <MaterialIcons name="check-circle" size={12} color="#3f51b5" style={{ marginRight: 3 }} />
                    )}
                    <Text style={[styles.tagText, matched && styles.tagTextMatched]}>
                      {info.name}
                    </Text>
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>VYU</Text>
            <Text style={styles.headerSub}>
              {user ? `Olá, ${user.first_name}!` : 'Restaurantes'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!loading && restaurants.length > 0 && (
          <Text style={styles.countText}>
            {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''}
            {preferredIds.size > 0 ? ' · ordenados por preferência' : ''}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3f51b5" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RestaurantCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3f51b5']} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="restaurant" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Nenhum restaurante encontrado</Text>
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
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#c5cae9', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  countText: { fontSize: 12, color: '#c5cae9', marginTop: 10, fontWeight: '500' },

  list: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHighlight: {
    borderWidth: 1.5,
    borderColor: ACCENT,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
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

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagMatched: {
    backgroundColor: '#e8eaf6',
    borderWidth: 1,
    borderColor: '#c5cae9',
  },
  tagText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  tagTextMatched: { color: ACCENT, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#9ca3af', marginTop: 12 },
});
