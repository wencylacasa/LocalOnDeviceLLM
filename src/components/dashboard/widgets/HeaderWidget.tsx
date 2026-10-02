import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { HeaderWidget as HeaderWidgetType } from '../types';

interface Props {
  widget: HeaderWidgetType;
}

export function HeaderWidget({ widget }: Props) {
  const theme = useTheme();
  const accent = widget.color;

  return (
    <View style={styles.container}>
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      <View style={styles.textBlock}>
        <ThemedText
          type="subtitle"
          style={[styles.title, { color: theme.text }]}
          numberOfLines={2}
        >
          {widget.label}
        </ThemedText>
        {widget.subtext ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {widget.subtext}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  accentBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
});
