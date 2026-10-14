/* One-off seed for redteddytutor/early/games/manifest.json (kept for re-seeding new
   subjects: existing entries are never overwritten). Run: node scripts/early-assets-init.mjs */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const F = new URL('../redteddytutor/early/games/manifest.json', import.meta.url);
// id, category, emoji fallback, Pexels search term, concepts
const V = `dog|animal|🐶|dog|animals,sounds
cat|animal|🐱|cat|animals,sounds
cow|animal|🐮|cow|animals,sounds,farm
sheep|animal|🐑|sheep|animals,sounds,farm
duck|animal|🦆|duck|animals,sounds,farm
bird|animal|🐦|bird|animals,sounds,nature
horse|animal|🐴|horse|animals,sounds,farm
rabbit|animal|🐰|rabbit|animals
elephant|animal|🐘|elephant|animals,big-small
lion|animal|🦁|lion|animals,sounds
penguin|animal|🐧|penguin|animals,cold
pig|animal|🐷|pig|animals,sounds,farm
chicken|animal|🐔|chicken|animals,sounds,farm
frog|animal|🐸|frog|animals,sounds
fish|animal|🐟|fish|animals,water
bee|animal|🐝|bee|animals,sounds
butterfly|animal|🦋|butterfly|animals,life-cycle
mouse|animal|🐭|mouse|animals,big-small
owl|animal|🦉|owl|animals,sounds
puppy|animal-baby|🐶|puppy|animal-babies
kitten|animal-baby|🐱|kitten|animal-babies
calf|animal-baby|🐮|calf|animal-babies
lamb|animal-baby|🐑|lamb|animal-babies
duckling|animal-baby|🐥|duckling|animal-babies
chick|animal-baby|🐤|baby chick|animal-babies,life-cycle
foal|animal-baby|🐴|foal|animal-babies
caterpillar|animal-baby|🐛|caterpillar|life-cycle
egg|food|🥚|egg|food,life-cycle
apple|food|🍎|red apple|food,fruit,colors
banana|food|🍌|banana|food,fruit,colors
orange|food|🍊|orange fruit|food,fruit,colors
strawberry|food|🍓|strawberry|food,fruit,colors
grapes|food|🍇|grapes|food,fruit
pear|food|🍐|pear|food,fruit
watermelon|food|🍉|watermelon|food,fruit,big-small
carrot|food|🥕|carrot|food,vegetables,colors
broccoli|food|🥦|broccoli|food,vegetables,colors
tomato|food|🍅|tomato|food,vegetables
corn|food|🌽|corn|food,vegetables
bread|food|🍞|bread|food
cheese|food|🧀|cheese|food
milk|food|🥛|glass of milk|food
cup|object|☕|cup|everyday
spoon|object|🥄|spoon|everyday
bowl|object|🥣|bowl|everyday
shoe|object|👟|shoes|everyday,clothes
sock|object|🧦|sock|everyday,clothes
hat|object|🧢|hat|everyday,clothes
coat|object|🧥|coat|everyday,clothes,weather
ball|object|⚽|ball|everyday,toys
book|object|📕|books|everyday
bed|object|🛏️|bed|everyday,routines
chair|object|🪑|chair|everyday
teddy|object|🧸|teddy bear|toys
blocks|object|🧱|toy blocks|toys
car|object|🚗|toy car|toys,vehicles
bus|object|🚌|school bus|vehicles
boat|object|⛵|boat|vehicles,water
plane|object|✈️|airplane|vehicles,sky
toothbrush|object|🪥|toothbrush|routines
soap|object|🧼|soap|routines
key|object|🔑|key|everyday
clock|object|🕰️|clock|everyday
umbrella|object|☂️|umbrella|weather
bag|object|🎒|backpack|school
crayons|object|🖍️|crayons|school,colors
scissors|object|✂️|scissors|school
drum|object|🥁|drum|sounds
bell|object|🔔|bell|sounds
phone|object|📱|phone|sounds
flower|nature|🌼|flower|nature,life-cycle
tree|nature|🌳|tree|nature,big-small
leaf|nature|🍃|leaf|nature,colors
seed|nature|🌱|seedling|nature,life-cycle
rainbow|nature|🌈|rainbow|nature,weather,colors
cloud|nature|☁️|clouds|weather,sky
rain|nature|🌧️|rain|weather
snow|nature|❄️|snow|weather
sun|nature|☀️|sun sky|weather,sky
moon|nature|🌙|moon|sky,routines
ocean|nature|🌊|ocean|nature,water
rock|nature|🪨|rock|nature,sorting
house|place|🏠|house|places
park|place|🛝|playground|places`;
const old = existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : { photos: [], sounds: [] };
const have = new Set(old.photos.map((p) => p.id));
for (const line of V.split('\n')) {
  const [id, category, emoji, q, concepts] = line.split('|');
  if (have.has(id)) continue;
  old.photos.push({ id, subject: id.replace(/-/g, ' '), category, concepts: concepts.split(','), emoji,
    status: 'needed', path: null, search: `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
    sourceUrl: null, creator: null, licence: null, licenceUrl: null, attribution: null, checked: null,
    width: null, height: null, alt: null });
}
const S = 'dog:Woof woof!|cat:Meow!|cow:Moo!|sheep:Baa!|duck:Quack quack!|bird:Tweet tweet!|horse:Neigh!|pig:Oink oink!|chicken:Cluck cluck!|frog:Ribbit!|bee:Buzz buzz!|lion:Roar!|owl:Hoo hoo!|drum:Boom boom!|bell:Ding dong!|phone:Ring ring!|clock:Tick tock!|car:Beep beep!|rain:Pitter patter!';
const hs = new Set(old.sounds.map((s) => s.id));
for (const p of S.split('|')) {
  const [id, say] = p.split(':');
  if (hs.has(id)) continue;
  old.sounds.push({ id, subject: id, say, status: 'needed', path: null,
    search: `https://freesound.org/search/?q=${encodeURIComponent(id)}&f=license:%22Creative+Commons+0%22`,
    sourceUrl: null, creator: null, licence: null, licenceUrl: null, attribution: null, checked: null });
}
writeFileSync(F, JSON.stringify(old, null, 2) + '\n');
console.log(`${old.photos.length} photos, ${old.sounds.length} sounds`);
