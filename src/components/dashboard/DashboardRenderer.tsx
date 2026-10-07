import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { ThemeOverrideContext } from '@/hooks/use-theme';
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
  // The model usually puts a header widget first, but not always. Show the
  // spec's own title when it didn't, so the dashboard is never untitled.
  const startsWithHeader = spec.widgets[0]?.type === 'header';

  const body = (
    <View style={styles.container}>
      {!startsWithHeader && !!spec.title && (
        <ThemedText type="subtitle" numberOfLines={2}>
          {spec.title}
        </ThemedText>
      )}
      {spec.widgets.map((widget, i) => (
        <WidgetRenderer key={`widget-${i}`} widget={widget} />
      ))}
    </View>
  );

  // "auto" follows the device. "light"/"dark" force that palette for the whole
  // dashboard and give it its own background panel so it reads on any screen.
  const forced = spec.theme === 'dark' || spec.theme === 'light' ? spec.theme : null;
  if (!forced) return body;

  return (
    <ThemeOverrideContext.Provider value={forced}>
      <View style={[styles.themedPanel, { backgroundColor: Colors[forced].background }]}>
        {body}
      </View>
    </ThemeOverrideContext.Provider>
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
    case 'grid': {
      const top = widget.items.slice(0, 2);
      const bottom = widget.items.slice(2, 4);
      return (
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            {top.map((item, i) => (
              <StatCard key={`grid-0-${i}`} widget={item} compact />
            ))}
          </View>
          {bottom.length > 0 && (
            <View style={styles.gridRow}>
              {bottom.map((item, i) => (
                <StatCard key={`grid-1-${i}`} widget={item} compact />
              ))}
              {/* A lone card keeps half width instead of stretching across the row. */}
              {bottom.length === 1 && <View style={styles.gridSpacer} />}
            </View>
          )}
        </View>
      );
    }
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
  themedPanel: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  grid: {
    gap: Spacing.two,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gridSpacer: {
    flex: 1,
  },
});
