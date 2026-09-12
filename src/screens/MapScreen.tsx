import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPublicRestaurants } from '../services/restaurant';
import { Restaurant } from '../types';

type Status = 'loading' | 'denied' | 'ready';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  async function requestLocation() {
    setStatus('loading');
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') { setStatus('denied'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    setStatus('ready');
  }

  useEffect(() => { requestLocation(); }, []);

  useEffect(() => {
    getPublicRestaurants().then(setRestaurants).catch(() => {});
  }, []);

  function openSettings() {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  }

  const restaurantsWithCoords = restaurants.filter(r => r.latitude && r.longitude);

  const restaurantsJson = JSON.stringify(
    restaurantsWithCoords.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.contact_phone,
      instagram: r.instagram ?? '',
      lat: r.latitude,
      lng: r.longitude,
    }))
  );

  const mapHtml = coords ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }

    .popup-content { font-family: -apple-system, sans-serif; min-width: 180px; }
    .popup-name { font-size: 14px; font-weight: 700; color: #1a237e; margin-bottom: 6px; }
    .popup-row { display: flex; align-items: flex-start; gap: 4px; margin-bottom: 4px; font-size: 12px; color: #555; }
    .popup-icon { font-size: 13px; flex-shrink: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${coords.lat}, ${coords.lng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Marcador do usuário
    var userIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#1a237e;border:3px solid #fff;box-shadow:0 2px 8px rgba(26,35,126,0.5);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([${coords.lat}, ${coords.lng}], { icon: userIcon })
      .addTo(map)
      .bindPopup('<b>Você está aqui</b>');

    // Marcadores dos restaurantes
    var restaurantIcon = L.divIcon({
      className: '',
      html: '<div style="width:32px;height:32px;border-radius:50%;background:#e53935;border:3px solid #fff;box-shadow:0 2px 8px rgba(229,57,53,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">🍽️</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });

    var restaurants = ${restaurantsJson};

    restaurants.forEach(function(r) {
      var instagramRow = r.instagram
        ? '<div class="popup-row"><span class="popup-icon">📸</span><span>' + r.instagram + '</span></div>'
        : '';
      var popup = '<div class="popup-content">'
        + '<div class="popup-name">' + r.name + '</div>'
        + '<div class="popup-row"><span class="popup-icon">📍</span><span>' + r.address + '</span></div>'
        + '<div class="popup-row"><span class="popup-icon">📞</span><span>' + r.phone + '</span></div>'
        + instagramRow
        + '</div>';

      L.marker([r.lat, r.lng], { icon: restaurantIcon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 240 });
    });
  </script>
</body>
</html>
` : '';

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a237e" />
        <Text style={styles.loadingText}>Obtendo localização...</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={[styles.blockedContainer, { paddingTop: insets.top + 20 }]}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="location-off" size={48} color="#9ca3af" />
        </View>
        <Text style={styles.blockedTitle}>Localização bloqueada</Text>
        <Text style={styles.blockedText}>
          Precisamos da sua localização para mostrar o mapa e os restaurantes próximos a você.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation} activeOpacity={0.8}>
          <MaterialIcons name="my-location" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Permitir localização</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={openSettings} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Abrir configurações</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1a237e" />
          </View>
        )}
      />

      <View style={[styles.myLocationBadge, { top: insets.top + 12 }]}>
        <MaterialIcons name="my-location" size={14} color="#1a237e" />
        <Text style={styles.myLocationText}>Você está aqui</Text>
      </View>

      {restaurantsWithCoords.length > 0 && (
        <View style={[styles.restaurantsBadge, { top: insets.top + 12 }]}>
          <MaterialIcons name="restaurant" size={14} color="#e53935" />
          <Text style={styles.restaurantsText}>{restaurantsWithCoords.length} restaurante{restaurantsWithCoords.length !== 1 ? 's' : ''}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5fb',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },

  blockedContainer: {
    flex: 1, backgroundColor: '#f4f5fb',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 80,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  blockedTitle: { fontSize: 22, fontWeight: '700', color: '#1a237e', marginBottom: 12, textAlign: 'center' },
  blockedText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a237e',
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 14, marginBottom: 12, width: '100%', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 12, paddingHorizontal: 28,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#d1d5db',
    width: '100%', alignItems: 'center',
  },
  secondaryBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },

  mapContainer: { flex: 1 },
  map: { flex: 1 },

  myLocationBadge: {
    position: 'absolute', left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  myLocationText: { fontSize: 12, fontWeight: '600', color: '#1a237e' },

  restaurantsBadge: {
    position: 'absolute', right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  restaurantsText: { fontSize: 12, fontWeight: '600', color: '#e53935' },
});
