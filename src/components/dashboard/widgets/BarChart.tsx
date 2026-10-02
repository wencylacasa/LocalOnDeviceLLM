import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { ChartWidget } from '../types';

interface Props {
  widget: ChartWidget;
}

const MAX_BARS = 10;

export function BarChart({ widget }: Props) {
  const theme = useTheme();
  const accent = widget.color ?? '#3c87f7';

  const data = widget.data.slice(0, MAX_BARS);
  const max = Math.max(...data, 1);
  const labels = widget.xLabels ?? [];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
        {widget.label}
      </ThemedText>

      <View style={styles.chartArea}>
        {data.map((val, i) => {
          const pct = val / max;
          return (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(pct * 100, 4)}%` as any, backgroundColor: accent },
                  ]}
                />
              </View>
              {labels[i] ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.xLabel}>
                  {labels[i]}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* y-axis hint */}
      <View style={styles.yAxis}>
        <ThemedText type="small" themeColor="textSecondary">{max.toLocaleString()}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">0</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    marginBottom: Spacing.one,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 4,
    paddingLeft: 28,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  xLabel: {
    fontSize: 9,
  },
  yAxis: {
    position: 'absolute',
    left: Spacing.three,
    top: Spacing.three + 20,
    bottom: Spacing.three,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: 24,
  },
});
