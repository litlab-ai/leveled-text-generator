# Spec: Level guardrail (hybrid word list + Jev)

| | |
| --- | --- |
| Status | Draft for review |
| Builds on | [PR #1](https://github.com/litlab-ai/leveled-text-generator/pull/1): level order (`LEVELS`, `levelRank`) and whole-word matching (`containsWord`) |
| Branch | `claude/bold-mendel-w10j7z` |

## 1. Problem

A teacher reported:

> "I picked Easy for my first graders, and the passage used the word 'extraordinary'. None of my required words were hard, but the passage still was. I need to know when that happens before I hand it to students."

Today the app only checks that the **required** words appear in the passage. Nothing checks the other words the model picks. You can reproduce this without an API key: the mock provider ends every passage with *"It had been an **extraordinary** day…"* (`src/providers/mock.ts`). So every Easy passage passes validation even though it contains a word that is too hard.

## 2. Goals and non-goals

**Goals**

1. Detect words in a passage that are **above the target level** and **not on the required list**.
2. **Tell the teacher** which words, every time, before they hand the passage out.
3. **Fix it automatically when that's cheap:** one bounded retry that names the words to avoid.
4. Keep the README promise: the app and **all tests work offline with no API key**. Jev is an optional upgrade, never a requirement.

**Non-goals**

- Sentence-level readability (sentence length, Flesch–Kincaid and similar). This could come later, but it's a separate signal.
- Rewriting words ourselves, or replacing them with synonyms after generation.
- Blocking the teacher. The guardrail flags passages and can retry, but it never refuses to return one.
- Changing which **required** words get selected. That's `selection.ts`, already fixed in PR #1.

## 3. Overview

```
generatePassage
  ├─ selectWords / buildPrompt                       (prompt now also states the vocabulary limit, §8)
  ├─ attempt 1: provider.generate → checkRequiredWords → checkLevel
  ├─ if words were flagged and retries are left:
  │     attempt 2: buildRetryPrompt(avoid = flagged words) → generate → checkRequiredWords → checkLevel
  │     keep the better attempt (§7.2)
  └─ return result + levelCheck + attempts

checkLevel(passage, required, target)              src/guardrail/check.ts
  1. tokenize with offsets                         src/util/text.ts
  2. drop required words, proper nouns, numbers
  3. find each word's level:
       a. the word bank (data/words.json)          always wins
       b. the word list (data/lexicon.json)        offline, the same answer every time
       c. LevelJudge for words still unknown       Jev if configured, else syllable heuristic
  4. flag every word whose level is above the target
```

Every word goes through the cheap, deterministic layers first. Only words the word list can't place reach Jev, so calls stay small (usually 0–5 words) and rare. Common words never cost a call.

## 4. Classifying a word

### 4.1 Tokenizing

Add `wordTokens(passage): Token[]` to `src/util/text.ts`:

```ts
interface Token {
  text: string;        // as written: "Extraordinary"
  index: number;       // offset into the passage, used for highlighting
  sentenceStart: boolean;
  sentence: string;    // the containing sentence, used as context for Jev
}
```

- Word pattern: `/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu`, the same character classes as `containsWord` in PR #1.
- Hyphenated words are split into their parts ("well-known" becomes "well" and "known"), and each part is checked on its own.
- Use NFC normalization, matching `containsWord`.

### 4.2 Words that are never flagged

| Skip | Rule |
| --- | --- |
| Required words | Any token where `containsWord(token, requiredWord)` holds, including the inflected forms from §4.3. |
| Proper nouns | Capitalized and **not** at the start of a sentence. Also a capitalized word at the start of a sentence if the same word appears capitalized mid-sentence anywhere else in the passage ("Maya"). |
| Numbers and single letters | No letters, or a single character. |
| Allowlist | `data/lexicon.json` → `"allow"`: words we never flag. Covers contractions ("didn't") and the like. |

### 4.3 Base forms

Lookups try the exact lowercase form first, then **inflectional** variants only, in this order:

- `'s` / `’s` possessive → strip
- `-ies` → `-y`; `-es` → ∅; `-s` → ∅
- `-ied` → `-y`; `-ed` → ∅ / `+e`; double consonant + `-ed` → single
- `-ing` → ∅ / `+e`; double consonant + `-ing` → single
- `-er`, `-est` (comparatives) with the same `y`/`e`/doubling rules

The first candidate found in the bank or the word list wins, and the inflected form gets that word's level. **Derivational** suffixes (`-ness`, `-ly`, `-tion`, `-ful`…) are *not* stripped on purpose. "Happily" isn't automatically as easy as "happy", so those forms either come from the list directly or go to the judge.

This is not a Porter stemmer, because those produce non-words ("perseverance" becomes "persever") that can't be looked up.

### 4.4 Where a word's level comes from, in order

1. **The word bank** (`data/words.json`). Teachers' tags are the source of truth: a non-required "labyrinth" is `hard` because the bank says so.
2. **The word list** (`data/lexicon.json`), see §5.
3. **`LevelJudge`** for any word still unknown, see §6.

A word is **flagged** when `levelRank(level) > levelRank(target)`. A Hard passage can never flag anything, so checking stops early when the target is `hard`.

## 5. The word list

### 5.1 Format

```jsonc
// data/lexicon.json
{
  "source": "…",                // name and license of the list, required (§12, question 1)
  "easy":   ["a", "about", "after", "…"],   // about 2,500 headwords
  "medium": ["…"],                          // about 7,500 more headwords
  "allow":  ["ok", "didn't", "…"]
}
```

- Loaded and checked once at startup, the same way `loadWordBank` works. Lookups go through a `Map<string, Level>`.
- Any word **not in `easy` or `medium` is unknown, not hard.** That keeps the list's gaps (new words, rare but simple words) from turning into false flags. Unknown words go to the judge.
- A word that appears in both `easy` and `medium` is an error when the file loads.

### 5.2 Choosing the source

The list decides how many false flags teachers see, so its source matters more than anything else in this design. Requirements:

- A license that allows commercial redistribution inside the repo (see §12, question 1).
- An easy tier sized to real early-reader text. Dolch (315 words) alone is **too small**: it would flag "brother", "morning" and "bag" in the mock passage. Aim for about 2,500 base words for Easy.
- Base forms, not inflected forms, because §4.3 handles inflections.

Candidates to check: Dolch and Fry as the core of the Easy tier, extended by frequency rank from a children's-text frequency list that has a permissive license. The license decides which one we use.

## 6. `LevelJudge`: the unknown words

```ts
// src/guardrail/judge.ts
export interface JudgeInput {
  target: Level;
  passage: string;
  words: Array<{ lemma: string; text: string; sentence: string }>;
}

export interface JudgeVerdict {
  lemma: string;
  level: Level | null;            // null means the judge couldn't decide
  probability?: number;           // P(level > target), when the judge provides one
  source: "jev" | "heuristic";
}

export interface LevelJudge {
  readonly name: string;
  judge(input: JudgeInput, signal?: AbortSignal): Promise<JudgeVerdict[]>;
}
```

Selection (`getLevelJudge()`, which mirrors `getProvider()`):

| `LEVEL_JUDGE` | Behavior |
| --- | --- |
| `auto` (default) | `JevJudge` if `TYPESAFE_API_KEY` is set, otherwise `HeuristicJudge` |
| `jev` | `JevJudge`; the app fails at startup if the key is missing |
| `heuristic` | `HeuristicJudge` only |

### 6.1 `HeuristicJudge` (offline fallback)

The same answer every time, no network. Used for tests, for the mock setup, and as the fallback whenever Jev fails.

- Count syllables (vowel groups, minus a silent final `e`, minimum 1).
- `≥ 4` syllables → `hard`; `3` → `medium`; otherwise `level: null` (we don't guess "easy" for an unknown word).
- `source: "heuristic"`. These flags show up as **"may be too hard"** (lower confidence) in the UI.

With this judge alone, "extraordinary" (6 syllables, not in the Easy list) is flagged on Easy, so the teacher's case is covered even without Jev.

### 6.2 `JevJudge`

**One batched `decide` call per check.** Each unknown word is one `choice` question.

Request (`decide`, `provider: "typesafe"`):

```jsonc
{
  "provider": "typesafe",
  "state": {
    "task": "Decide the reading level of single words in a children's passage.",
    "targetLevel": "easy",
    "levels": {                      // taken from READING_GUIDANCE so the two never drift apart
      "easy": "early reader, ages 6-8",
      "medium": "developing reader, ages 9-11",
      "hard": "confident reader, ages 12-14"
    },
    "passage": "<full passage>"
  },
  "questions": {
    "w0": {
      "type": "choice",
      "instructions": {
        "task": "Lowest reading level at which most readers know this word, as used in the sentence.",
        "word": "extraordinary",
        "sentence": "It had been an extraordinary day, and Maya's heart was full."
      },
      "criteria": {
        "easy":   "Most readers aged 6-8 know it",
        "medium": "Most readers aged 9-11 know it",
        "hard":   "Usually known only by readers aged 12-14 or older"
      }
    }
    // w1, w2, … one question per unknown word
  }
}
```

- **Question IDs are `w0…wN`**, not the words themselves. That avoids ID charset limits (some adapters only allow `[A-Za-z0-9_.-]`) and words with apostrophes or accents.
- **At most 16 questions per call**, the smallest per-adapter limit in the docs. If there are more unknown words, judge the 16 that appear first and send the rest to `HeuristicJudge`. A passage of 80–120 words should almost never get there.

Reading the response:

| Response | Result |
| --- | --- |
| `status: "ok"`, `answers.wI.choice` is one of `easy`/`medium`/`hard` | `level = choice`. When `probabilities` is present, `probability = Σ P(levels above target)` |
| The answer has `refusal`, or the choice is missing or invalid | `HeuristicJudge` for that word |
| `status: "error"`, client throws (credentials or transport), timeout, `budget.exhausted` | `HeuristicJudge` for **every** word in the batch, and `levelCheck.degraded` is set (§7.3) |

**Flag threshold:** a Jev verdict above the target is flagged only if `probability ≥ JEV_MIN_PROBABILITY` (default `0.6`), or if no probabilities came back. Tune the default with the evaluation in §10.

**Session and budget.** The jev-fabric budget (`maxEvaluations`, `maxTokens`) belongs to a session and never refills. So each `generatePassage` call opens **one session**:

```ts
Fabric.open({ maxEvaluations: 1 + retries, maxTokens: 20_000 })   // closed in finally
```

That limits the worst case to `1 + LEVEL_GUARDRAIL_RETRIES` billed calls per generation, enforced by the binary as well as by our code. The cost is a new TLS handshake per generation (the README reports about 1.1 s cold versus about 0.37 s warm). If the measured latency is too high, the alternative is one long-lived session with a large budget that we rotate when it runs out; see §12, question 3.

**Timeout:** `JEV_TIMEOUT_MS`, default `5000`, passed as `decide(request, { timeoutMs })`. jev-fabric never retries on its own, and neither do we. A failure falls back to the heuristic.

**Wrapper for tests:**

```ts
// src/guardrail/jev-client.ts
export interface JevClient {
  decide(request: DecisionRequest, opts: { timeoutMs: number }): Promise<DecisionResult>;
  close(): Promise<void>;
}
export function openJevClient(budget: { maxEvaluations: number; maxTokens: number }): Promise<JevClient>;
```

`JevJudge` depends only on `JevClient`, so the tests pass a fake. The real implementation loads jev-fabric through a **dynamic import, only when Jev is selected**. Without a key, the app never loads the native binary.

**Dependency:** `jev-fabric` goes in **`optionalDependencies`**, so `npm install` still succeeds on platforms it doesn't ship for (Windows, musl). It needs glibc 2.28+ and curl 7.82+ at runtime. If the import fails, the app logs it once and treats `auto` as `heuristic`.

## 7. Retry and choosing the result

### 7.1 Retry prompt

`buildRetryPrompt(target, words, avoid: string[])` adds one line **before** the `Required words:` line, so the mock's parser still finds the required words:

```
Avoid these words, which are too hard for this reader: extraordinary, glimmering.
Use simpler everyday words instead. Still use every required word.
Required words: river, sun, bread
```

`avoid` holds the flagged lemmas from the previous attempt, never required words.

### 7.2 Choosing the better attempt

Attempts run in order until one comes back with no flags or the retry budget (`LEVEL_GUARDRAIL_RETRIES`, default `1`, `0` turns retries off) is used up. Choose by:

1. fewest **missing required words** (these matter most to the teacher)
2. then fewest **flagged words**
3. on a tie, the **earlier** attempt

The result describes the chosen attempt: its `passage`, `prompt`, `found`, `missing` and `levelCheck`.

### 7.3 Changes to `GenerationResult`

```ts
export interface FlaggedWord {
  word: string;            // as written in the passage
  lemma: string;           // base form used for the lookup
  level: Level;            // its estimated level
  source: "bank" | "lexicon" | "jev" | "heuristic";
  probability?: number;    // Jev only
  positions: number[];     // offsets of every occurrence, for highlighting
}

export interface LevelCheck {
  target: Level;
  ok: boolean;             // true when nothing was flagged
  flagged: FlaggedWord[];  // most severe first, then in passage order
  unverified: string[];    // unknown words nobody could place (level: null)
  judge: "heuristic" | "jev";
  degraded?: string;       // why Jev was skipped or failed, e.g. "timeout"
}

export interface GenerationResult {
  // …existing fields…
  valid: boolean;          // unchanged: required words only (PR #1)
  levelCheck: LevelCheck;
  attempts: number;        // 1 or 2
}
```

`valid` keeps its PR #1 meaning, so existing callers don't break. Level problems are reported separately in `levelCheck.ok`.

**The guardrail never makes generation fail.** Any exception inside `checkLevel` is caught and logged, and the passage is returned with `levelCheck = { ok: true, flagged: [], degraded: "guardrail error: …" }`. The UI shows that the check didn't run.

## 8. Prevention in the first prompt

The cheapest fix is to avoid the problem in the first place. `buildPrompt` gets one extra line:

```
Apart from the required words, use only words most readers aged 6-8 already know.
```

The age range comes from the level (keep it next to `READING_GUIDANCE` in `levels.ts`). This lowers how often the guardrail fires, but doesn't replace it.

## 9. UI (`public/index.html`)

When `levelCheck.ok === false`, show a banner above the passage:

> ⚠ **2 words may be too hard for Easy readers:** extraordinary, glimmering
> *We rewrote this passage once to simplify it.* (only shown when `attempts > 1`)

- **Highlight** every occurrence in the passage using `positions`. Build text nodes and `<mark>` elements, never `innerHTML`, because the passage is model output.
- Mark style by confidence: `bank`, `lexicon` and `jev` get a solid underline ("too hard"); `heuristic` gets a dotted one ("may be too hard"). Hovering shows the estimated level and the source.
- If there are `unverified` words, list them under the banner in muted text: "Couldn't check: …".
- If `degraded` is set, add a small note: "Advanced word check unavailable; used the basic check."
- The required-words check section stays as it is.

## 10. Testing and evaluation

### Unit tests (offline, run in CI)

| Area | Cases |
| --- | --- |
| `wordTokens` | offsets, sentence starts, apostrophes, hyphen splitting, accents, line breaks |
| Base forms | `rivers` → `river`, `hurried` → `hurry`, `running` → `run`, `bigger` → `big`; `happily` is **not** reduced |
| Skips | required words (and their inflections) are never flagged; `Maya` mid-sentence and sentence-initial; numbers |
| Where levels come from | the bank overrides the list; unknown words go to the judge; a Hard target never flags |
| `HeuristicJudge` | `extraordinary` → hard; `butterfly` → medium; `dog` → null |
| `JevJudge` with a fake `JevClient` | request shape (IDs `w0…`, criteria, state); probability threshold; missing probabilities; refusal; `status:"error"`; thrown error; timeout; `budget.exhausted`; more than 16 words |
| Retry | retry fires only when something is flagged; the `avoid` line lands before `Required words:`; better-attempt rules; `LEVEL_GUARDRAIL_RETRIES=0` |
| Lexicon loader | malformed file, word in two tiers, missing `source` |

### End-to-end with the mock (the teacher's case)

- `MockProvider` learns to read the `Avoid these words:` line. When the closing sentence contains an avoided word, it uses a simpler alternative (*"It had been a great day, and Maya's heart was full."*).
- Test: Easy with the mock → attempt 1 flags `extraordinary` (source `heuristic`, or `lexicon` once the list has it) → attempt 2 is clean → `attempts === 2`, `levelCheck.ok === true`.
- Test: with `LEVEL_GUARDRAIL_RETRIES=0`, the same request returns `ok: false` with `extraordinary` flagged at the right position.

### Accuracy evaluation (offline script, run by hand)

- `scripts/eval-guardrail.ts` runs `checkLevel` over a labeled set: about 30 real passages per level, with the too-hard words marked by a teacher.
- Report precision and recall per level and per source, comparing heuristic-only against hybrid.
- **Targets before release: precision ≥ 0.8 (so teachers don't learn to ignore the banner) and recall ≥ 0.9 on Easy.** Use the results to set `JEV_MIN_PROBABILITY` and the syllable thresholds.

## 11. Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `LEVEL_GUARDRAIL_RETRIES` | `1` | Extra generations when words are flagged. `0` = flag only |
| `LEVEL_JUDGE` | `auto` | `auto` \| `jev` \| `heuristic` |
| `TYPESAFE_API_KEY` | — | Turns Jev on in `auto` mode |
| `JEV_TIMEOUT_MS` | `5000` | Timeout for each Jev call |
| `JEV_MIN_PROBABILITY` | `0.6` | Minimum P(above target) to flag on a Jev verdict |

Add all of these to `.env.example` and to the README's "LLM providers" section.

**Worst-case cost per generation:** `1 + retries` LLM calls plus `1 + retries` Jev calls. With the defaults that's 2 + 2, and most generations need 1 + 0 or 1 + 1.

## 12. Open questions

1. **Word list source and license.** Which list we ship, and whether its license allows redistribution in this repo. Blocks §5.
2. **Sending passages to typesafe.ai.** This adds a new third-party data processor. Passages hold no student data, but they do leave our infrastructure. Does this need a DPA or a privacy sign-off before Jev is turned on in production?
3. **Session per generation or a long-lived session.** We need to measure real `decide` latency from our hosting region. The docs give no latency or pricing for `jev-latest`.
4. **How to import the jev-fabric TS client.** The docs show `import { Fabric } from './jev-fabric.ts'` as a source file that runs under Node 22.6+ type stripping. Our README says Node ≥ 20. Confirm the published import path inside the npm package, and whether `tsx` handles it on Node 20, or bump `engines`.
5. **Should teachers be able to turn off the retry for a single request?** For example, to see the model's first draft. Proposed: not in v1.
6. **Teacher-tagged levels for words that aren't required.** Should a teacher be able to add "extraordinary" to the bank as `hard`, so it's never judged again? That would reuse the bank layer at no extra cost. Proposed for later.

## 13. Delivery plan

| # | Change | Depends on |
| --- | --- | --- |
| 1 | `wordTokens`, base forms, skips, `checkLevel` with bank + `HeuristicJudge`; `levelCheck` in the result; tests | PR #1 |
| 2 | Retry loop, `buildRetryPrompt`, the mock's avoid handling, end-to-end tests | 1 |
| 3 | UI banner and highlighting | 1 |
| 4 | `data/lexicon.json` + loader | question 1 |
| 5 | `JevJudge`, `JevClient` wrapper, optional dependency, config; tests with a fake client | questions 2 and 4 |
| 6 | Evaluation script and labeled set; tune thresholds | 4, 5 |

Steps 1–3 fix the teacher's case on their own, offline. Steps 4 and 5 make the check more accurate without changing what the teacher sees.
