import { models } from 'react-native-executorch';

/**
 * The one model both screens use. Change it here to change it everywhere.
 *
 * Qwen3 0.6B is the default because it fits phones with 4 GB of RAM (roughly
 * 0.8-1 GB in memory). It is the weakest option and the one most likely to
 * repeat itself; the loop guard in `src/lib/repetition.ts` and the prompts
 * compensate for that.
 *
 * Bigger models answer better and loop less, but need more RAM. Rough memory
 * needs, so pick one that leaves room for Android and your other apps:
 *   models.llm.QWEN3_1_7B.DEFAULT   ~1.5-2 GB   6 GB+ phones
 *   models.llm.QWEN3_4B.DEFAULT     ~3-4 GB     8 GB+ phones
 *   models.llm.LLAMA3_2_1B.DEFAULT  ~1.3 GB     a different family, 4-6 GB phones
 *
 * If the app closes by itself while the model is loading, the model is too
 * big for the phone: go one step down.
 */
export const LLM_MODEL = models.llm.QWEN3_0_6B.DEFAULT;
export const LLM_NAME = 'Qwen3 0.6B';
