import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar, Platform, TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { getStoredUser, logout } from '../services/auth';
import { getAllCategories, getUserPreferences, saveUserPreferences, Category } from '../services/category';
import { UserApp } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Profile'> };

export default function ProfileScreen({ navigation }: Props) {
  const [user, setUser] = useState<UserApp | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, cats, prefs] = await Promise.all([
        getStoredUser(),
        getAllCategories(),
        getUserPreferences(),
      ]);
      setUser(u);
      setCategories(cats);
      setSelected(new Set(prefs.map(p => p.id)));
      if (u) {
        setFirstName(u.first_name);
        setLastName(u.last_name);
        setPhone(u.phone_number);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }

  function togglePref(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveUserPreferences(Array.from(selected));
      if (editMode && user) {
        const res = await api.patch('/users/me/', {
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
        });
        const updated = { ...user, first_name: firstName, last_name: lastName, phone_number: phone };
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      }
      setEditMode(false);
      Alert.alert('Salvo!', 'Perfil atualizado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigation.replace('Login');
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3f51b5" /></View>;
  }

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Dados pessoais</Text>
            <TouchableOpacity onPress={() => setEditMode(e => !e)}>
              <Text style={styles.editLink}>{editMode ? 'Cancelar' : 'Editar'}</Text>
            </TouchableOpacity>
          </View>

          {editMode ? (
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nome</Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Sobrenome</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Telefone</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            </View>
          ) : (
            <View style={styles.fields}>
              <InfoRow label="Nome" value={`${user?.first_name} ${user?.last_name}`} />
              <InfoRow label="Username" value={`@${user?.username}`} />
              <InfoRow label="Email" value={user?.email ?? ''} />
              <InfoRow label="Telefone" value={user?.phone_number ?? ''} />
            </View>
          )}
        </View>

        {/* Preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Minhas preferências 🎯</Text>
          <Text style={styles.cardSubtitle}>Toque para selecionar ou deselecionar</Text>

          {categories.map(cat => (
            <View key={cat.id} style={styles.catSection}>
              <Text style={styles.catName}>{cat.name}</Text>
              <View style={styles.itemsWrap}>
                {cat.items.map(item => {
                  const sel = selected.has(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => togglePref(item.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {sel ? '✓ ' : ''}{item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Salvar alterações</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.btnLogoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#1a237e',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: { padding: 4 },
  backText: { color: '#c5cae9', fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },

  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#3f51b5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
  userName: { fontSize: 20, fontWeight: '700', color: '#1a237e' },
  userEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a237e' },
  cardSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: -8 },
  editLink: { color: '#3f51b5', fontWeight: '600', fontSize: 14 },

  fields: { gap: 10 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#1f2937', fontWeight: '500', flex: 1, textAlign: 'right' },

  catSection: { gap: 8 },
  catName: { fontSize: 14, fontWeight: '700', color: '#374151' },
  itemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipSelected: { borderColor: '#3f51b5', backgroundColor: '#e8eaf6' },
  chipText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  chipTextSelected: { color: '#3f51b5', fontWeight: '700' },

  btnSave: {
    backgroundColor: '#1a237e', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  btnLogout: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fee2e2',
  },
  btnLogoutText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
