# Teddy's Bakery: architecture

The site is static HTML with vanilla JavaScript on Vercel (no Next.js). The game is an
isolated client-side module that mounts into one page: `learn/game/index.html`.

## Layers
| Layer | Files | Knows about |
|---|---|---|
| Learning content and rules | `js/curriculum.js`, `js/rng.js`, `js/mastery.js` | Nothing else. Pure, unit tested. |
| Game controller | `js/mount.js` | Content, rules, persistence, DOM controls, Phaser lifecycle |
| Phaser scene (drawing only) | `js/bakery.js`, `js/teddy.js` | Emits player actions; never decides correctness or stores progress |
| Sound | `js/audio.js` | Web Audio tones, no files |
| Persistence and accounts | `learn/js/progress.js`, `learn/js/sync.js`, `learn/js/api.js` | Shared with the activity player and parent summary |
| Page bootstrap | `js/main.js` | Mounts once; destroys on `pagehide` |

## Learning loop
1. Map: `unlockedLevels` decides which signs are open (a pass opens the next).
2. Each round: `makeRound(kind, tier)`. The tier comes from `tierForSkill` (the child's
   recorded first-try accuracy for that skill) and drops after two rounds in a row
   that were not right first time (`adjustForSession`).
3. Answer: `checkAnswer` decides. Hints come from the round: one per wrong try, then
   a reveal after the third miss. No penalty.
4. Each round writes one step (`recordStep`, skill and first-try flag). Each finished
   level writes one session (`recordCompletion`). Both sync to the signed-in profile
   with `syncStep` and `syncSession`, which queue offline writes.
5. A level passes at 3 of 5 right first time (`PASS_MARK`). The Grand Opening
   (6 mixed rounds) unlocks after all four signs and ends the game.

## Lifecycle
- `mountBakery` is called once per page (guarded by `data-mounted`).
- It creates one `Phaser.Game`, one AudioContext on the first sound, and a set of timers.
- `destroy()` clears timers, removes listeners, calls `game.destroy(true)` and closes
  the audio context. `main.js` calls it on `pagehide`.
- Phaser is loaded as a classic script. The scene class is imported only after Phaser
  exists, so a failed download shows a message instead of a crash.

## Testing
- `node --test scripts/*.test.mjs`: curriculum, answer checks, tiers, unlocks, mapping.
- `scripts/game-e2e.mjs`: plays the real game in Chromium under the production CSP.
  Needs Playwright (`PLAYWRIGHT_MODULE`). Covers every sign, drag and tap answers,
  hints, reveal, retries, locked boss, the ending, persistence, phone and tablet layout,
  reduced motion, sound settings, and a missing engine.
