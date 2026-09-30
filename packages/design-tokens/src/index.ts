// Starter values; replace with the approved Figma tokens before feature work.
export const colors = { ink: '#142C3A', muted: '#526772', primary: '#176B57', background: '#F5F7F8', surface: '#FFFFFF', border: '#DCE4E8', warning: '#9A5B00', danger: '#B42318' } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { sm: 6, md: 12, lg: 20 } as const;
export const typography = { body: 16, label: 14, heading: 28 } as const;
export const statusColors = { PENDING: colors.warning, SYNCING: colors.primary, SYNCED: colors.primary, FAILED: colors.danger } as const;
