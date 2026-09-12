import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Linking, Platform, TextInput, Modal, KeyboardAvoidingView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { getRestaurantReviews, createReview } from '../services/restaurant';
import { Review } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'RestaurantDetail'>;
  route: RouteProp<RootStackParamList, 'RestaurantDetail'>;
};

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
          <View style={styles.nameRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {restaurant.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </Text>
            </View>
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

          {hasCoords && (
            <TouchableOpacity style={styles.directionsFullBtn} onPress={showDirectionsAlert} activeOpacity={0.8}>
              <MaterialIcons name="directions" size={18} color="#fff" />
              <Text style={styles.directionsFullText}>Como chegar</Text>
            </TouchableOpacity>
          )}
        </View>

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
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewUser}>{r.user_name}</Text>
                  <StarRow value={r.stars} size={14} />
                </View>
                {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Text>
                {!!r.manager_response && (
                  <View style={styles.managerResponse}>
                    <Text style={styles.managerResponseLabel}>Resposta do estabelecimento:</Text>
                    <Text style={styles.managerResponseText}>{r.manager_response}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

  directionsFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ACCENT,
    paddingVertical: 12, borderRadius: 12,
  },
  directionsFullText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
});
