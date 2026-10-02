import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// react-native-executorch only runs on iOS/Android, so the web build gets a placeholder.
export default function ChatScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Local Chat</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        On-device Qwen3 only runs in the iOS and Android development builds, not on web.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  text: {
    textAlign: 'center',
  },
});
