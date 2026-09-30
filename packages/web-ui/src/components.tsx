import type { ReactNode } from 'react';
import { colors, radii, spacing } from '@waypoint/design-tokens';
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ background: colors.surface, border: '1px solid ' + colors.border, borderRadius: radii.md, padding: spacing.lg }}><h2>{title}</h2>{children}</section>;
}
export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div role="status"><h3>{title}</h3><p>{message}</p></div>;
}
