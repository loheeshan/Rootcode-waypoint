import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { permissionColors } from '../theme/permissionColors';

type Props = {
  title: string;
  message: string;
};

export function WarningCard({ title, message }: Props) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: permissionColors.warningBackground,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: permissionColors.warningTitle,
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: permissionColors.warningText,
  },
});