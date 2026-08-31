import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { getAllCategories, saveUserPreferences, Category } from '../services/category';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Preferences'> };

export default function PreferencesScreen({ navigation }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllCategories()
      .then(setCategories)
      .catch(() => Alert.alert('Erro', 'Não foi possível carregar as categorias.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: number) {
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
      await AsyncStorage.setItem('onboarding_done', 'true');
      navigation.replace('Restaurants');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar suas preferências.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Restaurants');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3f51b5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seus gostos 🎯</Text>
        <Text style={styles.headerSub}>Selecione o que você mais curte</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {categories.map(cat => (
          <View key={cat.id} style={styles.catSection}>
            <Text style={styles.catName}>{cat.name}</Text>
            {cat.description ? <Text style={styles.catDesc}>{cat.description}</Text> : null}
            <View style={styles.itemsWrap}>
              {cat.items.map(item => {
                const sel = selected.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => toggle(item.id)}
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

        {categories.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Nenhuma categoria disponível ainda.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selecionado{selected.size > 1 ? 's' : ''}</Text>
        )}
        <TouchableOpacity
          style={[styles.btnSave, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSaveText}>Salvar preferências</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Pular por enquanto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#1a237e',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#c5cae9' },

  scroll: { padding: 20, gap: 24 },

  catSection: { gap: 8 },
  catName: { fontSize: 16, fontWeight: '700', color: '#1a237e' },
  catDesc: { fontSize: 12, color: '#6b7280', marginTop: -4 },
  itemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipSelected: { borderColor: '#3f51b5', backgroundColor: '#e8eaf6' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#3f51b5', fontWeight: '700' },

  emptyText: { color: '#9ca3af', fontSize: 14 },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
    alignItems: 'center',
  },
  selectedCount: { fontSize: 13, color: '#6b7280' },
  btnSave: {
    backgroundColor: '#1a237e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  btnDisabled: { opacity: 0.6 },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipText: { color: '#9ca3af', fontSize: 13 },
});
