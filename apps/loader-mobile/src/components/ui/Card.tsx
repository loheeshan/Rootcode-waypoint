// src/components/ui/Card.tsx
import { StyleSheet, View, type ViewProps } from 'react-native';
import { t } from '../../theme/loaderTokens';

type Props = ViewProps & { dark?: boolean };

export function Card({ dark, style, ...rest }: Props) {
  return <View style={[styles.card, dark && styles.dark, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: t.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: t.border,
  },
  dark: { backgroundColor: t.navy, borderColor: t.navy },
});