# Red Teddy early-years games (ages 1–6)

Routes: `/early-years/games` (hub, `games.html`) and `/early-years/games/play?a=<id>` (player, `play.html`).
Static ES modules, no build step at runtime, no dependencies, no network calls during play,
no accounts, nothing stored except the sound on/off choice (`localStorage` `rtt.ey.muted`).

| File | Role |
| --- | --- |
| `content.js` | All activities: band, objective, what it practises, play-together tip, off-screen idea, questions/rounds with answer keys and hints. Pure data. |
| `engine.js` | Pure rules: seeded shuffle, option normalisation, answer checks, hint → narrow → reveal, validation. |
| `player.js` | Screen for the 8 mechanics: `explore` (tap & hear), `choose` (picture selection, listening, counting, patterns, rhymes, stories…), `count` (touch-count then choose), `match` (pairs), `memory`, `sort`, `sequence` (ordering, two-step instructions), `parent` (off-screen). |
| `visuals.js` | Original SVG illustrations for abstract ideas: shapes, dots/dice, ten frames, feelings faces, position scenes, measurement. |
| `media.js` | Photos, sounds and voice from the manifest with honest fallbacks; one audio channel (never overlaps). |
| `manifest.json` / `manifest.js` | Asset manifest (JSON is the source; JS is generated for the browser). |

Rebuild pages after editing content: `node scripts/build-early-games.mjs` (and `node scripts/build-early.mjs`
for the age pages that link here). Tests: `node --test scripts/early-games.test.mjs`; browser:
`node scripts/dev-rtt.mjs` then `PLAYWRIGHT_MODULE=… node scripts/early-games-e2e.mjs [shots-dir]`.

## Photographs and sounds: how to add them (Windows)

Every picture subject is listed in `manifest.json` with a ready-made Pexels search link (`search`) and
every sound with a Freesound CC0 search link. Until an asset is imported, the game shows a labelled
symbol tile (photos) or Red Teddy says the sound (e.g. “Woof woof!”). It never substitutes a different photo.

1. Install the free tools once (PowerShell): `winget install ImageMagick.ImageMagick` and `winget install Gyan.FFmpeg`.
2. Open the `search` link, pick a photo with **one clear subject, plain background, no logos/text/watermark**.
   Open the photo's own page and download the original (never a thumbnail).
3. Save it as `redteddytutor\early\games\incoming\<id>.jpg` (sounds: `<id>.mp3`/`.wav`).
4. In `manifest.json` fill for that id: `sourceUrl` (the photo's page), `creator`, `licence`
   (e.g. `Pexels License`), `licenceUrl` (`https://www.pexels.com/license/`), `attribution` (if required,
   e.g. CC BY on Wikimedia Commons) and, for photos, `alt` (e.g. `"A brown dog sitting on grass"`).
5. Run `node scripts\import-early-assets.mjs`. It makes square 640 px and 320 px WebP files (sounds:
   mono MP3, max 4 s), marks the entry `ready` with today's date, and lists what is still needed.
6. Run the tests and commit `img\`, `audio\`, `manifest.json` and `manifest.js`.

Licence notes: Pexels licence allows free commercial use without attribution, but not selling unaltered
copies or implying endorsement by people shown; avoid photos with identifiable children. Wikimedia
Commons and Openverse: each file has its own licence (CC BY / CC BY-SA need attribution text in
`attribution`; avoid NC and ND licences). Freesound: prefer CC0. Do not hotlink; always import.

## Red Teddy's voice

The current voice is the device's built-in speech (`/learn/js/speech.js`, preferring natural US voices).
It is free, offline and starts only after a tap. The Red Teddy welcome video's voice cannot be reused
as clips from this repository (no separate narration track or licence record is here); do not assume it can.

To add recorded narration for free: record with Audacity (free) or Windows Sound Recorder, one short
clip per line, then add an entry to `voice` in `manifest.json`:
`{"key":"find-the-ball","text":"Where is the ball?","path":"/early/games/audio/voice/find-the-ball.mp3","status":"ready","creator":"…","licence":"Owned by Red Teddy Tutor","licenceUrl":null,"checked":"YYYY-MM-DD"}`.
A ready clip plays whenever the game says exactly that text; anything else falls back to the device voice.
Spec: MP3, mono, 64–96 kbps, under 60 KB, same narrator throughout.

## Content audit (October 2026)

Automated in `scripts/early-games.test.mjs`: every question has exactly one correct answer, no duplicate
options or questions, every asset/sound exists in the manifest, ages 1–2 use two choices and are
forgiving, sums/bonds/subitising/ordering are recomputed, first/last sounds, letter matches and
blends are checked against the words.

Reviewed by hand: US spelling and vocabulary (color, mom, school bus); familiar items chosen to suit most
US homes; position words use one consistent ball-and-box picture; stories are 1–2 sentences.
Known limits: ages are a guide, not a judgment; the curriculum follows common early-years practice and
the ELOF/Common Core K domains it relates to, but has **not** been externally reviewed by early-years
specialists and does not claim full coverage of any official curriculum.
