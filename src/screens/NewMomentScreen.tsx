import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { getPublicRestaurants } from '../services/restaurant';
import { createMoment } from '../services/moment';
import { Restaurant } from '../types';
import Aurora from '../components/Aurora';
import Glass from '../components/Glass';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import KineticText from '../components/KineticText';
import Skeleton from '../components/Skeleton';
import { useUI } from '../components/Dialog';
import { useBurst } from '../components/Burst';
import { colors, fonts, gradients, initialsOf } from '../theme';
import { ease, springTo, tween, useEntrance, useLoop } from '../motion';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'NewMoment'>;
  route: RouteProp<RootStackParamList, 'NewMoment'>;
};

function PlaceRow({ r, selected, onPress }: { r: Restaurant; selected: boolean; onPress: () => void }) {
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => { springTo(on, selected ? 1 : 0, { bounce: 0.4, duration: 450 }).start(); }, [selected, on]);
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} feedback="select" style={styles.place}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: on }]}>
        <LinearGradient colors={['rgba(143,84,254,0.35)', 'rgba(100,235,226,0.22)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.placeThumb}>
        {r.photo_url ? (
          <Image source={{ uri: r.photo_url }} style={StyleSheet.absoluteFill} />
        ) : (
          <LinearGradient colors={[colors.plum, colors.purple]} style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.placeInitials}>{initialsOf(r.name)}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.placeName} numberOfLines={1}>{r.name}</Text>
        <Text style={styles.placeAddr} numberOfLines={1}>{r.address}</Text>
      </View>
      <Animated.View style={{ transform: [{ scale: on }], opacity: on }}>
        <MaterialIcons name="check-circle" size={24} color={colors.cyan} />
      </Animated.View>
    </PressableScale>
  );
}

export default function NewMomentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const burst = useBurst();
  const preset = route.params?.restaurant ?? null;

  const [photo, setPhoto] = useState<string | null>(null);
  const [place, setPlace] = useState<Restaurant | null>(preset);
  const [places, setPlaces] = useState<Restaurant[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(!preset);
  const [changingPlace, setChangingPlace] = useState(false);
  const [query, setQuery] = useState('');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const enter = useEntrance(4, { step: 90, delay: 250 });
  const photoIn = useRef(new Animated.Value(0)).current;
  const pulse = useLoop(1800, { yoyo: false, easing: ease.out3 });

  useEffect(() => {
    if (preset && !changingPlace) return;
    setLoadingPlaces(true);
    getPublicRestaurants()
      .then(setPlaces)
      .catch(() => ui.toast('Não foi possível carregar os restaurantes.', 'error'))
      .finally(() => setLoadingPlaces(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changingPlace]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? places.filter(r => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q)) : places;
    return list.slice(0, 30);
  }, [places, query]);

  async function pick(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      ui.alert({
        tone: 'danger',
        icon: source === 'camera' ? 'no-photography' : 'photo-library',
        title: 'Permissão negada',
        message: source === 'camera' ? 'Habilite o acesso à câmera nas configurações.' : 'Habilite o acesso à galeria nas configurações.',
      });
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    setPhoto(result.assets[0].uri);
    photoIn.setValue(0);
    springTo(photoIn, 1, { bounce: 0.35, duration: 650 }).start();
  }

  async function publish() {
    if (!photo || !place) return;
    setPosting(true);
    try {
      await createMoment(place.id, photo, caption);
      burst.fire({ power: 1.35, count: 64 });
      ui.toast(`Momento publicado em ${place.name}!`, 'success');
      setTimeout(() => navigation.replace('RestaurantDetail', { restaurant: place }), 650);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const detail = errors && typeof errors === 'object' ? Object.values(errors).flat().join(' ') : err?.response?.data?.message;
      ui.alert({ tone: 'danger', icon: 'cloud-off', title: 'Não foi possível publicar', message: detail || 'Verifique sua conexão e tente de novo.' });
    } finally {
      setPosting(false);
    }
  }

  const showPicker = !place || changingPlace;
  const ready = !!photo && !!place;

  return (
    <Aurora intensity="vivid" sparkles={10}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <PressableScale onPress={() => navigation.goBack()} style={styles.close} scaleTo={0.85} accessibilityLabel="Fechar">
              <MaterialIcons name="close" size={22} color={colors.text} />
            </PressableScale>
            <Text style={styles.eyebrow}>novo momento</Text>
            <View style={{ width: 44 }} />
          </View>

          <KineticText text="Registre este momento" highlight={[2]} style={styles.headline} containerStyle={{ marginTop: 14 }} />
          <Animated.Text style={[styles.lead, enter(0)]}>
            Tire uma foto, marque o restaurante e ela aparece na galeria para todo mundo.
          </Animated.Text>

          {/* Step 1 — photo */}
          <Animated.View style={enter(1)}>
            {photo ? (
              <Animated.View
                style={[styles.preview, { opacity: photoIn, transform: [{ scale: photoIn.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}
              >
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={['rgba(10,6,23,0)', 'rgba(10,6,23,0.75)']} style={styles.previewShade} />
                <View style={styles.previewActions}>
                  <PressableScale onPress={() => pick('camera')} style={styles.chip}>
                    <MaterialIcons name="photo-camera" size={16} color="#fff" />
                    <Text style={styles.chipText}>Tirar outra</Text>
                  </PressableScale>
                  <PressableScale onPress={() => pick('library')} style={styles.chip}>
                    <MaterialIcons name="photo-library" size={16} color="#fff" />
                    <Text style={styles.chipText}>Galeria</Text>
                  </PressableScale>
                </View>
              </Animated.View>
            ) : (
              <Glass strong style={styles.capture}>
                <View style={styles.camWrap}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.camPulse, {
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                    }]}
                  />
                  <PressableScale onPress={() => pick('camera')} scaleTo={0.9} feedback="press" style={styles.cam} accessibilityLabel="Tirar foto">
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 48 }]} />
                    <MaterialIcons name="photo-camera" size={38} color="#fff" />
                  </PressableScale>
                </View>
                <Text style={styles.captureTitle}>Tirar foto</Text>
                <PressableScale onPress={() => pick('library')} feedback="select" style={styles.galleryLink}>
                  <MaterialIcons name="photo-library" size={16} color={colors.cyan} />
                  <Text style={styles.galleryText}>ou escolher da galeria</Text>
                </PressableScale>
              </Glass>
            )}
          </Animated.View>

          {/* Step 2 — place */}
          <Animated.View style={[styles.block, enter(2)]}>
            <Text style={styles.label}>Onde você está?</Text>
            {!showPicker && place ? (
              <View style={styles.selectedPlace}>
                <PlaceRow r={place} selected onPress={() => {}} />
                <PressableScale onPress={() => { setChangingPlace(true); setQuery(''); }} feedback="select" style={styles.changeBtn}>
                  <Text style={styles.changeText}>Trocar</Text>
                </PressableScale>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={styles.search}>
                  <MaterialIcons name="search" size={20} color={colors.textHint} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Procure o restaurante"
                    placeholderTextColor={colors.textHint}
                    value={query}
                    onChangeText={setQuery}
                    selectionColor={colors.cyan}
                  />
                </View>
                {loadingPlaces ? (
                  <>
                    <Skeleton style={{ height: 66, borderRadius: 20 }} />
                    <Skeleton style={{ height: 66, borderRadius: 20 }} delay={120} />
                  </>
                ) : filtered.length === 0 ? (
                  <Text style={styles.empty}>Nenhum restaurante encontrado.</Text>
                ) : (
                  filtered.map(r => (
                    <PlaceRow
                      key={r.id}
                      r={r}
                      selected={place?.id === r.id}
                      onPress={() => { setPlace(r); setChangingPlace(false); }}
                    />
                  ))
                )}
              </View>
            )}
          </Animated.View>

          {/* Step 3 — caption + publish */}
          <Animated.View style={[styles.block, enter(3)]}>
            <Text style={styles.label}>Legenda (opcional)</Text>
            <View style={styles.captionBox}>
              <TextInput
                style={styles.captionInput}
                placeholder="Conte como foi…"
                placeholderTextColor={colors.textHint}
                value={caption}
                onChangeText={setCaption}
                maxLength={300}
                multiline
                selectionColor={colors.cyan}
              />
            </View>
            <GradientButton
              title="Publicar momento"
              icon="auto-awesome"
              loading={posting}
              disabled={!ready}
              onPress={publish}
              style={{ marginTop: 18 }}
            />
            {!ready && (
              <Text style={styles.hint}>
                {!photo ? 'Falta a foto.' : 'Falta marcar o restaurante.'}
              </Text>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2.4, color: colors.cyan, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.4, color: colors.text },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSub, marginTop: 10, marginBottom: 22 },

  capture: { alignItems: 'center', paddingVertical: 34, borderRadius: 32, gap: 14 },
  camWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  camPulse: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.cyan },
  cam: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  captureTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
  galleryLink: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  galleryText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.cyan },

  preview: { height: 400, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.night, borderWidth: 1, borderColor: colors.glassLineStrong },
  previewShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  previewActions: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(10,6,23,0.7)', borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#fff' },

  block: { marginTop: 28 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8, color: colors.textHint, textTransform: 'uppercase', marginBottom: 12 },
  selectedPlace: { gap: 6 },
  changeBtn: { alignSelf: 'flex-end', padding: 6 },
  changeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.cyan },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 22,
    backgroundColor: '#150E33', borderWidth: 1, borderColor: colors.glassLine,
  },
  searchInput: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text, outlineStyle: 'none' } as any,
  empty: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textHint, textAlign: 'center', paddingVertical: 24 },
  place: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22, overflow: 'hidden',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  placeThumb: { width: 46, height: 46, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.night },
  placeInitials: { fontFamily: fonts.display, fontSize: 16, color: '#fff' },
  placeName: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text, letterSpacing: -0.3 },
  placeAddr: { fontFamily: fonts.body, fontSize: 12, color: colors.textHint, marginTop: 1 },
  captionBox: {
    minHeight: 90, padding: 14, borderRadius: 22, backgroundColor: '#150E33', borderWidth: 1, borderColor: colors.glassLine,
  },
  captionInput: { fontFamily: fonts.body, fontSize: 15, color: colors.text, minHeight: 60, textAlignVertical: 'top', outlineStyle: 'none' } as any,
  hint: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textHint, textAlign: 'center', marginTop: 10 },
});
