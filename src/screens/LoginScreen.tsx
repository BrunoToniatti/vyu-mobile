import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { loginUser } from '../services/auth';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleLogin() {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      await loginUser(identifier.trim(), password);
      navigation.replace('Restaurants');
    } catch (err: any) {
      const isNetwork = !err?.response;
      const msg = isNetwork
        ? 'Não foi possível conectar ao servidor. Verifique sua conexão e se o backend está rodando.'
        : err?.response?.data?.errors?.detail || 'Credenciais inválidas. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Text style={styles.logoEmoji}>🍽️</Text>
            </View>
            <Text style={styles.brand}>VYU Restaurantes</Text>
            <Text style={styles.heroSub}>Encontre os melhores restaurantes perto de você</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bem-vindo de volta</Text>
            <Text style={styles.cardSub}>Entre com sua conta para continuar</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail ou usuário</Text>
              <TextInput
                style={[styles.input, focusedField === 'id' && styles.inputFocused]}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="seu@email.com"
                placeholderTextColor="#b0b8d4"
                onFocus={() => setFocusedField('id')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, focusedField === 'pw' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#b0b8d4"
                  onFocus={() => setFocusedField('pw')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.registerBtnText}>Criar nova conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const PRIMARY = '#1a237e';
const PRIMARY_MID = '#283593';
const ACCENT = '#3f51b5';

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PRIMARY },
  container: { flexGrow: 1, padding: 24 },

  hero: { alignItems: 'center', paddingTop: 48, paddingBottom: 36 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 40 },
  brand: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: '#c5cae9', textAlign: 'center', marginTop: 6, lineHeight: 20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 32,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6b7280', marginBottom: 24 },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  inputFocused: { borderColor: ACCENT, backgroundColor: '#fff' },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeBtn: { position: 'absolute', right: 14, top: 13 },
  eyeText: { fontSize: 18 },

  btn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, color: '#9ca3af', fontSize: 13 },

  registerBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerBtnText: { color: ACCENT, fontWeight: '700', fontSize: 15 },
});
