import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import GradientButton from '../../components/GradientButton';
import Avatar from '../../components/Avatar';
import { useUI } from '../../components/Dialog';
import { createReview } from '../../services/restaurant';
import { Restaurant, Review } from '../../types';
import { colors, fonts } from '../../theme';
import { haptic } from '../../motion';
import StarRating from './StarRating';

const MOODS = ['', 'Péssimo', 'Fraco', 'Ok', 'Muito bom', 'Incrível!'];

export function ReviewSheet({ visible, restaurant, onClose, onSubmitted }: {
  visible: boolean; restaurant: Restaurant; onClose: () => void; onSubmitted: (r: Review) => void;
}) {
  const ui = useUI();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) { setStars(0); setComment(''); }
  }, [visible]);

  async function submit() {
    if (stars === 0) {
      haptic.error();
      ui.toast('Selecione pelo menos 1 estrela.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const review = await createReview(restaurant.id, stars, comment.trim());
      onSubmitted(review);
    } catch (err: any) {
      const msg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Não foi possível enviar avaliação.';
      ui.alert({ tone: 'danger', title: 'Avaliação não enviada', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Sua avaliação" subtitle={restaurant.name}>
      <View style={styles.starsBox}>
        <StarRating value={stars} onChange={setStars} size={46} gap={6} />
        <Text style={[styles.mood, { color: stars ? colors.gold : colors.textHint }]}>
          {stars ? MOODS[stars] : 'Toque para avaliar'}
        </Text>
      </View>
      <Field
        label="Conte sua experiência (opcional)"
        icon="rate-review"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={500}
      />
      <View style={styles.actions}>
        <GradientButton title="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
        <GradientButton title="Enviar" iconRight="send" size="md" loading={submitting} onPress={submit} style={{ flex: 1.4 }} />
      </View>
    </Sheet>
  );
}

export function ReviewerSheet({ review, onClose }: { review: Review | null; onClose: () => void }) {
  const [shown, setShown] = useState<Review | null>(review);
  useEffect(() => { if (review) setShown(review); }, [review]);
  const pr = shown;

  const grouped = (pr?.user_preferences ?? []).reduce((acc: Record<string, string[]>, p) => {
    const cat = p.category || 'Outros';
    (acc[cat] ??= []).push(p.name);
    return acc;
  }, {});

  return (
    <Sheet visible={!!review} onClose={onClose}>
      {pr && (
        <View style={{ gap: 18 }}>
          <View style={styles.hero}>
            <Avatar name={pr.user_name} photo={pr.user_photo_url} size={76} ring={3} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{pr.user_name}</Text>
              <View style={styles.badge}>
                <MaterialIcons name="verified" size={12} color={colors.cyan} />
                <Text style={styles.badgeText}>Cliente VYU</Text>
              </View>
            </View>
          </View>

          {(!!pr.user_email || !!pr.user_phone) && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Dados pessoais</Text>
              {!!pr.user_email && (
                <View style={styles.row}>
                  <MaterialIcons name="alternate-email" size={16} color={colors.cyan} />
                  <Text style={styles.rowText}>{pr.user_email}</Text>
                </View>
              )}
              {!!pr.user_phone && (
                <View style={styles.row}>
                  <MaterialIcons name="call" size={16} color={colors.cyan} />
                  <Text style={styles.rowText}>{pr.user_phone}</Text>
                </View>
              )}
            </View>
          )}

          {Object.keys(grouped).length > 0 && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Preferências alimentares</Text>
              {Object.entries(grouped).map(([cat, items]) => (
                <View key={cat} style={{ gap: 8 }}>
                  <Text style={styles.cat}>{cat}</Text>
                  <View style={styles.chips}>
                    {items.map(item => (
                      <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <GradientButton title="Fechar" variant="ghost" size="md" onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  starsBox: { alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 12 },
  mood: { fontFamily: fonts.displaySemi, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.cyan },
  box: { gap: 10, padding: 16, borderRadius: 22, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine },
  boxTitle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.textHint, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.text },
  cat: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(143,84,254,0.16)', borderWidth: 1, borderColor: 'rgba(143,84,254,0.4)' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
});
