import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { ListWidget as ListWidgetType } from '../types';

interface Props {
  widget: ListWidgetType;
}

export function ListWidget({ widget }: Props) {
  const theme = useTheme();
  const accent = widget.color ?? '#3c87f7';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {widget.label}
      </ThemedText>
      <View style={styles.list}>
        {widget.items.map((item, i) => (
          <View key={i} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <ThemedText type="small" style={styles.itemText}>
              {item}
            </ThemedText>
          </View>
        ))}
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
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
});
