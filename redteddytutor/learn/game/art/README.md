# Art pipeline (Teddy's Bakery)

Status: **placeholder**. Every visual in the game is currently drawn in code
(`js/teddy.js`, `js/bakery.js`). Nothing here is final artwork.

## Replacing placeholders with commissioned art
1. Teddy: one master PNG at 2x (1200 x 1200, transparent). Export poses as sprite
   sheets: idle, happy, think, oops, celebrate. Keep the navy scarf and the palette in
   `js/teddy.js` so the character stays consistent with the brand mark.
2. Scenery: awning, shelves, counter and floor as separate layers (1920 x 1200 max).
3. Props: cakes, trays, shape cakes, pattern pieces; 256 px square, transparent PNG.
4. Export WebP at quality 82 for the page and keep the source PSD/SVG in the designer's
   archive, not in this repo.
5. Load sprites through a loader in `js/bakery.js` and fall back to the drawn version
   if a file is missing, so the game keeps working while art is updated piece by piece.

Licence: commissioned or original work only. Record the licence and author for every file here.
