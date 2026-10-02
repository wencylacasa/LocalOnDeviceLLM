import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { ProgressWidget } from '../types';

interface Props {
  widget: ProgressWidget;
}

export function ProgressRing({ widget }: Props) {
  const theme = useTheme();
  const accent = widget.color ?? '#34c759';
  const pct = Math.max(0, Math.min(1, widget.value));
  const percentText = `${Math.round(pct * 100)}%`;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.label}>
          {widget.label}
        </ThemedText>
        <ThemedText style={[styles.pct, { color: accent }]}>{percentText}</ThemedText>
      </View>

      {/* Track bar */}
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct * 100}%` as any,
              backgroundColor: accent,
            },
          ]}
        />
      </View>

      {widget.subtext ? (
        <ThemedText type="small" themeColor="textSecondary">
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
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
  pct: {
    fontSize: 18,
    fontWeight: '700',
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
});
