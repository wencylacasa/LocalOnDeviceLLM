import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { DEFAULT_ICON, ICONS } from '../icons';
import type { StatWidget } from '../types';

interface Props {
  widget: StatWidget;
  compact?: boolean;
}

export function StatCard({ widget, compact = false }: Props) {
  const theme = useTheme();
  const accent = widget.color ?? '#3c87f7';
  const icon = widget.icon ? (ICONS[widget.icon] ?? ICONS[DEFAULT_ICON]) : undefined;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderLeftColor: accent },
        compact && styles.compact,
      ]}
    >
      <View style={styles.topRow}>
        {icon && (
          <View style={[styles.iconBadge, { backgroundColor: accent + '22' }]}>
            <SymbolView
              name={{ ios: icon.ios, android: icon.android, web: icon.android }}
              tintColor={accent}
              size={compact ? 16 : 20}
            />
          </View>
        )}
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.label}
          numberOfLines={1}
        >
          {widget.label}
        </ThemedText>
      </View>

      <ThemedText
        style={[styles.value, compact && styles.valueCompact, { color: theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {widget.value}
      </ThemedText>

      {widget.subtext ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {widget.subtext}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    borderLeftWidth: 4,
    gap: Spacing.one,
    flex: 1,
  },
  compact: {
    padding: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  valueCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
});
