import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Glass from './Glass';
import PressableScale from './PressableScale';
import type { MyReservation } from '../services/restaurant';
import { colors, fonts, reservationStatus } from '../theme';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

type Props = {
  r: MyReservation;
  onPress?: () => void;
  footer?: React.ReactNode;
};

/** Reservation as a perforated event ticket. */
export default function Ticket({ r, onPress, footer }: Props) {
  const cfg = reservationStatus[r.status] ?? reservationStatus.PENDING;
  const [y, m, d] = r.date.split('-').map(Number);
  const weekday = WEEK[new Date(y, m - 1, d).getDay()];

  const body = (
    <Glass style={styles.ticket}>
      <View style={styles.row}>
        <View style={styles.stub}>
          <Text style={styles.week}>{weekday}</Text>
          <Text style={[styles.day, { color: cfg.color }]}>{String(d).padStart(2, '0')}</Text>
          <Text style={styles.month}>{MONTHS[m - 1]}</Text>
        </View>

        <View style={styles.perf}>
          <View style={[styles.notch, { top: -9 }]} />
          {Array.from({ length: 7 }).map((_, i) => <View key={i} style={styles.perfDot} />)}
          <View style={[styles.notch, { bottom: -9 }]} />
        </View>

        <View style={styles.main}>
          <View style={[styles.status, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
            <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{r.status_display || cfg.label}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{r.restaurant_name}</Text>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={14} color={colors.cyan} />
              <Text style={styles.metaText}>{r.time.slice(0, 5)}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="group" size={14} color={colors.cyan} />
              <Text style={styles.metaText}>{r.party_size} {r.party_size === 1 ? 'pessoa' : 'pessoas'}</Text>
            </View>
          </View>
          {!!r.notes && <Text style={styles.notes} numberOfLines={2}>“{r.notes}”</Text>}
        </View>
      </View>
      {footer}
    </Glass>
  );

  return onPress ? <PressableScale onPress={onPress} scaleTo={0.97}>{body}</PressableScale> : body;
}

const styles = StyleSheet.create({
  ticket: { borderRadius: 22 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  stub: { width: 78, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  week: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4, color: colors.textHint, textTransform: 'uppercase' },
  day: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  month: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSub },
  perf: { width: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 10 },
  perfDot: { width: 2, height: 5, borderRadius: 1, backgroundColor: colors.glassLineStrong },
  notch: { position: 'absolute', left: -8.5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.void, borderWidth: 1, borderColor: colors.glassLine },
  main: { flex: 1, padding: 14, paddingLeft: 16, gap: 6 },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.4 },
  name: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  meta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSub },
  notes: { fontFamily: fonts.body, fontSize: 12, color: colors.textHint, fontStyle: 'italic' },
});
