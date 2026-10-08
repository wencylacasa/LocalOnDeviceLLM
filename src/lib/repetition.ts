/**
 * Loop guard for small on-device models.
 *
 * The library's sampler only exposes `temperature`, so there is no repetition
 * penalty to set. A small model that gets stuck therefore repeats the same
 * passage until it runs out of tokens. These helpers spot that while the reply
 * is still streaming, so the caller can stop early and trim the repeats.
 */

const MIN_UNIT = 12; // shorter chunks repeat legitimately (dividers, "ha ha ha")
const MAX_UNIT = 240;
const REPEATS = 3;
const HAS_WORD_CHAR = /[A-Za-z0-9\u00C0-\uFFFF]/;

/**
 * If the end of `text` is one chunk (12-240 chars) repeated 3+ times in a row,
 * returns that chunk's length. Otherwise 0. Cheap enough to call every few
 * tokens while streaming.
 */
export function findLoopUnit(text: string): number {
  const maxUnit = Math.min(MAX_UNIT, Math.floor(text.length / REPEATS));
  for (let len = MIN_UNIT; len <= maxUnit; len++) {
    const tail = text.slice(-len * REPEATS);
    const unit = tail.slice(0, len);
    if (!HAS_WORD_CHAR.test(unit)) continue;
    if (tail.slice(len, len * 2) === unit && tail.slice(len * 2) === unit) return len;
  }
  return 0;
}

/** Cuts a looping tail back to a single copy of the repeated passage. */
export function trimLoop(text: string): string {
  const len = findLoopUnit(text);
  if (!len) return text;

  // Walk back to where the repetition starts, then keep exactly one copy.
  let i = text.length - len - 1;
  while (i >= 0 && text[i] === text[i + len]) i--;
  return text.slice(0, i + 1 + len).trimEnd();
}
