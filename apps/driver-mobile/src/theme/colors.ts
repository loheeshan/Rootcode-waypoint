// Waypoint Driver — design tokens (splash screen palette).
// Later you can move these into packages/design-tokens.
export const colors = {
  bgTop: '#162A78',
  bgMid: '#1B3A93',
  bgLow: '#13266B',
  bgBottom: '#18265E',
  background: '#0B1222',
  surface: '#111A2E',
  surfaceAlt: '#16213A',
  card: '#1A2440',
  primary: '#3B4FE0',
  border: '#2A3555',
  textPrimary: '#FFFFFF',
  warning: '#F5A623',
  danger: '#EF4444',

  white: '#FFFFFF',
  textSecondary: 'rgba(214, 224, 255, 0.78)',
  textMuted: 'rgba(170, 186, 235, 0.55)',

  logoFill: 'rgba(40, 70, 190, 0.35)',
  logoBorder: '#3C5FE0',
  dotLight: '#A9C4FF',
  dotBlue: '#3B5BFF',

  success: '#1FC27D',
  pillBg: 'rgba(255, 255, 255, 0.07)',
  pillBorder: 'rgba(255, 255, 255, 0.14)',

  trackBg: 'rgba(255, 255, 255, 0.12)',
  barStart: '#3B5BFF',
  barEnd: '#E6ECFF',
  guide: 'rgba(255, 255, 255, 0.10)',
  curve: 'rgba(120, 150, 255, 0.28)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };