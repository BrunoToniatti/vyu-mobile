import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MainTabParamList } from '../../App';
import { getStoredUser, logout, uploadUserPhoto, removeUserPhoto } from '../services/auth';
import { getAllCategories, getUserPreferences, saveUserPreferences, Category } from '../services/category';
import { getMyReservations, checkInReservation, MyReservation } from '../services/restaurant';
import api from '../services/api';
import { UserApp } from '../types';
import { applyPhoneMask, stripPhoneMask } from '../utils/phoneMask';
import Aurora from '../components/Aurora';
import Avatar from '../components/Avatar';
import Glass from '../components/Glass';
import Field from '../components/Field';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import KineticText from '../components/KineticText';
import CountUp from '../components/CountUp';
import Skeleton from '../components/Skeleton';
import Ticket from '../components/Ticket';
import { useUI } from '../components/Dialog';
import { useBurst } from '../components/Burst';
import { colors, fonts, gradients } from '../theme';
import { ease, springTo, tween, useEntrance } from '../motion';

type Props = { navigation: BottomTabNavigationProp<MainTabParamList, 'Profile'> };
type Tab = 'reservas' | 'gostos' | 'dados';
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'reservas', label: 'Reservas', icon: 'confirmation-number' },
  { key: 'gostos', label: 'Gostos', icon: 'favorite' },
  { key: 'dados', label: 'Dados', icon: 'badge' },
];

const _now = new Date();
const todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const [w, setW] = useState(0);
  const idx = TABS.findIndex(t => t.key === value);
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    springTo(x, idx, { bounce: 0.4, duration: 520 }).start();
  }, [idx, x]);
  const seg = w / TABS.length;
  return (
    <Glass style={styles.segment}>
      <View style={StyleSheet.absoluteFill} onLayout={e => setW(e.nativeEvent.layout.width - 8)} pointerEvents="none">
        {w > 0 && (
          <Animated.View
            style={[
              styles.segPill,
              { width: seg, transform: [{ translateX: x.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [0, seg * (TABS.length - 1)] }) }] },
            ]}
          >
            <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      {TABS.map(t => {
        const on = t.key === value;
        return (
          <PressableScale key={t.key} containerStyle={{ flex: 1 }} style={styles.segBtn} onPress={() => onChange(t.key)} feedback="select" scaleTo={0.9}>
            <MaterialIcons name={t.icon} size={16} color={on ? '#fff' : colors.textHint} />
            <Text style={[styles.segText, on && { color: '#fff' }]}>{t.label}</Text>
          </PressableScale>
        );
      })}
    </Glass>
  );
}

function PrefChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: (e: GestureResponderEvent) => void }) {
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => { tween(on, selected ? 1 : 0, { duration: 240, easing: ease.out3 }).start(); }, [selected, on]);
  return (
    <PressableScale onPress={onPress} feedback="select" scaleTo={0.88} style={styles.chip}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: on }]}>
        <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {selected && <MaterialIcons name="check" size={14} color="#fff" />}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </PressableScale>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><MaterialIcons name={icon} size={17} color={colors.cyan} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ui = useUI();
  const burst = useBurst();
  const [user, setUser] = useState<UserApp | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservations, setReservations] = useState<MyReservation[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('reservas');
  const swap = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const enter = useEntrance(4, { step: 100, delay: 150 });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, cats, prefs] = await Promise.all([getStoredUser(), getAllCategories(), getUserPreferences()]);
      loadReservations();
      setUser(u);
      setCategories(cats);
      setSelected(new Set(prefs.map(p => p.id)));
      if (u) {
        setFirstName(u.first_name);
        setLastName(u.last_name);
        setPhone(applyPhoneMask(u.phone_number));
      }
    } catch {
      ui.alert({ tone: 'danger', title: 'Ops', message: 'Não foi possível carregar o perfil.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadReservations() {
    setLoadingRes(true);
    spin.setValue(0);
    tween(spin, 1, { duration: 700, easing: ease.out3 }).start();
    try {
      setReservations(await getMyReservations());
    } catch {
      // keep list
    } finally {
      setLoadingRes(false);
    }
  }

  const changeTab = useCallback((t: Tab) => {
    if (t === tab) return;
    tween(swap, 0, { duration: 140, easing: ease.in3 }).start(() => {
      setTab(t);
      springTo(swap, 1, { bounce: 0.3, duration: 480 }).start();
    });
  }, [tab, swap]);

  async function handleCheckIn(r: MyReservation, e: GestureResponderEvent) {
    const point = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    setCheckingIn(r.id);
    try {
      const updated = await checkInReservation(r.id);
      setReservations(prev =>
        prev.map(res => (res.id === r.id
          ? { ...res, status: updated.status as MyReservation['status'], status_display: updated.status_display }
          : res)),
      );
      burst.fire({ ...point, power: 1.4, count: 60 });
      ui.alert({ tone: 'success', title: 'Check-in realizado!', message: `Você está no ${r.restaurant_name}. Boa refeição!`, icon: 'place' });
    } catch (err: any) {
      ui.alert({ tone: 'danger', title: 'Check-in falhou', message: err?.response?.data?.message ?? 'Não foi possível realizar o check-in.' });
    } finally {
      setCheckingIn(null);
    }
  }

  function togglePref(id: number, e: GestureResponderEvent) {
    if (!selected.has(id)) burst.fromEvent(e, { count: 14, power: 0.4, quiet: true });
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function pickFrom(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      ui.alert({
        tone: 'danger',
        title: 'Permissão negada',
        message: source === 'camera' ? 'Habilite o acesso à câmera nas configurações.' : 'Habilite o acesso à galeria nas configurações.',
        icon: 'no-photography',
      });
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) await doUpload(result.assets[0].uri);
  }

  async function handlePickPhoto() {
    const choice = await ui.choose({
      title: 'Foto de perfil',
      message: 'Escolha uma opção',
      icon: 'photo-camera',
      options: [
        { key: 'camera', label: 'Câmera', icon: 'photo-camera' },
        { key: 'library', label: 'Galeria', icon: 'photo-library' },
        ...(user?.photo_url ? [{ key: 'remove', label: 'Remover foto', icon: 'delete-outline' as IconName, destructive: true }] : []),
      ],
    });
    if (choice === 'camera' || choice === 'library') await pickFrom(choice);
    if (choice === 'remove') {
      setUploadingPhoto(true);
      try {
        setUser(await removeUserPhoto());
        ui.toast('Foto removida', 'info');
      } catch {
        ui.alert({ tone: 'danger', title: 'Ops', message: 'Não foi possível remover a foto.' });
      } finally {
        setUploadingPhoto(false);
      }
    }
  }

  async function doUpload(uri: string) {
    setUploadingPhoto(true);
    try {
      setUser(await uploadUserPhoto(uri));
      burst.fire({ y: insets.top + 120, power: 0.9 });
    } catch {
      ui.alert({ tone: 'danger', title: 'Ops', message: 'Não foi possível enviar a foto.' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (editMode && (!firstName.trim() || !lastName.trim())) {
      ui.toast('Preencha nome e sobrenome.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveUserPreferences(Array.from(selected));
      if (editMode && user) {
        // the backend only accepts PUT on /users/me/ (PATCH answers 405)
        const res = await api.put('/users/me/', {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: stripPhoneMask(phone),
        });
        const updated: UserApp = { ...user, ...(res.data?.data ?? {}) };
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setFirstName(updated.first_name);
        setLastName(updated.last_name);
        setPhone(applyPhoneMask(updated.phone_number));
      }
      setEditMode(false);
      ui.alert({ tone: 'success', title: 'Salvo!', message: 'Perfil atualizado com sucesso.' });
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const detail = errors && typeof errors === 'object' ? Object.values(errors).flat().join(' ') : null;
      ui.alert({ tone: 'danger', title: 'Não salvou', message: detail || 'Não foi possível salvar as alterações.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const ok = await ui.confirm({
      tone: 'danger',
      icon: 'logout',
      title: 'Sair da conta?',
      message: 'Você vai precisar entrar de novo para ver suas reservas.',
      confirmText: 'Sair',
    });
    if (!ok) return;
    await logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  if (loading) {
    return (
      <Aurora intensity="calm">
        <View style={[styles.loading, { paddingTop: insets.top + 40 }]}>
          <Skeleton style={{ width: 112, height: 112, borderRadius: 56 }} />
          <Skeleton style={{ width: 200, height: 26, marginTop: 18 }} delay={100} />
          <Skeleton style={{ width: 150, height: 14, marginTop: 10 }} delay={200} />
          <Skeleton style={{ width: width - 40, height: 80, marginTop: 28, borderRadius: 22 }} delay={300} />
        </View>
      </Aurora>
    );
  }

  const checkIns = reservations.filter(r => r.status === 'CHECKED_IN' || r.status === 'COMPLETED').length;
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  return (
    <Aurora intensity="vivid" sparkles={12}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <Animated.View style={[styles.identity, enter(0)]}>
          <PressableScale onPress={handlePickPhoto} scaleTo={0.92} feedback="press" accessibilityLabel="Alterar foto de perfil">
            <Avatar name={fullName} photo={user?.photo_url} size={116} ring={4} loading={uploadingPhoto} />
            <View style={styles.camera}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
              <MaterialIcons name="photo-camera" size={16} color="#fff" />
            </View>
          </PressableScale>
          <KineticText key={fullName} text={fullName || 'Meu perfil'} style={styles.name} containerStyle={{ justifyContent: 'center', marginTop: 16 }} delay={150} />
          {!!user?.username && <Text style={styles.handle}>@{user.username}</Text>}
          <Text style={styles.email}>{user?.email}</Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.stats, enter(1)]}>
          {[
            { v: reservations.length, l: 'reservas', c: colors.cyan },
            { v: checkIns, l: 'check-ins', c: colors.purple },
            { v: selected.size, l: 'gostos', c: colors.gold },
          ].map((s, i) => (
            <Glass key={s.l} style={styles.stat}>
              <CountUp value={s.v} delay={300 + i * 120} style={[styles.statValue, { color: s.c }]} />
              <Text style={styles.statLabel}>{s.l}</Text>
            </Glass>
          ))}
        </Animated.View>

        <Animated.View style={[styles.pad, enter(2)]}>
          <Segmented value={tab} onChange={changeTab} />
        </Animated.View>

        <Animated.View
          style={[
            styles.pad,
            { marginTop: 18 },
            {
              opacity: swap,
              transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
        >
          {tab === 'reservas' && (
            <View style={{ gap: 10 }}>
              <View style={styles.tabHead}>
                <Text style={styles.tabTitle}>Minhas reservas</Text>
                <PressableScale onPress={loadReservations} style={styles.refresh} scaleTo={0.85} accessibilityLabel="Atualizar reservas">
                  <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                    <MaterialIcons name="refresh" size={20} color={colors.cyan} />
                  </Animated.View>
                </PressableScale>
              </View>
              {loadingRes && reservations.length === 0 ? (
                <>
                  <Skeleton style={{ height: 96, borderRadius: 22 }} />
                  <Skeleton style={{ height: 96, borderRadius: 22 }} delay={120} />
                </>
              ) : reservations.length === 0 ? (
                <Glass style={styles.empty}>
                  <MaterialIcons name="event-busy" size={34} color={colors.textHint} />
                  <Text style={styles.emptyText}>Você ainda não tem reservas.</Text>
                </Glass>
              ) : (
                reservations.map(r => (
                  <Ticket
                    key={r.id}
                    r={r}
                    footer={
                      r.status === 'CONFIRMED' && r.date === todayISO ? (
                        <View style={styles.checkWrap}>
                          <GradientButton
                            title="Fazer check-in"
                            icon="place"
                            size="md"
                            loading={checkingIn === r.id}
                            onPress={(e) => handleCheckIn(r, e)}
                          />
                        </View>
                      ) : undefined
                    }
                  />
                ))
              )}
            </View>
          )}

          {tab === 'gostos' && (
            <View>
              <Text style={styles.tabTitle}>Minhas preferências</Text>
              <Text style={styles.tabSub}>Toque para selecionar ou remover.</Text>
              {categories.map(cat => (
                <View key={cat.id} style={styles.catSection}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <View style={styles.chips}>
                    {cat.items.map(item => (
                      <PrefChip key={item.id} label={item.name} selected={selected.has(item.id)} onPress={(e) => togglePref(item.id, e)} />
                    ))}
                  </View>
                </View>
              ))}
              <GradientButton title="Salvar alterações" icon="check" loading={saving} onPress={handleSave} style={{ marginTop: 22 }} />
            </View>
          )}

          {tab === 'dados' && (
            <View style={{ gap: 14 }}>
              <View style={styles.tabHead}>
                <Text style={styles.tabTitle}>Dados pessoais</Text>
                <PressableScale onPress={() => setEditMode(e => !e)} feedback="select">
                  <Text style={styles.editLink}>{editMode ? 'Cancelar' : 'Editar'}</Text>
                </PressableScale>
              </View>
              {editMode ? (
                <View style={{ gap: 12 }}>
                  <Field label="Nome" icon="person-outline" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                  <Field label="Sobrenome" icon="badge" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                  <Field label="Telefone" icon="smartphone" value={phone} onChangeText={v => setPhone(applyPhoneMask(v))} keyboardType="phone-pad" maxLength={15} />
                </View>
              ) : (
                <Glass style={styles.infoCard}>
                  <InfoRow icon="person-outline" label="Nome" value={fullName} />
                  <InfoRow icon="tag" label="Username" value={user?.username ? `@${user.username}` : ''} />
                  <InfoRow icon="alternate-email" label="Email" value={user?.email ?? ''} />
                  <InfoRow icon="smartphone" label="Telefone" value={user?.phone_number ? applyPhoneMask(user.phone_number) : ''} />
                </Glass>
              )}
              <GradientButton title="Salvar alterações" icon="check" loading={saving} onPress={handleSave} />
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.pad, { marginTop: 28 }, enter(3)]}>
          <PressableScale onPress={handleLogout} style={styles.logout} scaleTo={0.96} feedback="press">
            <MaterialIcons name="logout" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center' },
  pad: { paddingHorizontal: 20 },
  identity: { alignItems: 'center', paddingHorizontal: 20 },
  camera: {
    position: 'absolute', right: 2, bottom: 2, width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.void,
  },
  name: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -1.2, color: colors.text, textAlign: 'center' },
  handle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.cyan, marginTop: 2 },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.textHint, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 24, marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 22 },
  statValue: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1 },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textHint, letterSpacing: 0.4 },

  segment: { flexDirection: 'row', padding: 4, borderRadius: 26, height: 52 },
  segPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 22, overflow: 'hidden' },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textHint },

  tabHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: -0.5 },
  tabSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textHint, marginTop: 4 },
  refresh: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(100,235,226,0.1)', borderWidth: 1, borderColor: 'rgba(100,235,226,0.3)',
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, borderRadius: 22 },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSub },
  checkWrap: { paddingHorizontal: 12, paddingBottom: 12 },

  catSection: { marginTop: 20 },
  catName: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14, borderRadius: 19, overflow: 'hidden',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLineStrong,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSub },

  editLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cyan, padding: 4 },
  infoCard: { borderRadius: 24, paddingVertical: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,235,226,0.1)' },
  infoLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2, color: colors.textHint, textTransform: 'uppercase' },
  infoValue: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text, marginTop: 1 },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,92,122,0.08)', borderWidth: 1, borderColor: 'rgba(255,92,122,0.35)',
  },
  logoutText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger },
});
