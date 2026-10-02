import { models, useLLMChatSession } from 'react-native-executorch';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

// Qwen3 can "think" out loud inside <think>...</think>. Hide that from the bubble.
function splitThinking(raw: string) {
  const withoutClosed = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const openIndex = withoutClosed.indexOf('<think>');
  const isThinking = openIndex !== -1;
  const visible = (isThinking ? withoutClosed.slice(0, openIndex) : withoutClosed).trim();
  return { visible, isThinking };
}

export default function ChatScreen() {
  const theme = useTheme();
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Downloads Qwen3 0.6B on first launch (cached afterwards), then loads it into memory.
  const session = useLLMChatSession(models.llm.QWEN3_0_6B.DEFAULT, {
    initialMessages: [
      // "/no_think" is Qwen3's soft switch to skip the long reasoning preamble.
      { role: 'system', content: 'You are a helpful on-device assistant. Keep answers concise. /no_think' },
    ],
    generationConfig: {
      temperature: 0.7,
      maxNewTokens: 512,
    },
  });

  const canSend = session.isReady && !isGenerating && input.trim().length > 0;

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isGenerating || !session.isReady || !session.sendMessage) return;

    const stamp = Date.now().toString();
    const assistantId = `${stamp}-a`;

    setInput('');
    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      { id: `${stamp}-u`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      await session.sendMessage(text, (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
        );
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: 'Something went wrong while generating a reply.' }
            : m,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStop() {
    session.stop?.();
  }

  function renderItem({ item }: { item: ChatItem }) {
    const isUser = item.role === 'user';
    const { visible, isThinking } = splitThinking(item.content);
    const text = visible || (isGenerating ? (isThinking ? 'Thinking…' : '…') : '');

    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
        <View
          style={[
            styles.bubble,
            { backgroundColor: isUser ? theme.primary : theme.backgroundElement },
          ]}>
          <ThemedText style={isUser ? styles.userText : undefined}>{text}</ThemedText>
        </View>
      </View>
    );
  }

  let status: string | null = null;
  if (session.error) {
    status = `Could not load the model: ${session.error.message}`;
  } else if (!session.isReady) {
    status = `Downloading / loading Qwen3 0.6B… ${Math.round(session.downloadProgress)}%`;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Local Chat
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Qwen3 0.6B · runs fully on your device
        </ThemedText>

        {status && (
          <ThemedView type="backgroundElement" style={styles.status}>
            <ThemedText type="small">{status}</ThemedText>
          </ThemedView>
        )}

        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {session.isReady ? 'Say hi to start chatting.' : 'The model is getting ready.'}
            </ThemedText>
          }
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder={session.isReady ? 'Message' : 'Loading model…'}
              placeholderTextColor={theme.textSecondary}
              editable={session.isReady}
              multiline
              onSubmitEditing={handleSend}
            />
            {isGenerating ? (
              <Pressable onPress={handleStop} style={[styles.button, styles.stopButton]}>
                <ThemedText type="smallBold" style={styles.userText}>
                  Stop
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={[styles.button, { backgroundColor: theme.primary }, !canSend && styles.buttonDisabled]}>
                <ThemedText type="smallBold" style={styles.userText}>
                  Send
                </ThemedText>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
  },
  status: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  userText: {
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  button: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: '#d9534f',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
