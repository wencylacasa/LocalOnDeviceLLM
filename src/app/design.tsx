import { useLLMChatSession } from 'react-native-executorch';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DashboardRenderer } from '@/components/dashboard/DashboardRenderer';
import { ICONS } from '@/components/dashboard/icons';
import { LLM_MODEL, LLM_NAME } from '@/constants/llm';
import { findLoopUnit, trimLoop } from '@/lib/repetition';
import { parseSpec, isValidSpec } from '@/components/dashboard/parseSpec';
import type { DashboardSpec } from '@/components/dashboard/types';

const MAX_NEW_TOKENS = 768;

/**
 * true:  load a fresh model session after every dashboard. Each prompt starts
 *        clean (a 0.6B model tends to copy the previous dashboard otherwise),
 *        at the cost of a model reload between runs.
 * false: keep the session warm and only swap it when the context window is
 *        nearly full. Faster back-to-back runs, but earlier dashboards stay in
 *        the model's history.
 */
const FRESH_SESSION_EVERY_RUN = true;

const SYSTEM_PROMPT = `You are an AI Dashboard Designer. /no_think
Your job is to generate a JSON specification for a dashboard layout based on the user's prompt.
You MUST output ONLY valid JSON. Do not include conversational text outside the JSON.

SCHEMA:
{
  "title": "string",
  "theme": "auto",
  "widgets": [ <widget>, <widget> ]
}

WIDGET TYPES:
1. stat: { "type": "stat", "label": "Steps", "value": "8,420", "icon": "figure.walk", "color": "#3c87f7", "subtext": "vs yesterday" }
2. chart: { "type": "chart", "label": "Weekly", "data": [1,2,3,4,5], "xLabels": ["M","T","W","T","F"], "color": "#3c87f7" }
3. progress: { "type": "progress", "label": "Goal", "value": 0.72, "color": "#34c759", "subtext": "72% done" }
4. list: { "type": "list", "label": "Activity", "items": ["Item 1", "Item 2"], "color": "#3c87f7" }
5. header: { "type": "header", "label": "Title", "subtext": "Subtitle", "color": "#3c87f7" }
6. button: { "type": "button", "label": "Tap Me", "color": "#3c87f7" }
7. grid: { "type": "grid", "items": [ { stat1 }, { stat2 }, { stat3 }, { stat4 } ] } (max 4 stat items)

Rules: use 4 to 6 widgets in total. Never repeat a widget or reuse the same label twice. Keep labels short. Numbers in "data" and the progress "value" must be unquoted numbers. Colors must be 6-digit hex like #3c87f7.
The "icon" value must be exactly one of: ${Object.keys(ICONS).join(', ')}.
Generate creative, realistic data.
Output ONLY JSON.`;

const EXAMPLES = [
  'A fitness tracker dashboard',
  'A weather widget with temp and humidity',
  'A crypto portfolio tracker',
  'A simple task manager',
];

type Result = {
  spec: DashboardSpec | null;
  error: string | null;
  raw: string;
};

const EMPTY_RESULT: Result = { spec: null, error: null, raw: '' };

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function buildResult(raw: string): Result {
  try {
    const spec = parseSpec(raw);
    if (isValidSpec(spec)) return { spec, error: null, raw };
    return {
      spec: null,
      raw,
      error: 'The generated dashboard is missing required fields (title, widgets).',
    };
  } catch (err) {
    return { spec: null, raw, error: `Could not parse JSON: ${errorMessage(err)}` };
  }
}

/**
 * The input and the last result live here, above the model session, so they
 * survive the session being swapped out for a fresh one (see DesignSession).
 */
export default function DesignScreen() {
  const [sessionId, setSessionId] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result>(EMPTY_RESULT);

  return (
    <DesignSession
      key={sessionId}
      input={input}
      setInput={setInput}
      result={result}
      setResult={setResult}
      onFreshSession={() => setSessionId((n) => n + 1)}
    />
  );
}

interface SessionProps {
  input: string;
  setInput: (value: string) => void;
  result: Result;
  setResult: (value: Result) => void;
  onFreshSession: () => void;
}

function DesignSession({ input, setInput, result, setResult, onFreshSession }: SessionProps) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const stoppedRef = useRef(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [livePreview, setLivePreview] = useState('');

  const session = useLLMChatSession(LLM_MODEL, {
    // Only the visible tab keeps the model in memory (Chat and Design would
    // otherwise hold one copy each). A run that is still going keeps it alive.
    preventLoad: !isFocused && !isGenerating,
    initialMessages: [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: {
      temperature: 0.7,
      maxNewTokens: MAX_NEW_TOKENS,
    },
  });

  const canGenerate = session.isReady && !isGenerating && input.trim().length > 0;

  async function handleGenerate(overridePrompt?: string) {
    const text = (overridePrompt ?? input).trim();
    if (!text || isGenerating || !session.isReady || !session.sendMessage) return;

    if (overridePrompt) {
      setInput(overridePrompt);
    }

    stoppedRef.current = false;
    setIsStopping(false);
    setResult(EMPTY_RESULT);
    setTokenCount(0);
    setLivePreview('');
    setIsGenerating(true);

    let generatedText = '';
    let count = 0;
    let loopStopped = false;
    let next: Result;
    try {
      await session.sendMessage(text, (token) => {
        generatedText += token;
        count += 1;
        // Throttled so a re-render per token doesn't slow generation down.
        if (count % 8 === 0) {
          setTokenCount(count);
          setLivePreview(generatedText.slice(-160));

          // Stuck repeating the same widget: stop instead of burning the rest
          // of the token budget. The repeats are trimmed before parsing.
          if (!loopStopped && findLoopUnit(generatedText)) {
            loopStopped = true;
            session.stop?.();
          }
        }
      });

      // A stopped run is cancelled, not parsed: half a dashboard isn't a result.
      // A loop stop is different: what finished before the loop is still good.
      next = stoppedRef.current
        ? EMPTY_RESULT
        : buildResult(loopStopped ? trimLoop(generatedText) : generatedText);
    } catch (err) {
      next = { spec: null, raw: generatedText, error: `Generation failed: ${errorMessage(err)}` };
    }

    setResult(next);
    setIsGenerating(false);
    setIsStopping(false);

    // The session keeps every turn in its history and has no "clear", so a
    // fresh one is swapped in (always, or once the context is nearly full; see
    // FRESH_SESSION_EVERY_RUN). Input and result are held by the parent, so
    // the screen keeps looking the same while it reloads.
    const kv = session.getKVCacheState?.();
    const nearlyFull = !kv || kv.remainingTokens < MAX_NEW_TOKENS + 256;
    if (FRESH_SESSION_EVERY_RUN || nearlyFull) onFreshSession();
  }

  function handleStop() {
    if (!isGenerating || isStopping) return;
    // Only ask the model to stop. isGenerating flips back once sendMessage
    // actually settles, so a new run can't overlap the one still winding down.
    stoppedRef.current = true;
    setIsStopping(true);
    session.stop?.();
  }

  let status: string | null = null;
  if (session.error) {
    status = `Could not load ${LLM_NAME}: ${session.error.message}`;
  } else if (!session.isReady) {
    status =
      session.downloadProgress < 100
        ? `Downloading ${LLM_NAME} (first launch only, use Wi-Fi)… ${Math.round(session.downloadProgress)}%`
        : `Loading ${LLM_NAME} into memory…`;
  }

  const { spec, error, raw } = result;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.headerRow}>
          <View>
            <ThemedText type="subtitle" style={styles.title}>
              AI Dashboard Designer
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Describe a dashboard, and {LLM_NAME} will build it.
            </ThemedText>
          </View>
        </View>

        {status && (
          <ThemedView type="backgroundElement" style={styles.status}>
            <ThemedText type="small">{status}</ThemedText>
          </ThemedView>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.contentFlex}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* If empty state and no errors/loading */}
            {!isGenerating && !spec && !error && !raw && (
              <View style={styles.examplesContainer}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Try an example:
                </ThemedText>
                <View style={styles.examplesGrid}>
                  {EXAMPLES.map((ex, i) => (
                    <Pressable
                      key={i}
                      style={[styles.exampleChip, { backgroundColor: theme.backgroundElement }]}
                      onPress={() => handleGenerate(ex)}
                      disabled={!session.isReady}
                    >
                      <ThemedText type="small">{ex}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {isGenerating && (
              <View style={styles.loadingContainer}>
                <ThemedText type="subtitle">
                  {isStopping ? 'Stopping...' : 'Generating dashboard...'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
                  {tokenCount === 0
                    ? 'Reading the prompt (the first token can take a while on device)...'
                    : `${tokenCount} tokens so far (max ${MAX_NEW_TOKENS})`}
                </ThemedText>
                {livePreview ? (
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                    {livePreview}
                  </ThemedText>
                ) : null}
              </View>
            )}

            {spec && !isGenerating && (
              <View style={styles.resultContainer}>
                <DashboardRenderer spec={spec} />
              </View>
            )}

            {error && !isGenerating && (
              <View style={styles.errorContainer}>
                <ThemedText type="smallBold" style={{ color: '#d9534f' }}>
                  Oops! {error}
                </ThemedText>
                {!!raw && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two, marginBottom: Spacing.one }}>
                      Raw output from AI:
                    </ThemedText>
                    <View style={[styles.rawCode, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small">{raw}</ThemedText>
                    </View>
                  </>
                )}
                <Pressable
                  onPress={() => handleGenerate()}
                  disabled={!canGenerate}
                  style={[styles.retryButton, { backgroundColor: theme.primary }, !canGenerate && styles.buttonDisabled]}
                >
                  <ThemedText type="smallBold" style={styles.userText}>Try again</ThemedText>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Input Area at the bottom */}
          <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
             <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
                value={input}
                onChangeText={setInput}
                placeholder={session.isReady ? 'e.g. "Create a crypto portfolio..."' : 'Loading model...'}
                placeholderTextColor={theme.textSecondary}
                editable={session.isReady && !isGenerating}
                multiline
              />
              {isGenerating ? (
                <Pressable
                  onPress={handleStop}
                  disabled={isStopping}
                  style={[styles.button, styles.stopButton, isStopping && styles.buttonDisabled]}
                >
                  <ThemedText type="smallBold" style={styles.userText}>
                    {isStopping ? 'Stopping' : 'Stop'}
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handleGenerate()}
                  disabled={!canGenerate}
                  style={[styles.button, { backgroundColor: theme.primary }, !canGenerate && styles.buttonDisabled]}
                >
                  <ThemedText type="smallBold" style={styles.userText}>Generate</ThemedText>
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
  },
  headerRow: {
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
  },
  status: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  contentFlex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.two,
    flexGrow: 1,
  },
  examplesContainer: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  examplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  exampleChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  resultContainer: {
    flex: 1,
  },
  errorContainer: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#d9534f33',
  },
  rawCode: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  retryButton: {
    marginTop: Spacing.three,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    paddingBottom: BottomTabInset + Spacing.two,
    paddingTop: Spacing.two,
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
  userText: {
    color: '#ffffff',
  },
});
