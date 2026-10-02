import { models, useLLMChatSession } from 'react-native-executorch';
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
import { parseSpec, isValidSpec } from '@/components/dashboard/parseSpec';
import type { DashboardSpec } from '@/components/dashboard/types';

const SYSTEM_PROMPT = `You are an AI Dashboard Designer. /no_think
Your job is to generate a JSON specification for a dashboard layout based on the user's prompt.
You MUST output ONLY valid JSON. Do not include conversational text outside the JSON.

SCHEMA:
{
  "title": "string",
  "theme": "dark" | "light" | "auto",
  "widgets": [
    // widget objects
  ]
}

WIDGET TYPES:
1. stat: { "type": "stat", "label": "Steps", "value": "8,420", "icon": "figure.walk", "color": "#3c87f7", "subtext": "vs yesterday" }
2. chart: { "type": "chart", "label": "Weekly", "data": [1,2,3,4,5], "xLabels": ["M","T","W","T","F"], "color": "#3c87f7" }
3. progress: { "type": "progress", "label": "Goal", "value": 0.72, "color": "#34c759", "subtext": "72% done" }
4. list: { "type": "list", "label": "Activity", "items": ["Item 1", "Item 2"], "color": "#3c87f7" }
5. header: { "type": "header", "label": "Title", "subtext": "Subtitle", "color": "#3c87f7" }
6. button: { "type": "button", "label": "Tap Me", "color": "#3c87f7" }
7. grid: { "type": "grid", "items": [ { stat1 }, { stat2 }, { stat3 }, { stat4 } ] } (max 4 stat items)

Generate creative, realistic data. Use visually pleasing hex colors for "color" fields.
Output ONLY JSON.`;

const EXAMPLES = [
  'A fitness tracker dashboard',
  'A weather widget with temp and humidity',
  'A crypto portfolio tracker',
  'A simple task manager',
];

export default function DesignScreen() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [dashboardSpec, setDashboardSpec] = useState<DashboardSpec | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const session = useLLMChatSession(models.llm.QWEN3_0_6B.DEFAULT, {
    initialMessages: [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: {
      temperature: 0.7,
      maxNewTokens: 1024,
    },
  });

  const canGenerate = session.isReady && !isGenerating && input.trim().length > 0;

  async function handleGenerate(overridePrompt?: string) {
    const text = (overridePrompt ?? input).trim();
    if (!text || isGenerating || !session.isReady || !session.sendMessage) return;

    if (overridePrompt) {
      setInput(overridePrompt);
    }

    setRawOutput('');
    setDashboardSpec(null);
    setParseError(null);
    setIsGenerating(true);
    // The session maintains history, we rely on the system prompt to guide it again.

    let generatedText = '';
    try {
      await session.sendMessage(text, (token) => {
        generatedText += token;
        // Optional: could stream the raw text, but might be jarring if it's JSON.
        // We will just show "Generating..." below.
      });

      // Parse after generation is complete
      setRawOutput(generatedText);
      try {
        const parsed = parseSpec(generatedText);
        if (isValidSpec(parsed)) {
          setDashboardSpec(parsed);
        } else {
          setParseError('The generated dashboard is missing required fields (title, widgets).');
        }
      } catch (err: any) {
        setParseError(`Could not parse JSON: ${err.message}`);
      }
    } catch (err: any) {
      setParseError(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStop() {
    session.stop?.();
    setIsGenerating(false);
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
        
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="subtitle" style={styles.title}>
              AI Dashboard Designer
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Describe a dashboard, and Qwen3 will build it.
            </ThemedText>
          </View>
        </View>

        {status && (
          <ThemedView type="backgroundElement" style={styles.status}>
            <ThemedText type="small">{status}</ThemedText>
          </ThemedView>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contentFlex}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* If empty state and no errors/loading */}
            {!isGenerating && !dashboardSpec && !parseError && !rawOutput && (
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
                <ThemedText type="subtitle">Generating dashboard...</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
                  The on-device model is designing your layout.
                </ThemedText>
              </View>
            )}

            {dashboardSpec && !isGenerating && (
              <View style={styles.resultContainer}>
                <DashboardRenderer spec={dashboardSpec} />
              </View>
            )}

            {parseError && !isGenerating && (
              <View style={styles.errorContainer}>
                <ThemedText type="smallBold" style={{ color: '#d9534f' }}>
                  Oops! {parseError}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two, marginBottom: Spacing.one }}>
                  Raw output from AI:
                </ThemedText>
                <View style={[styles.rawCode, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{rawOutput}</ThemedText>
                </View>
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
                onSubmitEditing={() => handleGenerate()}
              />
              {isGenerating ? (
                <Pressable onPress={handleStop} style={[styles.button, styles.stopButton]}>
                  <ThemedText type="smallBold" style={styles.userText}>Stop</ThemedText>
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
