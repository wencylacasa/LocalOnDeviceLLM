import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DashboardSpec, Widget } from './types';
import { StatCard } from './widgets/StatCard';
import { BarChart } from './widgets/BarChart';
import { ProgressRing } from './widgets/ProgressRing';
import { ListWidget } from './widgets/ListWidget';
import { HeaderWidget } from './widgets/HeaderWidget';
import { ButtonWidget } from './widgets/ButtonWidget';

interface Props {
  spec: DashboardSpec;
}

export function DashboardRenderer({ spec }: Props) {
  return (
    <View style={styles.container}>
      {spec.widgets.map((widget, i) => (
        <WidgetRenderer key={`widget-${i}`} widget={widget} />
      ))}
    </View>
  );
}

function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'stat':
      return <StatCard widget={widget} />;
    case 'chart':
      return <BarChart widget={widget} />;
    case 'progress':
      return <ProgressRing widget={widget} />;
    case 'list':
      return <ListWidget widget={widget} />;
    case 'header':
      return <HeaderWidget widget={widget} />;
    case 'button':
      return <ButtonWidget widget={widget} />;
    case 'grid':
      return (
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            {widget.items.slice(0, 2).map((item, i) => (
              <StatCard key={`grid-0-${i}`} widget={item} compact />
            ))}
          </View>
          {widget.items.length > 2 && (
            <View style={styles.gridRow}>
              {widget.items.slice(2, 4).map((item, i) => (
                <StatCard key={`grid-1-${i}`} widget={item} compact />
              ))}
            </View>
          )}
        </View>
      );
    default:
      // Unknown widget type - safely ignore or render a placeholder
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  grid: {
    gap: Spacing.two,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
