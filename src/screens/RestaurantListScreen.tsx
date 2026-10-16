import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { getAllCategories, getUserPreferences, CategoryItem, Category } from '../services/category';
import { Restaurant } from '../types';
import Aurora from '../components/Aurora';
import Glass from '../components/Glass';
import PressableScale from '../components/PressableScale';
import OccupancyBar from '../components/OccupancyBar';
import Skeleton from '../components/Skeleton';
import { useUI } from '../components/Dialog';
import { colors, fonts, gradients, initialsOf, occupancyOf } from '../theme';
import { ease, springTo, tween } from '../motion';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'RestaurantList'> };
type Filter = 'all' | 'match' | 'calm' | 'open' | 'top';
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Todos', icon: 'apps' },
  { key: 'match', label: 'Pra você', icon: 'favorite' },
  { key: 'calm', label: 'Tranquilos', icon: 'self-improvement' },
  { key: 'open', label: 'Abertos', icon: 'storefront' },
  { key: 'top', label: 'Bem avaliados', icon: 'star' },
];

function RestaurantCard({ item, index, isMatch, preferredIds, categoryMap, onPress }: {
  item: Restaurant;
  index: number;
  isMatch: boolean;
  preferredIds: Set<number>;
  categoryMap: Map<number, { name: string; categoryName: string }>;
  onPress: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 900, delay: Math.min(index, 8) * 70, easing: ease.out4, useNativeDriver: true }).start();
  }, [t, index]);

  const itemIds = item.category_items ?? [];
  const showQueue = !!item.queue && item.queue.status === 'OPEN' && item.queue.max_tables > 0;
  const occ = occupancyOf(item.queue);

  const inner = (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.thumb}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[colors.plum, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.thumbFallback]}>
              <Text style={styles.thumbInitials}>{initialsOf(item.name)}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.average_rating ? (
              <View style={styles.rating}>
                <MaterialIcons name="star" size={12} color={colors.gold} />
                <Text style={styles.ratingText}>{item.average_rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="place" size={12} color={colors.textHint} />
            <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>
          </View>
          <View style={styles.contactRow}>
            {!!item.contact_phone && (
              <View style={styles.metaRow}>
                <MaterialIcons name="call" size={12} color={colors.textHint} />
                <Text style={styles.meta}>{item.contact_phone}</Text>
              </View>
            )}
            {!!item.instagram && (
              <View style={styles.metaRow}>
                <MaterialIcons name="alternate-email" size={12} color={colors.textHint} />
                <Text style={styles.meta} numberOfLines={1}>{item.instagram.replace(/^@/, '')}</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialIcons name="arrow-outward" size={20} color={colors.textHint} />
      </View>

      {showQueue && (
        <View style={styles.queue}>
          <OccupancyBar pct={occ.pct} level={occ.level} delay={300 + Math.min(index, 8) * 70} />
        </View>
      )}

      {itemIds.length > 0 && (
        <View style={styles.tags}>
          {itemIds.map(id => {
            const info = categoryMap.get(id);
            if (!info) return null;
            const matched = preferredIds.has(id);
            return (
              <View key={id} style={[styles.tag, matched && styles.tagOn]}>
                {matched && <MaterialIcons name="check" size={11} color={colors.cyan} />}
                <Text style={[styles.tagText, matched && { color: colors.cyan }]}>{info.name}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View
      style={{
        opacity: t,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <PressableScale onPress={onPress} scaleTo={0.97}>
        {isMatch ? (
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.matchBorder}>
            <View style={styles.matchInner}>{inner}</View>
          </LinearGradient>
        ) : (
          <Glass style={{ borderRadius: 26 }}>{inner}</Glass>
        )}
      </PressableScale>
    </Animated.View>
  );
}

function FilterChip({ f, active, onPress }: { f: typeof FILTERS[number]; active: boolean; onPress: () => void }) {
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    springTo(on, active ? 1 : 0, { bounce: 0.5, duration: 480 }).start();
  }, [active, on]);
  return (
    <PressableScale onPress={onPress} feedback="select" scaleTo={0.9} style={styles.filter}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: on, transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
      </Animated.View>
      <MaterialIcons name={f.icon} size={15} color={active ? '#fff' : colors.textSub} />
      <Text style={[styles.filterText, active && { color: '#fff' }]}>{f.label}</Text>
    </PressableScale>
  );
}

export default function RestaurantListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [focused, setFocused] = useState(false);
  const [preferredIds, setPreferredIds] = useState<Set<number>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Map<number, { name: string; categoryName: string }>>(new Map());
  const scrollY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    tween(glow, focused ? 1 : 0, { duration: 300 }).start();
  }, [focused, glow]);

  async function fetchData() {
    try {
      const [data, prefs, categories] = await Promise.all([
        getPublicRestaurants(),
        getUserPreferences().catch(() => [] as CategoryItem[]),
        getAllCategories().catch(() => [] as Category[]),
      ]);
      const map = new Map<number, { name: string; categoryName: string }>();
      categories.forEach(cat => cat.items.forEach(item => map.set(item.id, { name: item.name, categoryName: cat.name })));
      setCategoryMap(map);

      const prefItemIds = new Set(prefs.map(p => p.id));
      setPreferredIds(prefItemIds);
      setRestaurants(
        [...data].sort((a, b) => {
          const aM = (a.category_items ?? []).some(id => prefItemIds.has(id));
          const bM = (b.category_items ?? []).some(id => prefItemIds.has(id));
          return aM === bM ? 0 : aM ? -1 : 1;
        }),
      );
    } catch {
      ui.alert({ tone: 'danger', title: 'Ops', message: 'Não foi possível carregar os restaurantes.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const isMatch = (r: Restaurant) => preferredIds.size > 0 && (r.category_items ?? []).some(id => preferredIds.has(id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants.filter(r => {
      if (q && !(r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q))) return false;
      switch (filter) {
        case 'match': return isMatch(r);
        case 'calm': return !!r.queue?.max_tables && occupancyOf(r.queue).level === 'low';
        case 'open': return r.queue?.status === 'OPEN';
        case 'top': return (r.average_rating ?? 0) >= 4;
        default: return true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, search, filter, preferredIds]);

  const titleScale = scrollY.interpolate({ inputRange: [-80, 0, 120], outputRange: [1.15, 1, 0.72], extrapolate: 'clamp' });
  const titleShift = scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, -18], extrapolate: 'clamp' });

  return (
    <Aurora intensity="calm" sparkles={6}>
      <View style={{ paddingTop: insets.top + 10 }}>
        <View style={styles.topRow}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} scaleTo={0.88} accessibilityLabel="Voltar">
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </PressableScale>
          <Text style={styles.count}>
            <Text style={{ color: colors.cyan }}>{filtered.length}</Text> lugar{filtered.length !== 1 ? 'es' : ''}
          </Text>
        </View>
        <Animated.Text style={[styles.title, { transform: [{ translateY: titleShift }, { scale: titleScale }] }]}>
          Explorar
        </Animated.Text>

        <View style={styles.searchWrap}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: -1.5, opacity: glow }]}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 24 }} />
          </Animated.View>
          <View style={styles.search}>
            <MaterialIcons name="search" size={22} color={focused ? colors.cyan : colors.textHint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome ou endereço"
              placeholderTextColor={colors.textHint}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              selectionColor={colors.cyan}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {!!search && (
              <PressableScale onPress={() => setSearch('')} style={styles.clear} scaleTo={0.8} accessibilityLabel="Limpar busca">
                <MaterialIcons name="close" size={16} color={colors.text} />
              </PressableScale>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(f => (
            <FilterChip key={f.key} f={f} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} style={{ height: 130, borderRadius: 26, marginBottom: 12 }} delay={i * 120} />)}
        </View>
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item, index }) => (
            <RestaurantCard
              item={item}
              index={index}
              isMatch={isMatch(item)}
              preferredIds={preferredIds}
              categoryMap={categoryMap}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurant: item })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={colors.cyan}
              colors={[colors.purple, colors.cyan]}
              progressBackgroundColor={colors.night}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name={search ? 'search-off' : 'restaurant'} size={44} color={colors.textHint} />
              <Text style={styles.emptyTitle}>{search || filter !== 'all' ? 'Nada por aqui' : 'Nenhum restaurante disponível'}</Text>
              {(search || filter !== 'all') && <Text style={styles.emptySub}>Tente outro termo ou filtro.</Text>}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Aurora>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  count: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSub },
  title: {
    fontFamily: fonts.display, fontSize: 48, letterSpacing: -2, color: colors.text,
    paddingHorizontal: 20, marginTop: 12, transformOrigin: 'left center',
  },
  searchWrap: { marginHorizontal: 20, marginTop: 6, borderRadius: 24 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 16, borderRadius: 23,
    backgroundColor: '#150E33', borderWidth: 1, borderColor: colors.glassLine,
  },
  searchInput: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text, outlineStyle: 'none' } as any,
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  filter: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, overflow: 'hidden',
  },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSub },
  list: { paddingHorizontal: 20, paddingTop: 4 },

  matchBorder: { borderRadius: 26, padding: 1.5 },
  matchInner: { borderRadius: 25, backgroundColor: '#140D31', overflow: 'hidden' },
  card: { padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 72, height: 72, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.night },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbInitials: { fontFamily: fonts.display, fontSize: 26, color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.gold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  meta: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textHint },
  contactRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  queue: { paddingTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.glassLine,
  },
  tagOn: { backgroundColor: 'rgba(100,235,226,0.1)', borderColor: 'rgba(100,235,226,0.4)' },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textSub },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textSub },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textHint },
});
