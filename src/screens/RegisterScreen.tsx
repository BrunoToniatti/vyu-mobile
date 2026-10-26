import React, { useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { registerUser, loginUser } from '../services/auth';
import { applyPhoneMask, stripPhoneMask } from '../utils/phoneMask';
import Aurora from '../components/Aurora';
import KineticText from '../components/KineticText';
import Glass from '../components/Glass';
import Field from '../components/Field';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import { useBurst } from '../components/Burst';
import { useUI } from '../components/Dialog';
import { colors, fonts, gradients } from '../theme';
import { ease, haptic, shake, shakeX, springTo, tween, useEntrance } from '../motion';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Register'> };
type FormKey = 'first_name' | 'last_name' | 'email' | 'username' | 'phone_number' | 'password';

const STEPS: { title: string; hint: string; keys: FormKey[] }[] = [
  { title: 'Quem é você?', hint: 'Seu nome aparece nas reservas e avaliações.', keys: ['first_name', 'last_name'] },
  { title: 'Como te achamos?', hint: 'Usamos para login e para confirmar reservas.', keys: ['email', 'username', 'phone_number'] },
  { title: 'Blinde sua conta.', hint: 'Mínimo de 8 caracteres. Misture letras e números.', keys: ['password'] },
];

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}
const SCORE_LABEL = ['Muito fraca', 'Fraca', 'Ok', 'Forte', 'Blindada'];
const SCORE_COLOR = [colors.danger, colors.danger, colors.warning, colors.cyan, colors.cyan];

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const burst = useBurst();
  const [form, setForm] = useState<Record<FormKey, string>>({
    first_name: '', last_name: '', email: '', username: '', phone_number: '', password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const slide = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1 / 3)).current;
  const jolt = useRef(new Animated.Value(0)).current;
  const refs = useRef<Partial<Record<FormKey, TextInputInstance | null>>>({}).current;
  const enter = useEntrance(3, { step: 90, delay: 300 });

  function update(field: FormKey, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  }

  function goTo(next: number) {
    const d = next > step ? 1 : -1;
    haptic.select();
    springTo(progress, (next + 1) / 3, { bounce: 0.35, duration: 600, native: false }).start();
    Animated.parallel([
      tween(slide, 0, { duration: 180, easing: ease.in3 }),
      tween(shift, -50 * d, { duration: 180, easing: ease.in3 }),
    ]).start(() => {
      setStep(next);
      shift.setValue(60 * d);
      Animated.parallel([
        tween(slide, 1, { duration: 320 }),
        springTo(shift, 0, { bounce: 0.35, duration: 560 }),
      ]).start();
    });
  }

  function validate(keys: FormKey[]) {
    const e: Partial<Record<FormKey, string>> = {};
    for (const k of keys) {
      const v = form[k].trim();
      if (!v) e[k] = 'Campo obrigatório';
      else if (k === 'email' && !/^\S+@\S+\.\S+$/.test(v)) e[k] = 'E-mail inválido';
      else if (k === 'phone_number' && stripPhoneMask(v).length < 10) e[k] = 'Telefone incompleto';
      else if (k === 'password' && form.password.length < 8) e[k] = 'A senha deve ter no mínimo 8 caracteres';
    }
    setErrors(prev => ({ ...prev, ...e }));
    if (Object.keys(e).length) {
      haptic.error();
      shake(jolt).start();
      return false;
    }
    return true;
  }

  async function next() {
    if (!validate(STEPS[step].keys)) return;
    if (step < STEPS.length - 1) return goTo(step + 1);

    setLoading(true);
    try {
      await registerUser({ ...form, phone_number: stripPhoneMask(form.phone_number) });
      await loginUser(form.email, form.password);
      burst.fire({ power: 1.4, count: 64 });
      setTimeout(() => navigation.replace('Onboarding'), 500);
    } catch (err: any) {
      const serverErrors = err?.response?.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped: Partial<Record<FormKey, string>> = {};
        for (const [k, v] of Object.entries(serverErrors)) {
          if (k in form) mapped[k as FormKey] = ([] as unknown[]).concat(v as any).join(' ');
        }
        setErrors(mapped);
        const firstStep = STEPS.findIndex(s => s.keys.some(k => mapped[k]));
        if (firstStep >= 0 && firstStep !== step) goTo(firstStep);
        ui.alert({
          tone: 'danger',
          title: 'Quase lá',
          message: Object.values(serverErrors).flat().join('\n'),
          icon: 'edit-note',
        });
      } else {
        ui.alert({
          tone: 'danger',
          title: err?.response ? 'Não deu certo' : 'Sem conexão',
          message: 'Erro ao criar conta. Tente novamente.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const score = passwordScore(form.password);

  return (
    <Aurora intensity="calm">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <PressableScale
              style={styles.back}
              accessibilityLabel="Voltar"
              onPress={() => (step > 0 ? goTo(step - 1) : navigation.goBack())}
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </PressableScale>
            <Text style={styles.stepLabel}>
              <Text style={{ color: colors.cyan }}>0{step + 1}</Text> / 03
            </Text>
          </View>

          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            >
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>

          <KineticText text="Crie sua conta VYU" highlight={[3]} style={styles.headline} containerStyle={{ marginTop: 28 }} />

          <Animated.View style={[enter(0), { marginTop: 22 }]}>
            <Animated.View style={{ transform: [{ translateX: shakeX(jolt) }] }}>
              <Glass strong style={styles.card} intensity={40}>
                <Animated.View style={{ opacity: slide, transform: [{ translateX: shift }] }}>
                  <Text style={styles.stepTitle}>{STEPS[step].title}</Text>
                  <Text style={styles.stepHint}>{STEPS[step].hint}</Text>

                  {step === 0 && (
                    <View style={styles.fields}>
                      <Field
                        label="Nome"
                        icon="person-outline"
                        value={form.first_name}
                        onChangeText={v => update('first_name', v)}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={() => refs.last_name?.focus()}
                        error={errors.first_name}
                      />
                      <Field
                        ref={r => { refs.last_name = r; }}
                        label="Sobrenome"
                        icon="badge"
                        value={form.last_name}
                        onChangeText={v => update('last_name', v)}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={next}
                        error={errors.last_name}
                      />
                    </View>
                  )}

                  {step === 1 && (
                    <View style={styles.fields}>
                      <Field
                        label="E-mail"
                        icon="alternate-email"
                        value={form.email}
                        onChangeText={v => update('email', v)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => refs.username?.focus()}
                        error={errors.email}
                      />
                      <Field
                        ref={r => { refs.username = r; }}
                        label="Usuário"
                        icon="tag"
                        value={form.username}
                        onChangeText={v => update('username', v)}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => refs.phone_number?.focus()}
                        error={errors.username}
                      />
                      <Field
                        ref={r => { refs.phone_number = r; }}
                        label="Telefone"
                        icon="smartphone"
                        value={form.phone_number}
                        onChangeText={v => update('phone_number', applyPhoneMask(v))}
                        keyboardType="phone-pad"
                        maxLength={15}
                        error={errors.phone_number}
                      />
                    </View>
                  )}

                  {step === 2 && (
                    <View style={styles.fields}>
                      <Field
                        label="Senha"
                        icon="lock-outline"
                        secure
                        value={form.password}
                        onChangeText={v => update('password', v)}
                        autoCapitalize="none"
                        returnKeyType="go"
                        onSubmitEditing={next}
                        error={errors.password}
                      />
                      <View style={styles.meter}>
                        {[0, 1, 2, 3].map(i => (
                          <View
                            key={i}
                            style={[styles.meterBar, i < score && { backgroundColor: SCORE_COLOR[score] }]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.meterLabel, { color: form.password ? SCORE_COLOR[score] : colors.textHint }]}>
                        {form.password ? SCORE_LABEL[score] : 'Força da senha'}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                <GradientButton
                  title={step < 2 ? 'Continuar' : 'Criar conta'}
                  iconRight={step < 2 ? 'arrow-forward' : 'rocket-launch'}
                  loading={loading}
                  onPress={next}
                  style={{ marginTop: 22 }}
                />
              </Glass>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.footer, enter(1)]}>
            <Text style={styles.footerText}>Já tem conta?</Text>
            <PressableScale onPress={() => navigation.goBack()} feedback="select">
              <Text style={styles.footerLink}>Entrar</Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 22, maxWidth: 520, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  stepLabel: { fontFamily: fonts.display, fontSize: 16, color: colors.textHint, letterSpacing: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 20, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  headline: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.4, color: colors.text },
  card: { padding: 20, borderRadius: 30 },
  stepTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
  stepHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSub, marginTop: 4 },
  fields: { gap: 14, marginTop: 18 },
  meter: { flexDirection: 'row', gap: 6, marginTop: 2 },
  meterBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  meterLabel: { fontFamily: fonts.bodySemi, fontSize: 12, marginTop: -6 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 26 },
  footerText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSub },
  footerLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cyan },
});
