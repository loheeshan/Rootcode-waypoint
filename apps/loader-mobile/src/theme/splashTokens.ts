import { colors } from './colors';

export const splash = {
  bg: '#0F1F5A',
  glow: '#2447B8',
  guide: 'rgba(255,255,255,0.08)',
  curve: 'rgba(130,160,255,0.22)',

  logoFill: 'rgba(36,71,184,0.35)',
  logoBorder: '#3558D6',
  logoStroke: 'rgba(157,184,245,0.45)',
  dotLight: colors.blueBorder,
  dotBlue: colors.blue,
  statusGreen: colors.green,
  statusRing: colors.ink,

  title: colors.onDark,
  subtitle: colors.onDarkMuted,
  tagline: '#B4BEDB',

  pillBg: 'rgba(255,255,255,0.06)',
  pillBorder: 'rgba(255,255,255,0.14)',

  barTrack: 'rgba(255,255,255,0.14)',
  barFill: '#3B62E6',
  barTip: '#EAF0FF',

  meta: '#7F8BB0',
  divider: 'rgba(255,255,255,0.12)',
} as const;