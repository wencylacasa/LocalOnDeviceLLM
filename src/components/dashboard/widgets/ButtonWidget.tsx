import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ButtonWidget as ButtonWidgetType } from '../types';

interface Props {
  widget: ButtonWidgetType;
}

export function ButtonWidget({ widget }: Props) {
  const accent = widget.color ?? '#3c87f7';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: accent, opacity: pressed ? 0.75 : 1 },
      ]}
      accessible
      accessibilityRole="button"
    >
      <ThemedText type="smallBold" style={styles.label}>
        {widget.label}
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
