import { useLLMChatSession, type llm } from 'react-native-executorch';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
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
import { LLM_MODEL, LLM_NAME } from '@/constants/llm';
import { findLoopUnit, trimLoop } from '@/lib/repetition';

type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Placeholder bubble for a failed turn. It never reaches the model. */
  isError?: boolean;
};

const MAX_NEW_TOKENS = 512;
// Tokens kept free for chat-template overhead on top of the user's message.
const CONTEXT_RESERVE = 48;
// If fewer tokens than this are left for a reply, the conversation is "full".
const MIN_REPLY_TOKENS = 96;
// Update the bubble every N tokens instead of on every single one.
const TOKENS_PER_UI_UPDATE = 3;
// Check for a repetition loop every N tokens.
const TOKENS_PER_LOOP_CHECK = 6;

// "/no_think" is Qwen3's soft switch to skip the long reasoning preamble.
const SYSTEM_MESSAGE: llm.ChatMessage = {
  role: 'system',
  content:
    'You are a helpful on-device assistant. Keep answers concise. ' +
    'Answer once and then stop; never repeat yourself or restate what you already said. /no_think',
};

// Qwen3 can "think" out loud inside <think>...</think>. Hide that from the bubble.
function splitThinking(raw: string) {
  const withoutClosed = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const openIndex = withoutClosed.indexOf('<think>');
  const isThinking = openIndex !== -1;
  const visible = (isThinking ? withoutClosed.slice(0, openIndex) : withoutClosed).trim();
  return { visible, isThinking };
}

/**
 * Turns the visible bubbles back into model history. Failed or empty turns are
 * dropped together with the user message they were answering, which is what
 * the session itself does when a turn fails.
 */
function toHistory(items: ChatItem[]): llm.ChatMessage[] {
  const out: llm.ChatMessage[] = [];
  for (const m of items) {
    if (m.role === 'assistant' && (m.isError || !m.content)) {
      out.pop();
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

/**
 * The model session keeps the whole conversation in its KV cache and has no
 * "clear" method, so "New chat" remounts the session (via `key`), which
 * disposes the old model instance and loads a fresh one.
 */
export default function ChatScreen() {
  const [chatId, setChatId] = useState(0);
  return <ChatSession key={chatId} onNewChat={() => setChatId((n) => n + 1)} />;
}

function ChatSession({ onNewChat }: { onNewChat: () => void }) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [contextFull, setContextFull] = useState(false);
  const [looped, setLooped] = useState(false);

  // Downloads the model on first launch (cached afterwards), then loads it into memory.
  const session = useLLMChatSession(LLM_MODEL, {
    // Only the visible tab keeps the model in memory (Chat and Design would
    // otherwise hold one copy each). A reply that is still streaming keeps
    // it alive until it finishes.
    preventLoad: !isFocused && !isGenerating,
    // Replays the conversation so far, so coming back to this tab reloads a
    // model that still remembers it. Read when the model (re)loads.
    initialMessages: [SYSTEM_MESSAGE, ...toHistory(messages)],
    generationConfig: {
      // A touch warmer than before: with no repetition penalty available,
      // very low temperatures make small models loop.
      temperature: 0.8,
      maxNewTokens: MAX_NEW_TOKENS,
    },
  });

  const canSend = session.isReady && !isGenerating && !contextFull && input.trim().length > 0;
  const canReset = !isGenerating && (session.isReady || !!session.error);

  /** Tokens still available for a reply, after reserving space for the user's message. */
  function tokenRoom(extraChars = 0) {
    const kv = session.getKVCacheState?.();
    if (!kv) return MAX_NEW_TOKENS;
    return kv.remainingTokens - CONTEXT_RESERVE - Math.ceil(extraChars / 3);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isGenerating || contextFull || !session.isReady || !session.sendMessage) return;

    // Never start a turn the context window can't hold; it would just fail.
    const room = tokenRoom(text.length);
    if (room < MIN_REPLY_TOKENS) {
      setContextFull(true);
      return;
    }

    const stamp = Date.now().toString();
    const assistantId = `${stamp}-a`;

    setInput('');
    setLooped(false);
    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      { id: `${stamp}-u`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    // Tokens are buffered and flushed in small batches so the list doesn't
    // re-render (and re-scroll) once per token.
    let pending = '';
    let generated = '';
    let count = 0;
    let loopStopped = false;
    const flush = () => {
      if (!pending) return;
      const chunk = pending;
      pending = '';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
      );
    };

    try {
      await session.sendMessage(
        text,
        (token) => {
          pending += token;
          generated += token;
          count += 1;
          if (count % TOKENS_PER_UI_UPDATE === 0) flush();

          // Stuck repeating itself: stop now instead of burning the rest of
          // the token budget. The repeats are trimmed once the run ends.
          if (!loopStopped && count % TOKENS_PER_LOOP_CHECK === 0 && findLoopUnit(generated)) {
            loopStopped = true;
            session.stop?.();
          }
        },
        // Don't let the reply run past the end of the context window.
        { maxNewTokens: Math.min(MAX_NEW_TOKENS, room) },
      );
    } catch {
      flush();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: 'Something went wrong while generating a reply.', isError: true }
            : m,
        ),
      );
    } finally {
      flush();
      if (loopStopped) {
        setLooped(true);
        const clean = trimLoop(generated);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: clean } : m)),
        );
      }
      setIsGenerating(false);
      if (tokenRoom() < MIN_REPLY_TOKENS) setContextFull(true);
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
    status = `Could not load ${LLM_NAME}: ${session.error.message}`;
  } else if (!session.isReady) {
    status =
      session.downloadProgress < 100
        ? `Downloading ${LLM_NAME} (first launch only, use Wi-Fi)… ${Math.round(session.downloadProgress)}%`
        : `Loading ${LLM_NAME} into memory…`;
  } else if (contextFull) {
    status = "This conversation has used up the model's memory. Tap “New chat” to keep going.";
  } else if (looped) {
    // The repeated text is still in the model's history, so it can echo it.
    status = 'The model started repeating itself, so I stopped it. If it keeps happening, tap “New chat”.';
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="subtitle" style={styles.title}>
              Local Chat
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {LLM_NAME} · runs fully on your device
            </ThemedText>
          </View>
          <Pressable
            onPress={onNewChat}
            disabled={!canReset}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            style={[
              styles.newChat,
              { backgroundColor: theme.backgroundElement },
              !canReset && styles.buttonDisabled,
            ]}>
            <ThemedText type="smallBold">New chat</ThemedText>
          </Pressable>
        </View>

        {status && (
          <ThemedView type="backgroundElement" style={styles.status}>
            <ThemedText type="small">{status}</ThemedText>
          </ThemedView>
        )}

        {/* Wraps the list and the input so the whole column moves with the
            keyboard. Android needs 'height' here (edge-to-edge no longer
            resizes the window for us). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentFlex}>
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            // Non-animated: an animated scroll per streamed token is janky.
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {session.isReady ? 'Say hi to start chatting.' : 'The model is getting ready.'}
              </ThemedText>
            }
          />

          <View style={styles.inputContainer}>
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
                editable={session.isReady && !contextFull}
                multiline
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
    width: '100%',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
  },
  newChat: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  status: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  contentFlex: {
    flex: 1,
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
  inputContainer: {
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
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
