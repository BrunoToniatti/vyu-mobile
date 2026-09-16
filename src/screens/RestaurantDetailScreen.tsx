import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Linking, Platform, TextInput, Modal, KeyboardAvoidingView, Image, SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { getRestaurantReviews, createReview, createReservation } from '../services/restaurant';
import { Review, RestaurantQueue } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'RestaurantDetail'>;
  route: RouteProp<RootStackParamList, 'RestaurantDetail'>;
};

const OCC_COLORS = {
  low:    { bar: '#43a047', bg: '#e8f5e9', text: '#2e7d32', label: 'Baixo' },
  medium: { bar: '#fb8c00', bg: '#fff8e1', text: '#e65100', label: 'Médio' },
  high:   { bar: '#e53935', bg: '#ffebee', text: '#b71c1c', label: 'Cheio' },
};

function QueueCard({ queue }: { queue: RestaurantQueue }) {
  const pct = !queue.max_tables ? 0 : Math.min(100, Math.round((queue.current_tables / queue.max_tables) * 100));
  const level: 'low' | 'medium' | 'high' = pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high';
  const colors = OCC_COLORS[level];

  const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    OPEN:   { icon: 'lock-open', color: '#2e7d32', label: 'Fila Aberta' },
    CLOSED: { icon: 'lock',     color: '#c62828', label: 'Fila Fechada' },
    PAUSED: { icon: 'pause-circle-outline', color: '#e65100', label: 'Fila Pausada' },
  };
  const statusCfg = STATUS_CONFIG[queue.status] ?? STATUS_CONFIG['OPEN'];

  return (
    <View style={queueStyles.card}>
      {/* Header */}
      <View style={queueStyles.header}>
        <MaterialIcons name="people-alt" size={18} color="#1a237e" />
        <Text style={queueStyles.title}>Situação da Fila</Text>
        <View style={[queueStyles.statusBadge, { backgroundColor: statusCfg.color + '22' }]}>
          <MaterialIcons name={statusCfg.icon as any} size={13} color={statusCfg.color} />
          <Text style={[queueStyles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {queue.status !== 'CLOSED' && queue.max_tables > 0 && (
        <>
          {/* Occupancy bar */}
          <View style={queueStyles.section}>
            <View style={queueStyles.pctRow}>
              <Text style={[queueStyles.pct, { color: colors.bar }]}>{pct}%</Text>
              <View style={[queueStyles.levelBadge, { backgroundColor: colors.bg }]}>
                <Text style={[queueStyles.levelText, { color: colors.text }]}>{colors.label}</Text>
              </View>
            </View>
            <View style={queueStyles.barTrack}>
              <View style={[queueStyles.barFill, { width: `${pct}%` as any, backgroundColor: colors.bar }]} />
            </View>
            <View style={queueStyles.scaleRow}>
              <Text style={queueStyles.scaleLabel}>0%</Text>
              <Text style={queueStyles.scaleLabel}>50%</Text>
              <Text style={queueStyles.scaleLabel}>100%</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={queueStyles.statsRow}>
            <View style={queueStyles.stat}>
              <MaterialIcons name="table-restaurant" size={20} color="#3f51b5" />
              <Text style={queueStyles.statValue}>{queue.current_tables}/{queue.max_tables}</Text>
              <Text style={queueStyles.statLabel}>Mesas</Text>
            </View>
            <View style={queueStyles.statDivider} />
            <View style={queueStyles.stat}>
              <MaterialIcons name="people" size={20} color="#3f51b5" />
              <Text style={queueStyles.statValue}>{queue.current_size}</Text>
              <Text style={queueStyles.statLabel}>Na fila</Text>
            </View>
            {queue.estimated_wait_minutes > 0 && (
              <>
                <View style={queueStyles.statDivider} />
                <View style={queueStyles.stat}>
                  <MaterialIcons name="schedule" size={20} color="#f57f17" />
                  <Text style={[queueStyles.statValue, { color: '#f57f17' }]}>{queue.estimated_wait_minutes} min</Text>
                  <Text style={queueStyles.statLabel}>Espera</Text>
                </View>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const queueStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a237e' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  section: { gap: 6 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pct: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  levelBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  levelText: { fontSize: 13, fontWeight: '700' },
  barTrack: {
    height: 14, backgroundColor: '#e5e7eb', borderRadius: 7, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 7 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { fontSize: 10, color: '#9ca3af' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8f9ff', borderRadius: 12, padding: 14, gap: 0,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 17, fontWeight: '800', color: '#1a237e' },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  statDivider: { width: 1, height: 40, backgroundColor: '#e5e7eb' },
});

function StarRow({ value, onPress, size = 28 }: { value: number; onPress?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onPress?.(s)} disabled={!onPress} activeOpacity={0.7}>
          <MaterialIcons
            name={s <= value ? 'star' : 'star-border'}
            size={size}
            color={s <= value ? '#FFC107' : '#d1d5db'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RestaurantDetailScreen({ navigation, route }: Props) {
  const { restaurant } = route.params;
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profileReview, setProfileReview] = useState<Review | null>(null);

  // Reservation modal — 2-step flow
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [resStep, setResStep] = useState<'calendar' | 'details'>('calendar');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [resDate, setResDate] = useState('');   // YYYY-MM-DD
  const [resTime, setResTime] = useState('');
  const [resPartySize, setResPartySize] = useState(2);
  const [resNotes, setResNotes] = useState('');
  const [submittingRes, setSubmittingRes] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function openReservationModal() {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setResDate('');
    setResTime('');
    setResPartySize(2);
    setResNotes('');
    setResStep('calendar');
    setShowReservationModal(true);
  }

  function closeReservationModal() {
    setShowReservationModal(false);
  }

  function selectDay(dateStr: string) {
    setResDate(dateStr);
    setResStep('details');
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  // Build calendar grid for current calYear/calMonth
  function buildCalendarDays(): (string | null)[] {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push(`${calYear}-${mm}-${dd}`);
    }
    return cells;
  }

  function isPast(dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt < today;
  }

  function formatSelectedDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  const hasCoords = restaurant.latitude && restaurant.longitude;

  const miniMapHtml = hasCoords ? `
<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}</style>
</head><body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false})
      .setView([${restaurant.latitude},${restaurant.longitude}],16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    var icon = L.divIcon({
      className:'',
      html:'<div style="width:36px;height:36px;border-radius:50%;background:#e53935;border:3px solid #fff;box-shadow:0 2px 8px rgba(229,57,53,0.6);display:flex;align-items:center;justify-content:center;font-size:18px;">🍽️</div>',
      iconSize:[36,36],iconAnchor:[18,18]
    });
    L.marker([${restaurant.latitude},${restaurant.longitude}],{icon}).addTo(map).bindPopup('${restaurant.name.replace(/'/g, "\\'")}').openPopup();
  </script>
</body></html>` : '';

  useEffect(() => {
    getRestaurantReviews(restaurant.id)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, []);

  function openDirections(app: 'maps' | 'waze') {
    const { latitude: lat, longitude: lng } = restaurant;
    if (!lat || !lng) return;
    const url = app === 'waze'
      ? `waze://?ll=${lat},${lng}&navigate=yes`
      : Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(restaurant.name)})`;
    Linking.openURL(url).catch(() => {
      const fallback = `https://maps.google.com/maps?daddr=${lat},${lng}`;
      Linking.openURL(fallback);
    });
  }

  function showDirectionsAlert() {
    Alert.alert('Como chegar', 'Abrir com qual aplicativo?', [
      { text: 'Google Maps', onPress: () => openDirections('maps') },
      { text: 'Waze', onPress: () => openDirections('waze') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function submitReservation() {
    if (!resDate || !resTime) {
      Alert.alert('Reserva', 'Informe o horário.');
      return;
    }
    setSubmittingRes(true);
    try {
      await createReservation(restaurant.id, {
        date: resDate,
        time: resTime,
        party_size: resPartySize,
        notes: resNotes.trim(),
      });
      setShowReservationModal(false);
      Alert.alert('Reserva confirmada! 🎉', `Reserva para ${formatSelectedDate(resDate)} registrada com sucesso.`);
    } catch (err: any) {
      const msg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Não foi possível fazer a reserva.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingRes(false);
    }
  }

  async function submitReview() {
    if (selectedStars === 0) {
      Alert.alert('Avaliação', 'Selecione pelo menos 1 estrela.');
      return;
    }
    setSubmitting(true);
    try {
      const review = await createReview(restaurant.id, selectedStars, comment.trim());
      setReviews((prev) => [review, ...prev]);
      setShowReviewModal(false);
      setSelectedStars(0);
      setComment('');
    } catch (err: any) {
      const msg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Não foi possível enviar avaliação.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmitting(false);
    }
  }

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurant.name}</Text>
        {hasCoords && (
          <TouchableOpacity onPress={showDirectionsAlert} style={styles.directionsBtn} activeOpacity={0.8}>
            <MaterialIcons name="directions" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          {restaurant.photo_url ? (
            <Image source={{ uri: restaurant.photo_url }} style={styles.restaurantPhoto} resizeMode="cover" />
          ) : null}
          <View style={styles.nameRow}>
            {!restaurant.photo_url && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {restaurant.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              {averageRating !== null && (
                <View style={styles.ratingRow}>
                  <StarRow value={Math.round(averageRating)} size={16} />
                  <Text style={styles.ratingText}>{averageRating.toFixed(1)} ({reviews.length})</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={18} color="#3f51b5" />
              <Text style={styles.infoText}>{restaurant.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={18} color="#3f51b5" />
              <Text style={styles.infoText}>{restaurant.contact_phone}</Text>
            </View>
            {!!restaurant.site && (
              <View style={styles.infoRow}>
                <MaterialIcons name="language" size={18} color="#3f51b5" />
                <Text style={[styles.infoText, styles.link]} onPress={() => Linking.openURL(restaurant.site!)}>
                  {restaurant.site}
                </Text>
              </View>
            )}
            {!!restaurant.instagram && (
              <View style={styles.infoRow}>
                <MaterialIcons name="tag" size={18} color="#3f51b5" />
                <Text style={styles.infoText}>{restaurant.instagram}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            {hasCoords && (
              <TouchableOpacity style={styles.directionsFullBtn} onPress={showDirectionsAlert} activeOpacity={0.8}>
                <MaterialIcons name="directions" size={18} color="#fff" />
                <Text style={styles.directionsFullText}>Como chegar</Text>
              </TouchableOpacity>
            )}
            <View style={styles.actionRow2}>
              <TouchableOpacity
                style={[styles.chatBtn, { flex: 1 }]}
                onPress={() => navigation.navigate('Chat', { restaurant })}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text style={styles.chatBtnText}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reserveBtn, { flex: 1 }]}
                onPress={openReservationModal}
                activeOpacity={0.8}
              >
                <MaterialIcons name="event-seat" size={18} color="#fff" />
                <Text style={styles.chatBtnText}>Reservar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Queue Card */}
        {restaurant.queue && (
          <QueueCard queue={restaurant.queue} />
        )}

        {/* Mini Map */}
        {hasCoords && (
          <View style={styles.mapCard}>
            <WebView
              source={{ html: miniMapHtml }}
              style={styles.miniMap}
              originWhitelist={['*']}
              javaScriptEnabled
              scrollEnabled={false}
              pointerEvents="none"
            />
          </View>
        )}

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Avaliações</Text>
            <TouchableOpacity style={styles.addReviewBtn} onPress={() => setShowReviewModal(true)} activeOpacity={0.8}>
              <MaterialIcons name="rate-review" size={16} color="#3f51b5" />
              <Text style={styles.addReviewText}>Avaliar</Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <ActivityIndicator color="#3f51b5" style={{ marginVertical: 24 }} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <MaterialIcons name="star-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Nenhuma avaliação ainda.</Text>
              <Text style={styles.emptySubtext}>Seja o primeiro a avaliar!</Text>
            </View>
          ) : (
            reviews.map((r) => {
              const initials = r.user_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <TouchableOpacity style={styles.reviewUserRow} onPress={() => setProfileReview(r)} activeOpacity={0.75}>
                      {r.user_photo_url ? (
                        <Image source={{ uri: r.user_photo_url }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={styles.reviewAvatarFallback}>
                          <Text style={styles.reviewAvatarText}>{initials}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={[styles.reviewUser, styles.reviewUserLink]}>{r.user_name}</Text>
                        <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Text>
                      </View>
                    </TouchableOpacity>
                    <StarRow value={r.stars} size={14} />
                  </View>
                  {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  {!!r.manager_response && (
                    <View style={styles.managerResponse}>
                      <Text style={styles.managerResponseLabel}>Resposta do estabelecimento:</Text>
                      <Text style={styles.managerResponseText}>{r.manager_response}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* User Profile Modal */}
      <Modal visible={!!profileReview} animationType="slide" transparent onRequestClose={() => setProfileReview(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProfileReview(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.profileSheet}>
              <View style={styles.modalHandle} />
              {profileReview && (() => {
                const pr = profileReview;
                const pInitials = pr.user_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                const grouped = (pr.user_preferences ?? []).reduce((acc: Record<string, string[]>, p) => {
                  const cat = p.category || 'Outros';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(p.name);
                  return acc;
                }, {});
                return (
                  <>
                    <View style={styles.profileHero}>
                      {pr.user_photo_url ? (
                        <Image source={{ uri: pr.user_photo_url }} style={styles.profilePhoto} />
                      ) : (
                        <View style={styles.profileAvatar}>
                          <Text style={styles.profileAvatarText}>{pInitials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>{pr.user_name}</Text>
                        <Text style={styles.profileLabel}>Cliente</Text>
                      </View>
                    </View>

                    <View style={styles.profileDivider} />

                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>Dados pessoais</Text>
                      {!!pr.user_email && (
                        <View style={styles.profileInfoRow}>
                          <MaterialIcons name="email" size={16} color={ACCENT} />
                          <Text style={styles.profileInfoText}>{pr.user_email}</Text>
                        </View>
                      )}
                      {!!pr.user_phone && (
                        <View style={styles.profileInfoRow}>
                          <MaterialIcons name="phone" size={16} color={ACCENT} />
                          <Text style={styles.profileInfoText}>{pr.user_phone}</Text>
                        </View>
                      )}
                    </View>

                    {Object.keys(grouped).length > 0 && (
                      <>
                        <View style={styles.profileDivider} />
                        <View style={styles.profileSection}>
                          <Text style={styles.profileSectionTitle}>Preferências alimentares</Text>
                          {Object.entries(grouped).map(([cat, items]) => (
                            <View key={cat} style={{ marginBottom: 10 }}>
                              <Text style={styles.profileCatName}>{cat}</Text>
                              <View style={styles.profileChips}>
                                {(items as string[]).map((item) => (
                                  <View key={item} style={styles.profileChip}>
                                    <Text style={styles.profileChipText}>{item}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ))}
                        </View>
                      </>
                    )}

                    <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setProfileReview(null)} activeOpacity={0.8}>
                      <Text style={styles.profileCloseBtnText}>Fechar</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reservation Modal — Step 1: Calendar */}
      <Modal visible={showReservationModal && resStep === 'calendar'} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeReservationModal}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
          <View style={[styles.modalSheet, { paddingBottom: 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Escolha o dia</Text>
            <Text style={styles.modalSubtitle}>{restaurant.name}</Text>

            {/* Month nav */}
            <View style={calStyles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
                <MaterialIcons name="chevron-left" size={28} color="#1a237e" />
              </TouchableOpacity>
              <Text style={calStyles.monthLabel}>
                {new Date(calYear, calMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
                <MaterialIcons name="chevron-right" size={28} color="#1a237e" />
              </TouchableOpacity>
            </View>

            {/* Week day headers */}
            <View style={calStyles.weekRow}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <Text key={i} style={calStyles.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={calStyles.grid}>
              {buildCalendarDays().map((dateStr, i) => {
                if (!dateStr) return <View key={`e-${i}`} style={calStyles.dayCell} />;
                const past = isPast(dateStr);
                const day = parseInt(dateStr.split('-')[2], 10);
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const isToday = dateStr === todayStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[calStyles.dayCell, past && calStyles.dayCellPast, isToday && calStyles.dayCellToday]}
                    onPress={() => !past && selectDay(dateStr)}
                    activeOpacity={past ? 1 : 0.7}
                    disabled={past}
                  >
                    <Text style={[calStyles.dayText, past && calStyles.dayTextPast, isToday && calStyles.dayTextToday]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeReservationModal} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reservation Modal — Step 2: Details */}
      <Modal visible={showReservationModal && resStep === 'details'} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeReservationModal}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Back + title */}
            <View style={resStyles.detailsHeader}>
              <TouchableOpacity onPress={() => setResStep('calendar')} activeOpacity={0.7} style={resStyles.backBtn}>
                <MaterialIcons name="arrow-back" size={22} color="#1a237e" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Detalhes da Reserva</Text>
                {resDate ? <Text style={resStyles.selectedDate}>{formatSelectedDate(resDate)}</Text> : null}
              </View>
            </View>

            <View style={resStyles.fieldGroup}>
              <Text style={resStyles.label}>Horário</Text>
              <TextInput
                style={resStyles.input}
                placeholder="HH:MM"
                placeholderTextColor="#9ca3af"
                value={resTime}
                onChangeText={(v) => {
                  const t = v.replace(/\D/g, '').slice(0, 4);
                  setResTime(t.length > 2 ? t.slice(0, 2) + ':' + t.slice(2) : t);
                }}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <View style={resStyles.fieldGroup}>
              <Text style={resStyles.label}>Número de pessoas</Text>
              <View style={resStyles.counterRow}>
                <TouchableOpacity
                  style={resStyles.counterBtn}
                  onPress={() => setResPartySize(p => Math.max(1, p - 1))}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="remove" size={22} color="#3f51b5" />
                </TouchableOpacity>
                <Text style={resStyles.counterValue}>{resPartySize}</Text>
                <TouchableOpacity
                  style={resStyles.counterBtn}
                  onPress={() => setResPartySize(p => Math.min(20, p + 1))}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={22} color="#3f51b5" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={resStyles.fieldGroup}>
              <Text style={resStyles.label}>Observações (opcional)</Text>
              <TextInput
                style={[resStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Alergias, preferências..."
                placeholderTextColor="#9ca3af"
                multiline
                value={resNotes}
                onChangeText={setResNotes}
                maxLength={300}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeReservationModal} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !resTime && styles.submitBtnDisabled]}
                onPress={submitReservation}
                activeOpacity={0.8}
                disabled={submittingRes || !resTime}
              >
                {submittingRes
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Confirmar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent onRequestClose={() => { setShowReviewModal(false); }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowReviewModal(false); setSelectedStars(0); setComment(''); }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sua avaliação</Text>
            <Text style={styles.modalSubtitle}>{restaurant.name}</Text>

            <View style={styles.starsRow}>
              <StarRow value={selectedStars} onPress={setSelectedStars} size={40} />
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="Conte sua experiência (opcional)"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowReviewModal(false); setSelectedStars(0); setComment(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, selectedStars === 0 && styles.submitBtnDisabled]}
                onPress={submitReview}
                activeOpacity={0.8}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Enviar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const PRIMARY = '#1a237e';
const ACCENT = '#3f51b5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5fb' },

  header: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  directionsBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 8,
  },

  content: { padding: 16, paddingBottom: 40 },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  restaurantPhoto: {
    width: '100%', height: 180, borderRadius: 12,
    marginBottom: 14,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  restaurantName: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },

  infoList: { gap: 10, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  link: { color: ACCENT, textDecorationLine: 'underline' },

  actionButtons: { gap: 10, marginTop: 4 },
  directionsFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ACCENT,
    paddingVertical: 12, borderRadius: 12,
  },
  directionsFullText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionRow2: { flexDirection: 'row', gap: 10 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#2e7d32',
    paddingVertical: 12, borderRadius: 12,
  },
  reserveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1a237e',
    paddingVertical: 12, borderRadius: 12,
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  mapCard: {
    height: 200, borderRadius: 16, overflow: 'hidden',
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  miniMap: { flex: 1 },

  reviewsSection: { gap: 12 },
  reviewsHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: PRIMARY },
  addReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  addReviewText: { color: ACCENT, fontWeight: '600', fontSize: 13 },

  emptyReviews: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 13, color: '#d1d5db' },

  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12, padding: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 6,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reviewUserLink: { textDecorationLine: 'underline', textDecorationColor: PRIMARY },
  reviewAvatar: { width: 38, height: 38, borderRadius: 19 },
  reviewAvatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reviewUser: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  reviewComment: { fontSize: 14, color: '#374151', lineHeight: 20 },
  reviewDate: { fontSize: 11, color: '#9ca3af' },
  managerResponse: {
    backgroundColor: '#f0f4ff', borderRadius: 8, padding: 10, gap: 4,
    borderLeftWidth: 3, borderLeftColor: ACCENT,
  },
  managerResponseLabel: { fontSize: 11, fontWeight: '700', color: ACCENT },
  managerResponseText: { fontSize: 13, color: '#374151', lineHeight: 19 },

  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db',
    alignSelf: 'center', marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  starsRow: { alignItems: 'center', paddingVertical: 8 },
  commentInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#374151',
    minHeight: 100, textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
  submitBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, backgroundColor: ACCENT,
  },
  submitBtnDisabled: { backgroundColor: '#c5cae9' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Profile modal
  profileSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  profileHero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20,
    backgroundColor: PRIMARY,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  profilePhoto: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  profileLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  profileDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20 },
  profileSection: { padding: 18, gap: 10 },
  profileSectionTitle: { fontSize: 11, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileInfoText: { fontSize: 14, color: '#374151', flex: 1 },
  profileCatName: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  profileChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  profileChip: { backgroundColor: '#e8eaf6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  profileChipText: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  profileCloseBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  profileCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const resStyles = StyleSheet.create({
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  backBtn: { padding: 4 },
  selectedDate: { fontSize: 13, color: '#3f51b5', fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, fontSize: 15, color: '#1a237e', backgroundColor: '#f8f9ff',
  },
  counterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
    backgroundColor: '#f8f9ff', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e8eaf6', alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: 22, fontWeight: '800', color: '#1a237e', minWidth: 30, textAlign: 'center' },
});

const calStyles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    padding: 6, borderRadius: 20, backgroundColor: '#e8eaf6',
  },
  monthLabel: {
    fontSize: 16, fontWeight: '700', color: '#1a237e', textTransform: 'capitalize', flex: 1, textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row', marginBottom: 4,
  },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700',
    color: '#9ca3af', paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 100,
  },
  dayCellPast: { opacity: 0.3 },
  dayCellToday: { backgroundColor: '#e8eaf6' },
  dayText: { fontSize: 15, fontWeight: '600', color: '#1a237e' },
  dayTextPast: { color: '#9ca3af' },
  dayTextToday: { color: '#3f51b5', fontWeight: '800' },
});
