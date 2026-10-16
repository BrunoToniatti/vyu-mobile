import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import GradientButton from '../../components/GradientButton';
import PressableScale from '../../components/PressableScale';
import { useUI } from '../../components/Dialog';
import { createReservation } from '../../services/restaurant';
import { Restaurant } from '../../types';
import { colors, fonts, gradients } from '../../theme';
import { ease, haptic, springTo, staggerDelays, tween } from '../../motion';

const SLOTS = ['12:00', '12:30', '13:00', '13:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function formatLongDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function DayCell({ dateStr, delay, past, today, selected, onPress }: {
  dateStr: string; delay: number; past: boolean; today: boolean; selected: boolean; onPress: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 650, delay, easing: ease.outBack, useNativeDriver: true }).start();
  }, [t, delay]);
  const day = Number(dateStr.split('-')[2]);
  return (
    <Animated.View style={[styles.cell, { opacity: t, transform: [{ scale: t }] }]}>
      <PressableScale
        disabled={past}
        onPress={onPress}
        feedback="select"
        scaleTo={0.8}
        style={[styles.day, today && styles.dayToday, past && { opacity: 0.28 }]}
      >
        {selected && (
          <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
        )}
        <Text style={[styles.dayText, today && { color: colors.cyan }, selected && { color: '#fff' }]}>{day}</Text>
      </PressableScale>
    </Animated.View>
  );
}

export default function ReservationSheet({ visible, restaurant, onClose, onDone }: {
  visible: boolean; restaurant: Restaurant; onClose: () => void; onDone: (dateStr: string) => void;
}) {
  const ui = useUI();
  const [step, setStep] = useState<'calendar' | 'details'>('calendar');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [party, setParty] = useState(2);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setResDate('');
    setResTime('');
    setTimeError(null);
    setParty(2);
    setNotes('');
    setStep('calendar');
    fade.setValue(1);
    shift.setValue(0);
  }, [visible, fade, shift]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, [visible]);
  const todayStr = isoOf(today);

  function transition(dir: 1 | -1, apply: () => void) {
    Animated.parallel([
      tween(fade, 0, { duration: 150, easing: ease.in3 }),
      tween(shift, -40 * dir, { duration: 150, easing: ease.in3 }),
    ]).start(() => {
      apply();
      shift.setValue(50 * dir);
      Animated.parallel([tween(fade, 1, { duration: 260 }), springTo(shift, 0, { bounce: 0.3, duration: 500 })]).start();
    });
  }

  function changeMonth(dir: 1 | -1) {
    transition(dir, () => {
      if (dir === 1) {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
      } else if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1);
    });
  }

  function selectDay(dateStr: string) {
    setResDate(dateStr);
    setTimeout(() => transition(1, () => setStep('details')), 160);
  }

  function changeParty(delta: number) {
    setParty(p => Math.min(20, Math.max(1, p + delta)));
    bump.setValue(0.7);
    springTo(bump, 1, { bounce: 0.6, duration: 450 }).start();
  }

  const cells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: firstDay }, () => null);
    for (let d = 1; d <= daysInMonth; d++) out.push(`${calYear}-${pad(calMonth + 1)}-${pad(d)}`);
    return out;
  }, [calYear, calMonth]);
  const delays = useMemo(() => staggerDelays(cells.length, 12, { from: 'first' }), [cells.length]);

  const isPast = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) < today; };
  const canGoBack = calYear > today.getFullYear() || (calYear === today.getFullYear() && calMonth > today.getMonth());

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const slots = SLOTS.filter(s => resDate !== todayStr || Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) > nowMinutes);

  async function submit() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(resTime)) {
      setTimeError('Informe um horário válido (HH:MM)');
      haptic.error();
      return;
    }
    setSubmitting(true);
    try {
      await createReservation(restaurant.id, { date: resDate, time: resTime, party_size: party, notes: notes.trim() });
      onDone(resDate);
    } catch (err: any) {
      const msg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Não foi possível fazer a reserva.';
      ui.alert({ tone: 'danger', title: 'Reserva não enviada', message: msg, icon: 'event-busy' });
    } finally {
      setSubmitting(false);
    }
  }

  const backBtn = step === 'details' ? (
    <PressableScale onPress={() => transition(-1, () => setStep('calendar'))} style={styles.back} scaleTo={0.85} accessibilityLabel="Voltar ao calendário">
      <MaterialIcons name="arrow-back" size={20} color={colors.text} />
    </PressableScale>
  ) : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      leading={backBtn}
      title={step === 'calendar' ? 'Escolha o dia' : 'Detalhes'}
      subtitle={step === 'calendar' ? restaurant.name : formatLongDate(resDate)}
    >
      <Animated.View style={{ opacity: fade, transform: [{ translateX: shift }] }}>
        {step === 'calendar' ? (
          <View>
            <View style={styles.monthNav}>
              <PressableScale onPress={() => changeMonth(-1)} disabled={!canGoBack} style={styles.navBtn} scaleTo={0.85} accessibilityLabel="Mês anterior">
                <MaterialIcons name="chevron-left" size={24} color={colors.text} />
              </PressableScale>
              <Text style={styles.monthLabel}>
                {new Date(calYear, calMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
              </Text>
              <PressableScale onPress={() => changeMonth(1)} style={styles.navBtn} scaleTo={0.85} accessibilityLabel="Próximo mês">
                <MaterialIcons name="chevron-right" size={24} color={colors.text} />
              </PressableScale>
            </View>
            <View style={styles.weekRow}>
              {WEEK.map((d, i) => <Text key={i} style={styles.weekDay}>{d}</Text>)}
            </View>
            <View style={styles.grid} key={`${calYear}-${calMonth}`}>
              {cells.map((s, i) =>
                s ? (
                  <DayCell
                    key={s}
                    dateStr={s}
                    delay={delays[i]}
                    past={isPast(s)}
                    today={s === todayStr}
                    selected={s === resDate}
                    onPress={() => selectDay(s)}
                  />
                ) : (
                  <View key={`e-${i}`} style={styles.cell} />
                ),
              )}
            </View>
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.label}>Horário</Text>
              <View style={styles.slots}>
                {slots.map(s => {
                  const on = s === resTime;
                  return (
                    <PressableScale
                      key={s}
                      onPress={() => { setResTime(s); setTimeError(null); }}
                      feedback="select"
                      scaleTo={0.88}
                      style={[styles.slot, on && styles.slotOn]}
                    >
                      {on && <LinearGradient colors={gradients.primaryShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />}
                      <Text style={[styles.slotText, on && { color: '#fff' }]}>{s}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Field
                label="Outro horário (HH:MM)"
                icon="schedule"
                value={resTime}
                onChangeText={(v) => {
                  const t = v.replace(/\D/g, '').slice(0, 4);
                  setResTime(t.length > 2 ? t.slice(0, 2) + ':' + t.slice(2) : t);
                  setTimeError(null);
                }}
                keyboardType="numeric"
                maxLength={5}
                error={timeError}
                style={{ marginTop: 12 }}
              />
            </View>

            <View>
              <Text style={styles.label}>Número de pessoas</Text>
              <View style={styles.counter}>
                <PressableScale onPress={() => changeParty(-1)} disabled={party <= 1} style={styles.counterBtn} scaleTo={0.8} accessibilityLabel="Menos uma pessoa">
                  <MaterialIcons name="remove" size={24} color={colors.text} />
                </PressableScale>
                <View style={{ alignItems: 'center', minWidth: 90 }}>
                  <Animated.Text style={[styles.counterValue, { transform: [{ scale: bump }] }]}>{party}</Animated.Text>
                  <Text style={styles.counterUnit}>{party === 1 ? 'pessoa' : 'pessoas'}</Text>
                </View>
                <PressableScale onPress={() => changeParty(1)} disabled={party >= 20} style={styles.counterBtn} scaleTo={0.8} accessibilityLabel="Mais uma pessoa">
                  <MaterialIcons name="add" size={24} color={colors.text} />
                </PressableScale>
              </View>
            </View>

            <Field
              label="Observações (opcional)"
              icon="edit-note"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={300}
            />

            <GradientButton
              title="Confirmar reserva"
              iconRight="check"
              loading={submitting}
              disabled={!resTime}
              onPress={submit}
            />
          </View>
        )}
      </Animated.View>
      <GradientButton title="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  monthLabel: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textHint },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dayToday: { borderWidth: 1.5, borderColor: colors.cyan },
  dayText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.textHint, textTransform: 'uppercase', marginBottom: 10 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    paddingHorizontal: 14, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine,
  },
  slotOn: { borderColor: 'transparent' },
  slotText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSub },
  counter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, borderRadius: 24, padding: 10,
  },
  counterBtn: {
    width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(143,84,254,0.18)', borderWidth: 1, borderColor: 'rgba(143,84,254,0.4)',
  },
  counterValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.text, letterSpacing: -1 },
  counterUnit: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textHint, letterSpacing: 0.6 },
});
