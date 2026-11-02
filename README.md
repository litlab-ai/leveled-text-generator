# Leveled text generator

A small app that writes a short reading passage for students. A teacher picks a reading level (easy, medium or hard) and the words they want students to practice. Each word in the word bank is tagged with its own level. The app picks the right words for the level, asks an LLM for a passage that uses them, and checks which required words made it into the passage.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
npm start        # http://localhost:3000
npm test
npm run typecheck
```

`npm run dev` restarts the server when files change.

## LLM providers

By default the app uses a **mock provider** that runs locally. It needs no API key and returns the same passage for the same prompt every time.

To use a real model instead:

```bash
cp .env.example .env
# then in .env:
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key
```

The real provider is optional. Everything, including the tests, works with the mock.

## How it fits together

```
POST /api/generate { level, words? }
  └─ generatePassage            src/generate.ts
       ├─ selectWords           src/selection.ts   pick the required words for the level
       ├─ buildPrompt           src/prompt.ts      build the LLM prompt
       ├─ provider.generate     src/providers/     mock (default) or anthropic
       └─ checkRequiredWords    src/validator.ts   which required words appear in the passage
```

| Path | What it does |
| --- | --- |
| `data/words.json` | The word bank, with a level on each word |
| `src/types.ts` | Shared types |
| `src/levels.ts` | The levels and the reading guidance for each one |
| `src/words.ts` | Loads and checks the word bank |
| `src/selection.ts` | Chooses the required words for a passage |
| `src/prompt.ts` | Builds the prompt sent to the LLM |
| `src/validator.ts` | Checks which required words appear in the passage |
| `src/util/` | Small shared helpers |
| `src/providers/` | The LLM provider interface, the mock and the Anthropic provider |
| `src/server.ts` | HTTP server: the page, `GET /api/words`, `POST /api/generate` |
| `public/index.html` | The single-page UI |
| `test/` | Vitest tests |
