# Narration clips

Put one recorded clip per step prompt here, named `<activity-id>-<step-index>.mp3`
(step index starts at 0). Example: `count-dots-3-0.mp3` for the first question of
"Count the dots". When a clip is missing, the built-in voice reads the same text.

Recording spec: MP3, mono, 44.1 kHz, about 96 kbps, under 60 KB per clip, no background
music. Record the exact prompt text from `learn/js/content.js`. Keep the narrator's
voice warm and unhurried; the same narrator should record every clip.
