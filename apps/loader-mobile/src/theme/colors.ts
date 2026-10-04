/** Loader app design tokens. Every component imports from here, never hard-codes a hex. */
export const colors = {
  bg: '#F1F4F9',
  surface: '#FFFFFF',
  border: '#DDE3EE',

  ink: '#0B1228', // primary text, dark banner
  inkSoft: '#161F3D',
  muted: '#6B7391',
  onDark: '#FFFFFF',
  onDarkMuted: '#9AA5C4',

  blue: '#2F66E8',
  blueSoft: '#E4EDFF',
  blueBorder: '#9DB8F5',

  green: '#16A068',
  greenSoft: '#DDF4E8',
  greenBorder: '#9ADBBB',

  amber: '#B45309',
  amberSoft: '#FFF4D6',
  amberBorder: '#F3D27A',

  red: '#E5383B',
  violet: '#6D4AE0',
  violetSoft: '#ECE7FD',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;