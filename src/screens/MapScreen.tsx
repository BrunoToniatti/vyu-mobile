import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { Restaurant } from '../types';
import Aurora from '../components/Aurora';
import Glass from '../components/Glass';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import KineticText from '../components/KineticText';
import OccupancyRing from '../components/OccupancyRing';
import LeafletView, { LEAFLET_HEAD, LeafletHandle } from '../components/LeafletView';
import { colors, fonts, initialsOf, occupancyOf, occupancyTheme } from '../theme';
import { ease, springTo, tween, useEntrance, useLoop } from '../motion';

type Status = 'loading' | 'denied' | 'ready';
type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Map'>,
    StackNavigationProp<RootStackParamList>
  >;
};

function buildMapHtml(lat: number, lng: number, restaurantsJson: string) {
  return `<!DOCTYPE html><html><head>${LEAFLET_HEAD}</head><body><div id="map"></div><script>
  var map, markers = {}, active = null, me = [${lat}, ${lng}];
  function setActive(id){
    if(active && markers[active]) markers[active].getElement() && markers[active].getElement().firstChild.classList.remove('active');
    active = id;
    if(id && markers[id] && markers[id].getElement()) markers[id].getElement().firstChild.classList.add('active');
  }
  window.handleCommand = function(cmd){
    if(!map) return;
    if(cmd.type==='recenter'){ setActive(null); map.flyTo(me, 15, {duration:1.1}); }
    if(cmd.type==='deselect'){ setActive(null); }
    if(cmd.type==='focus' && markers[cmd.id]){ setActive(cmd.id); map.flyTo(markers[cmd.id].getLatLng(), 16, {duration:0.9}); }
  };
  function initMap(){
    if(typeof L==='undefined'){ return setTimeout(initMap,100); }
    map = L.map('map',{zoomControl:false,attributionControl:true}).setView(me, 14);
    L.tileLayer(DARK_TILES,{attribution:'© OpenStreetMap © CARTO',subdomains:'abcd',maxZoom:19}).addTo(map);
    L.marker(me,{icon:L.divIcon({className:'',html:pinHtml('#64EBE2','me'),iconSize:[44,44],iconAnchor:[22,22]}),zIndexOffset:1000}).addTo(map);
    var restaurants = ${restaurantsJson};
    restaurants.forEach(function(r){
      var m = L.marker([r.lat,r.lng],{icon:L.divIcon({className:'',html:pinHtml(r.color),iconSize:[44,44],iconAnchor:[22,22]})}).addTo(map);
      m.on('click',function(e){ L.DomEvent.stopPropagation(e); setActive(r.id); map.flyTo([r.lat,r.lng], Math.max(map.getZoom(),15), {duration:0.8}); send({type:'select',id:r.id}); });
      markers[r.id] = m;
    });
    map.on('click',function(){ setActive(null); send({type:'deselect'}); });
    setTimeout(function(){ map.invalidateSize(); }, 300);
    send({type:'ready'});
  }
  if(document.readyState==='complete'){ initMap(); } else { window.addEventListener('load', initMap); }
  </script></body></html>`;
}

/** Radar sweep shown while the GPS fix is being acquired. */
function Radar() {
  const sweep = useLoop(2200, { yoyo: false, easing: ease.linear });
  const ping = useLoop(1600, { yoyo: false, easing: ease.out3 });
  return (
    <View style={styles.radar}>
      {[1, 0.7, 0.4].map(k => <View key={k} style={[styles.radarRing, { width: 220 * k, height: 220 * k, borderRadius: 110 * k }]} />)}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <LinearGradient colors={['rgba(100,235,226,0.45)', 'rgba(100,235,226,0)']} start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 0 }} style={styles.radarBeam} />
      </Animated.View>
      <Animated.View
        style={[styles.radarPing, {
          opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
          transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] }) }],
        }]}
      />
      <View style={styles.radarDot} />
    </View>
  );
}

export default function MapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<LeafletHandle>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const restaurantsRef = useRef<Restaurant[]>([]);
  const card = useRef(new Animated.Value(0)).current;
  const enter = useEntrance(3, { step: 120, delay: 200 });

  async function requestLocation() {
    setStatus('loading');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') { setStatus('denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setStatus('ready');
    } catch {
      setStatus('denied');
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { requestLocation(); }, []);

  useFocusEffect(
    useCallback(() => {
      getPublicRestaurants().then(data => {
        setRestaurants(data);
        restaurantsRef.current = data;
      }).catch(() => {});
    }, []),
  );

  useEffect(() => {
    if (selected) {
      card.setValue(0);
      springTo(card, 1, { bounce: 0.35, duration: 600 }).start();
    }
  }, [selected, card]);

  function closeCard() {
    tween(card, 0, { duration: 220, easing: ease.in3 }).start(() => setSelected(null));
    mapRef.current?.command({ type: 'deselect' });
  }

  function openSettings() {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  }

  const withCoords = useMemo(() => restaurants.filter(r => r.latitude && r.longitude), [restaurants]);
  const restaurantsJson = JSON.stringify(
    withCoords.map(r => ({ id: r.id, lat: r.latitude, lng: r.longitude, color: occupancyOf(r.queue).color })),
  );
  const mapKey = coords ? `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}-${withCoords.length}` : 'no-coords';
  const mapHtml = useMemo(
    () => (coords ? buildMapHtml(coords.lat, coords.lng, restaurantsJson) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapKey],
  );

  if (status === 'loading') {
    return (
      <Aurora intensity="calm" sparkles={8}>
        <View style={styles.center}>
          <Radar />
          <Text style={styles.loadingTitle}>Escaneando a área</Text>
          <Text style={styles.loadingSub}>Obtendo sua localização…</Text>
        </View>
      </Aurora>
    );
  }

  if (status === 'denied') {
    return (
      <Aurora intensity="vivid">
        <View style={[styles.blocked, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 120 }]}>
          <Animated.View style={[styles.blockedIcon, enter(0)]}>
            <MaterialIcons name="location-off" size={44} color={colors.cyan} />
          </Animated.View>
          <KineticText text="Localização bloqueada" highlight={[1]} accent={colors.danger} style={styles.blockedTitle} containerStyle={{ justifyContent: 'center' }} />
          <Animated.Text style={[styles.blockedText, enter(1)]}>
            Precisamos da sua localização para mostrar o mapa e os restaurantes próximos a você.
          </Animated.Text>
          <Animated.View style={[{ alignSelf: 'stretch', gap: 12 }, enter(2)]}>
            <GradientButton title="Permitir localização" icon="my-location" onPress={requestLocation} />
            <GradientButton title="Abrir configurações" variant="ghost" onPress={openSettings} />
          </Animated.View>
        </View>
      </Aurora>
    );
  }

  const occ = selected ? occupancyOf(selected.queue) : null;
  const hasQueue = !!selected?.queue && selected.queue.status !== 'CLOSED' && selected.queue.max_tables > 0;

  return (
    <View style={styles.root}>
      <LeafletView
        key={mapKey}
        ref={mapRef}
        html={mapHtml}
        style={StyleSheet.absoluteFill}
        onMessage={msg => {
          if (msg?.type === 'select') {
            const r = restaurantsRef.current.find(x => x.id === msg.id);
            if (r) setSelected(r);
          } else if (msg?.type === 'deselect') {
            if (selected) closeCard();
          }
        }}
      />

      <LinearGradient colors={['rgba(10,6,23,0.85)', 'rgba(10,6,23,0)']} style={[styles.topShade, { height: insets.top + 90 }]} pointerEvents="none" />

      <View style={[styles.topRow, { top: insets.top + 12 }]} pointerEvents="box-none">
        <Glass strong style={styles.chip}>
          <MaterialIcons name="my-location" size={14} color={colors.cyan} />
          <Text style={styles.chipText}>Você está aqui</Text>
        </Glass>
        {withCoords.length > 0 && (
          <Glass strong style={styles.chip}>
            <MaterialIcons name="restaurant" size={14} color={colors.purple} />
            <Text style={styles.chipText}>{withCoords.length} restaurante{withCoords.length !== 1 ? 's' : ''}</Text>
          </Glass>
        )}
      </View>

      <PressableScale
        onPress={() => { mapRef.current?.command({ type: 'recenter' }); if (selected) closeCard(); }}
        containerStyle={[styles.recenter, { bottom: insets.bottom + (selected ? 290 : 120) }]}
        style={styles.recenterInner}
        scaleTo={0.85}
        accessibilityLabel="Centralizar no meu local"
      >
        <MaterialIcons name="gps-fixed" size={22} color={colors.cyan} />
      </PressableScale>

      {!selected && withCoords.length > 0 && (
        <View style={[styles.legend, { bottom: insets.bottom + 120 }]} pointerEvents="none">
          {(['low', 'medium', 'high'] as const).map(l => {
            const t = occupancyTheme[l];
            return (
              <View key={l} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                <Text style={styles.legendText}>{t.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {selected && occ && (
        <Animated.View
          style={[
            styles.cardWrap,
            {
              bottom: insets.bottom + 108,
              opacity: card,
              transform: [
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) },
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
        >
          <Glass strong intensity={60} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.thumb}>
                {selected.photo_url ? (
                  <Image source={{ uri: selected.photo_url }} style={StyleSheet.absoluteFill} />
                ) : (
                  <LinearGradient colors={[colors.plum, colors.purple]} style={[StyleSheet.absoluteFill, styles.thumbFallback]}>
                    <Text style={styles.thumbText}>{initialsOf(selected.name)}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.cardName} numberOfLines={1}>{selected.name}</Text>
                <View style={styles.meta}>
                  <MaterialIcons name="place" size={12} color={colors.textHint} />
                  <Text style={styles.metaText} numberOfLines={1}>{selected.address}</Text>
                </View>
                <View style={styles.meta}>
                  <MaterialIcons name="call" size={12} color={colors.textHint} />
                  <Text style={styles.metaText} numberOfLines={1}>{selected.contact_phone}</Text>
                </View>
                {!!selected.instagram && (
                  <View style={styles.meta}>
                    <MaterialIcons name="alternate-email" size={12} color={colors.textHint} />
                    <Text style={styles.metaText} numberOfLines={1}>{selected.instagram.replace(/^@/, '')}</Text>
                  </View>
                )}
                {selected.queue?.status === 'CLOSED' && (
                  <View style={styles.meta}>
                    <MaterialIcons name="lock" size={12} color={colors.danger} />
                    <Text style={[styles.metaText, { color: colors.danger }]}>Fila fechada</Text>
                  </View>
                )}
              </View>
              {hasQueue && <OccupancyRing key={selected.id} pct={occ.pct} level={occ.level} size={64} stroke={6} live={false} delay={150} />}
              <PressableScale onPress={closeCard} containerStyle={styles.closePos} style={styles.close} scaleTo={0.8} accessibilityLabel="Fechar">
                <MaterialIcons name="close" size={16} color={colors.text} />
              </PressableScale>
            </View>
            <GradientButton
              title="Saiba mais"
              iconRight="arrow-forward"
              size="md"
              onPress={() => navigation.navigate('RestaurantDetail', { restaurant: selected })}
            />
          </Glass>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 80 },
  loadingTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, marginTop: 30 },
  loadingSub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSub },
  radar: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', borderRadius: 110, overflow: 'hidden' },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(100,235,226,0.25)' },
  radarBeam: { position: 'absolute', left: 110, top: 0, width: 110, height: 110 },
  radarPing: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.cyan },
  radarDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.cyan, borderWidth: 3, borderColor: '#fff' },

  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  blockedIcon: {
    width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(100,235,226,0.1)', borderWidth: 1, borderColor: 'rgba(100,235,226,0.35)',
  },
  blockedTitle: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -1.2, color: colors.text, textAlign: 'center' },
  blockedText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSub, textAlign: 'center', marginBottom: 12 },

  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  recenter: { position: 'absolute', right: 16 },
  recenterInner: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(19,12,46,0.92)', borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  legend: {
    position: 'absolute', left: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 99, backgroundColor: 'rgba(19,12,46,0.85)', borderWidth: 1, borderColor: colors.glassLine,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textSub },

  cardWrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center' },
  card: { width: '100%', maxWidth: 480, padding: 14, borderRadius: 28, gap: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.night },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontFamily: fonts.display, fontSize: 22, color: '#fff' },
  cardName: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSub },
  closePos: { position: 'absolute', top: -4, right: -4 },
  close: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glassStrong,
  },
});
