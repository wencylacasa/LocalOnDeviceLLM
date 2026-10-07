import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ButtonWidget as ButtonWidgetType } from '../types';

interface Props {
  widget: ButtonWidgetType;
}

/** How long the "Done" confirmation stays before the label comes back. */
const CONFIRM_MS = 1500;

export function ButtonWidget({ widget }: Props) {
  const accent = widget.color ?? '#3c87f7';
  const [confirmed, setConfirmed] = useState(false);

  // Generated buttons have no real action behind them, so a tap confirms
  // itself briefly instead of looking broken.
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => setConfirmed(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmed]);

  return (
    <Pressable
      onPress={() => setConfirmed(true)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: accent, opacity: pressed ? 0.75 : 1 },
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={widget.label}>
      <ThemedText type="smallBold" style={styles.label}>
        {confirmed ? '✓ Done' : widget.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
  },
});
