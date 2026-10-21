import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { Moment } from '../types';
import { colors, fonts, gradients } from '../theme';

type Props = { moment: Moment; width?: number; height?: number; showPlace?: boolean; onPress: () => void };

/** Photo card with pin / restaurant-like badges and a like + comment footer. */
export default function MomentTile({ moment, width = 150, height = 200, showPlace, onPress }: Props) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={[styles.tile, { width, height }]} accessibilityLabel={`Momento de ${moment.user_name}`}>
      <Image source={{ uri: moment.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={gradients.shade} locations={[0.45, 0.75, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.badges}>
        {moment.is_pinned && (
          <View style={[styles.badge, { backgroundColor: colors.gold }]}>
            <MaterialIcons name="push-pin" size={11} color={colors.void} />
          </View>
        )}
        {moment.liked_by_restaurant && (
          <View style={[styles.badge, { backgroundColor: colors.cyan }]}>
            <MaterialIcons name="storefront" size={11} color={colors.void} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {showPlace && <Text style={styles.place} numberOfLines={1}>{moment.restaurant_name}</Text>}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <MaterialIcons name="favorite" size={12} color={moment.liked_by_me ? colors.danger : '#fff'} />
            <Text style={styles.statText}>{moment.like_count}</Text>
          </View>
          <View style={styles.stat}>
            <MaterialIcons name="chat-bubble" size={11} color="#fff" />
            <Text style={styles.statText}>{moment.comment_count}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.night, borderWidth: 1, borderColor: colors.glassLine },
  badges: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 5 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 4 },
  place: { fontFamily: fonts.displaySemi, fontSize: 13, color: '#fff', letterSpacing: -0.2 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#fff' },
});
