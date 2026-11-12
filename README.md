# Ludus

Learn to read and write Roman numerals. *Ludus* is Latin for both "school" and "game".

A single-page app with no backend and no accounts: all progress lives in the browser's `localStorage`.

## What's in it

- **Five lesson groups** that build on each other, from I, V, X up to 3999, then years, long numerals and common mistakes.
- **Interactive lessons**: tap a numeral apart, build numbers with stone tiles, fix the mason's mistakes.
- **Quizzes** in both directions (XIV → 14 and 14 → XIV), multiple choice and fill-in, generated fresh each time and validated before they are shown.
- **Locked progression** with a quiz after every lesson and a trial after every group. Any trial can be taken at any time to test out of everything up to that point.
- **Practice**: free practice, weak-spots practice built from your own mistakes, and a 60-second speed round with personal bests.
- **Light gamification**: XP, ranks from Tiro to Imperator, laurels, a daily streak and achievements. Optional sound and (on supporting devices) vibration.
- **Export / import** of progress as a JSON file to move between browsers (or the share sheet on phones).
- **Installable and offline**: add it to your home screen; a service worker keeps it working without a connection. Fonts are bundled.
- **Comfortable on any device**: the browser Back button moves between screens, a reload resumes the lesson or quiz you were in, leaving mid-quiz asks first, the main button stays in reach on small phones, and speed rounds pause when you switch apps.
- **Keyboard friendly**: Enter to check or continue, Escape to leave, 1–4 to pick an answer, arrow keys to page through a lesson.
- **Light, dark or match-device theme**, remembered practice settings, a review of missed questions after every quiz, and a nudge when your streak is about to lapse.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests for the converter, generator and progress rules
npm run build    # type-check and build to dist/
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** once.

## Layout

| Path | Purpose |
|---|---|
| `src/lib/roman.ts` | Conversion and numeral breakdown |
| `src/lib/generator.ts` | Level rules, question generation and validation |
| `src/lib/curriculum.ts` | Lesson groups, lesson cards and levels |
| `src/lib/game.ts` | Unlocking, XP, laurels, streaks, achievements |
| `src/lib/storage.ts` | Versioned localStorage save, export, share and import |
| `src/lib/nav.ts` | Leave-guard, per-tab resume, remembered practice settings |
| `public/sw.js`, `public/manifest.webmanifest` | Offline support and home-screen install |
| `src/components/` | Screens: map, lesson player, quiz, practice, profile |
