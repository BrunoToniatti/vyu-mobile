import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getPublicRestaurants } from '../services/restaurant';
import { Restaurant } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../../App';

type Status = 'loading' | 'denied' | 'ready';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Map'>,
    StackNavigationProp<RootStackParamList>
  >;
};

function buildMapHtml(
  lat: number,
  lng: number,
  restaurantsJson: string,
): string {
  // Leaflet CSS inlined to avoid CDN dependency for styles
  // JS still from CDN but guarded by window.onload to prevent race condition
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body,#map { width:100%; height:100%; background:#e8eaf6; }
    .popup-content { font-family:-apple-system,sans-serif; min-width:180px; }
    .popup-name { font-size:14px; font-weight:700; color:#1a237e; margin-bottom:6px; }
    .popup-row { display:flex; align-items:flex-start; gap:4px; margin-bottom:4px; font-size:12px; color:#555; }
    .popup-icon { font-size:13px; flex-shrink:0; }
    .queue-section { margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; }
    .queue-bar-track { width:100%; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden; margin:4px 0; }
    .queue-bar-fill { height:100%; border-radius:3px; }
    .queue-info-row { display:flex; align-items:center; justify-content:space-between; font-size:11px; }
    .queue-pct { font-weight:700; }
    .queue-badge { border-radius:20px; padding:2px 8px; font-size:11px; font-weight:700; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <script>
    // Guard: retry until Leaflet is available (handles slow CDN)
    function initMap() {
      if (typeof L === 'undefined') {
        setTimeout(initMap, 100);
        return;
      }

      var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      var userIcon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#1a237e;border:3px solid #fff;box-shadow:0 2px 8px rgba(26,35,126,0.5);"></div>',
        iconSize: [18,18], iconAnchor: [9,9],
      });
      L.marker([${lat}, ${lng}], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Você está aqui</b>');

      var restaurantIcon = L.divIcon({
        className: '',
        html: '<div style="width:32px;height:32px;border-radius:50%;background:#e53935;border:3px solid #fff;box-shadow:0 2px 8px rgba(229,57,53,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">🍽️</div>',
        iconSize: [32,32], iconAnchor: [16,16], popupAnchor: [0,-18],
      });

      // Event delegation: handles clicks on .saiba-mais-btn inside any popup
      document.addEventListener('click', function(e) {
        var btn = e.target && (e.target.closest ? e.target.closest('.saiba-mais-btn') : null);
        if (!btn && e.target && e.target.classList && e.target.classList.contains('saiba-mais-btn')) btn = e.target;
        if (btn) {
          var id = parseInt(btn.getAttribute('data-id'), 10);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openDetail', id: id }));
          }
        }
      });

      var restaurants = ${restaurantsJson};
      restaurants.forEach(function(r) {
        var instagramRow = r.instagram
          ? '<div class="popup-row"><span class="popup-icon">📸</span><span>' + r.instagram + '</span></div>'
          : '';

        var queueHtml = '';
        if (r.queue && r.queue.status !== 'CLOSED' && r.queue.max_tables > 0) {
          var pct = Math.min(100, Math.round((r.queue.current_tables / r.queue.max_tables) * 100));
          var barColor = pct < 40 ? '#43a047' : pct < 75 ? '#fb8c00' : '#e53935';
          var badgeBg  = pct < 40 ? '#e8f5e9' : pct < 75 ? '#fff8e1' : '#ffebee';
          var badgeFg  = pct < 40 ? '#2e7d32' : pct < 75 ? '#e65100' : '#b71c1c';
          var badgeLbl = pct < 40 ? 'Baixo' : pct < 75 ? 'Médio' : 'Cheio';
          var statusIcon = r.queue.status === 'OPEN' ? '🟢' : '⏸️';
          queueHtml = '<div class="queue-section">'
            + '<div class="queue-info-row">'
            + '<span>' + statusIcon + ' Fila: <strong>' + pct + '%</strong></span>'
            + '<span class="queue-badge" style="background:' + badgeBg + ';color:' + badgeFg + ';">' + badgeLbl + '</span>'
            + '</div>'
            + '<div class="queue-bar-track"><div class="queue-bar-fill" style="width:' + pct + '%;background:' + barColor + ';"></div></div>'
            + '</div>';
        } else if (r.queue && r.queue.status === 'CLOSED') {
          queueHtml = '<div class="queue-section"><div style="font-size:11px;color:#c62828;font-weight:700;">🔒 Fila fechada</div></div>';
        }

        var popup = '<div class="popup-content">'
          + '<div class="popup-name">' + r.name + '</div>'
          + '<div class="popup-row"><span class="popup-icon">📍</span><span>' + r.address + '</span></div>'
          + '<div class="popup-row"><span class="popup-icon">📞</span><span>' + r.phone + '</span></div>'
          + instagramRow
          + queueHtml
          + '<button class="saiba-mais-btn" data-id="' + r.id + '" '
          + 'style="margin-top:8px;width:100%;padding:7px 0;background:#3f51b5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">'
          + 'Saiba mais</button>'
          + '</div>';
        L.marker([r.lat, r.lng], { icon: restaurantIcon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 240 });
      });

      // Fix blank map on resize/render
      setTimeout(function() { map.invalidateSize(); }, 300);
    }

    // Start after DOM + scripts ready
    if (document.readyState === 'complete') {
      initMap();
    } else {
      window.addEventListener('load', initMap);
    }
  </script>
</body>
</html>`;
}

export default function MapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const restaurantsRef = useRef<Restaurant[]>([]);

  async function requestLocation() {
    setStatus('loading');
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') { setStatus('denied'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    setStatus('ready');
  }

  useEffect(() => { requestLocation(); }, []);

  useFocusEffect(
    useCallback(() => {
      getPublicRestaurants().then((data) => {
        setRestaurants(data);
        restaurantsRef.current = data;
      }).catch(() => {});
    }, [])
  );

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
      queue: r.queue ?? null,
    }))
  );

  // key forces WebView to fully remount when location or restaurants change
  const mapKey = coords ? `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}-${restaurantsWithCoords.length}` : 'no-coords';

  const mapHtml = coords ? buildMapHtml(coords.lat, coords.lng, restaurantsJson) : '';

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
        key={mapKey}
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        startInLoadingState
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'openDetail') {
              const restaurant = restaurantsRef.current.find((r) => r.id === msg.id);
              if (restaurant) navigation.navigate('RestaurantDetail', { restaurant });
            }
          } catch {}
        }}
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
