import { Platform } from 'react-native';
import type { RestaurantQueue } from '../types';

export const colors = {
  void: '#0A0617',
  night: '#120B2B',
  deep: '#21184A',
  plum: '#2A1D63',

  purple: '#8F54FE',
  violet: '#6B5CFF',
  cyan: '#64EBE2',
  blue: '#0000FF',
  white: '#FFFFFF',

  text: '#F6F3FF',
  textSub: 'rgba(246,243,255,0.68)',
  textHint: 'rgba(246,243,255,0.42)',

  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  glassLine: 'rgba(255,255,255,0.12)',
  glassLineStrong: 'rgba(255,255,255,0.22)',

  success: '#64EBE2',
  warning: '#FFB86B',
  danger: '#FF5C7A',
  gold: '#FFD27A',
} as const;

export const gradients = {
  primary: ['#8F54FE', '#6B5CFF', '#64EBE2'] as const,
  primaryShort: ['#8F54FE', '#64EBE2'] as const,
  electric: ['#0000FF', '#8F54FE'] as const,
  hot: ['#FF5C7A', '#FFB86B'] as const,
  danger: ['#FF6B8B', '#E5484D'] as const,
  night: ['#21184A', '#120B2B', '#0A0617'] as const,
  shade: ['rgba(10,6,23,0)', 'rgba(10,6,23,0.55)', 'rgba(10,6,23,0.96)'] as const,
};

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  displayMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
};

export const radii = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export const shadow = (color: string = colors.purple, opacity = 0.45, radius = 18, y = 10) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y } },
    android: { elevation: Math.round(radius / 2) },
    default: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y } },
  });

export type OccLevel = 'low' | 'medium' | 'high';

export const occupancyTheme: Record<OccLevel, { label: string; color: string; gradient: readonly [string, string] }> = {
  low: { label: 'Tranquilo', color: colors.cyan, gradient: ['#64EBE2', '#3DD6CB'] },
  medium: { label: 'Movimentado', color: colors.warning, gradient: ['#8F54FE', '#FFB86B'] },
  high: { label: 'Lotado', color: colors.danger, gradient: ['#FF5C7A', '#FFB86B'] },
};

export function occupancyOf(q?: RestaurantQueue | null) {
  const pct = q && q.max_tables ? Math.min(100, Math.round((q.current_tables / q.max_tables) * 100)) : 0;
  const level: OccLevel = pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high';
  return { pct, level, ...occupancyTheme[level] };
}

export function initialsOf(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

export const reservationStatus: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendente', color: colors.warning, icon: 'hourglass-empty' },
  CONFIRMED: { label: 'Confirmada', color: colors.cyan, icon: 'check-circle' },
  CHECKED_IN: { label: 'Check-in feito', color: colors.purple, icon: 'place' },
  CANCELLED: { label: 'Cancelada', color: colors.danger, icon: 'cancel' },
  COMPLETED: { label: 'Concluída', color: '#9EA8FF', icon: 'done-all' },
};
