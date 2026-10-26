import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { loginUser } from '../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_EXPIRED_KEY } from '../services/session';
import Aurora from '../components/Aurora';
import VyuLogo from '../components/VyuLogo';
import KineticText from '../components/KineticText';
import Glass from '../components/Glass';
import Field from '../components/Field';
import GradientButton from '../components/GradientButton';
import { useBurst } from '../components/Burst';
import { useUI } from '../components/Dialog';
import { colors, fonts } from '../theme';
import { haptic, shake, shakeX, useEntrance } from '../motion';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const burst = useBurst();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; pw?: string }>({});
  const passwordRef = useRef<TextInputInstance>(null);
  const jolt = useRef(new Animated.Value(0)).current;
  const enter = useEntrance(5, { step: 90, delay: 450 });

  useEffect(() => {
    AsyncStorage.getItem(SESSION_EXPIRED_KEY).then(flag => {
      if (!flag) return;
      AsyncStorage.removeItem(SESSION_EXPIRED_KEY);
      setTimeout(() => ui.toast('Sua sessão expirou. Entre novamente.', 'info'), 700);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin() {
    const next = {
      id: identifier.trim() ? undefined : 'Informe seu e-mail ou usuário',
      pw: password.trim() ? undefined : 'Informe sua senha',
    };
    setErrors(next);
    if (next.id || next.pw) {
      haptic.error();
      shake(jolt).start();
      return;
    }
    setLoading(true);
    try {
      await loginUser(identifier.trim(), password);
      burst.fire({ power: 1.3, count: 56 });
      setTimeout(() => navigation.replace('Main'), 450);
    } catch (err: any) {
      const isNetwork = !err?.response;
      shake(jolt).start();
      ui.alert({
        tone: 'danger',
        title: isNetwork ? 'Sem conexão' : 'Não deu certo',
        message: isNetwork
          ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
          : err?.response?.data?.errors?.detail || 'Credenciais inválidas. Tente novamente.',
        icon: isNetwork ? 'wifi-off' : 'lock-outline',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Aurora intensity="vivid">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <VyuLogo size={58} />
            <View>
              <Text style={styles.brand}>VYU</Text>
              <Text style={styles.brandTag}>restaurantes ao vivo</Text>
            </View>
          </View>

          <KineticText
            text="Veja a vibe antes de chegar."
            highlight={[2]}
            delay={200}
            style={styles.headline}
            containerStyle={{ marginTop: 44 }}
          />
          <Animated.Text style={[styles.lead, enter(0)]}>
            Lotação em tempo real, reservas em segundos e chat direto com a casa.
          </Animated.Text>

          <Animated.View style={enter(1)}>
            <Animated.View style={{ transform: [{ translateX: shakeX(jolt) }] }}>
            <Glass strong style={styles.card} intensity={40}>
              <Text style={styles.cardTitle}>Entrar</Text>
              <Field
                label="E-mail ou usuário"
                icon="alternate-email"
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); if (errors.id) setErrors(e => ({ ...e, id: undefined })); }}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.id}
              />
              <Field
                ref={passwordRef}
                label="Senha"
                icon="lock-outline"
                secure
                value={password}
                onChangeText={(v) => { setPassword(v); if (errors.pw) setErrors(e => ({ ...e, pw: undefined })); }}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                error={errors.pw}
                style={{ marginTop: 14 }}
              />
              <GradientButton
                title="Entrar"
                iconRight="arrow-forward"
                loading={loading}
                onPress={handleLogin}
                style={{ marginTop: 22 }}
              />
            </Glass>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.divider, enter(2)]}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>primeira vez aqui?</Text>
            <View style={styles.line} />
          </Animated.View>

          <Animated.View style={enter(3)}>
            <GradientButton
              title="Criar minha conta"
              icon="auto-awesome"
              variant="ghost"
              onPress={() => navigation.navigate('Register')}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 22, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brand: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 6, color: colors.text },
  brandTag: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 2, color: colors.cyan, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.6, color: colors.text },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSub, marginTop: 14, marginBottom: 28 },
  card: { padding: 20, borderRadius: 30 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.text, marginBottom: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: colors.glassLine },
  dividerText: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textHint, letterSpacing: 0.5 },
});
