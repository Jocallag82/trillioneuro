// Practice for English (grades 4-12), science, social studies and computer science.
//
// Two kinds of item live here:
// - Computed items (density, F = ma, conservation of mass, Punnett squares, interest,
//   code tracing): the answer is worked out from the numbers shown, like the maths.
// - Authored banks: original questions written for Red Teddy Tutor, one correct
//   answer each, checked by hand and by the bank tests in scripts/curriculum.test.mjs
//   (unique answer, distinct options, hint present). Nothing is copied from textbooks.
import { int, pick, shuffled, choice, input, order } from './kit.js';

// A bank item: [question, answer, [wrong...], hint, misconception-for-first-wrong?]
function fromBank(rand, items, extra = {}) {
  const [prompt, answer, wrong, hint, mc] = pick(rand, items);
  return choice(rand, {
    prompt, answer, size: Math.min(4, wrong.length + 1), ...extra,
    wrong: wrong.map((value, i) => ({ value, ...(i === 0 && mc ? { misconception: mc } : {}) })),
    hints: [hint, 'Rule out the answers you are sure are wrong, then compare what is left.'],
  });
}

// ---------- English ----------
const GRAMMAR = [
  [
    ['Choose the word that fits: “The dogs wagged ___ tails.”', 'their', ['there', 'they’re'], '“Their” shows that something belongs to them.'],
    ['Choose the word that fits: “I would like ___ come too.”', 'to', ['too', 'two'], '“Too” means also or very; “two” is the number.'],
    ['Choose the word that fits: “___ going to the park after school.”', 'They’re', ['There', 'Their'], 'Try saying “they are”. Does it fit?'],
    ['Choose the word that fits: “Put the books over ___.”', 'there', ['their', 'they’re'], '“There” points to a place.'],
    ['Choose the word that fits: “The cookies were ___ hot to eat.”', 'too', ['to', 'two'], 'Which word means “very” or “more than is wanted”?'],
  ],
  [
    ['Choose the word that fits: “The cat licked ___ paw.”', 'its', ['it’s', 'its’'], '“It’s” always means “it is” or “it has”.'],
    ['Choose the word that fits: “___ the best player on the team.”', 'You’re', ['Your', 'Youre'], 'Try “you are”. Does the sentence still make sense?'],
    ['Choose the verb that agrees: “The box of crayons ___ on the shelf.”', 'is', ['are', 'were'], 'The subject is “box”, not “crayons”. Is “box” one thing or many?'],
    ['Choose the verb that agrees: “Neither my brother nor my sisters ___ home.”', 'are', ['is', 'was'], 'With “neither … nor”, the verb agrees with the nearer subject.'],
    ['Choose the correct pronoun: “Maya and ___ finished the project.”', 'I', ['me', 'myself'], 'Take out “Maya and”. Would you say “me finished”?'],
  ],
  [
    ['Choose the correct pronoun: “To ___ should I give the letter?”', 'whom', ['who', 'whose'], 'Answer the question: “I should give it to him.” If “him” fits, use “whom”.'],
    ['Choose the word that fits: “The new rule will ___ everyone in the school.”', 'affect', ['effect', 'affected'], '“Affect” is usually the verb; “effect” is usually the noun.'],
    ['Choose the word that fits: “The medicine had a strong ___ on her cough.”', 'effect', ['affect', 'affection'], 'Here the word follows “a strong”, so it is a noun.'],
    ['Which sentence is punctuated correctly?', 'I finished my homework; then I read a book.', ['I finished my homework, then I read a book.', 'I finished my homework then, I read a book.'], 'Two complete sentences cannot be joined by a comma alone.'],
    ['Choose the correct pronoun: “Between you and ___, the test was easy.”', 'me', ['I', 'myself'], '“Between” is a preposition, so the pronoun after it is an object pronoun.'],
  ],
];
function grammar(d, rand) { return fromBank(rand, GRAMMAR[d - 1]); }

const FIGURATIVE = [
  [
    ['“Her smile was as bright as the sun.” What kind of figurative language is this?', 'Simile', ['Metaphor', 'Personification'], 'A simile compares using “like” or “as”.'],
    ['“The classroom was a zoo.” What kind of figurative language is this?', 'Metaphor', ['Simile', 'Hyperbole'], 'A metaphor says one thing IS another, without “like” or “as”.'],
    ['“He ran like the wind.” What kind of figurative language is this?', 'Simile', ['Metaphor', 'Alliteration'], 'Look for the word “like” or “as”.'],
    ['“Time is a thief.” What kind of figurative language is this?', 'Metaphor', ['Simile', 'Personification'], 'Is time compared using “like” or “as”, or said to BE something?'],
  ],
  [
    ['“The wind whispered through the trees.” What kind of figurative language is this?', 'Personification', ['Simile', 'Hyperbole'], 'Can wind really whisper? Which device gives human actions to things?'],
    ['“I have told you a million times!” What kind of figurative language is this?', 'Hyperbole', ['Metaphor', 'Personification'], 'Is it meant literally, or is it an exaggeration?'],
    ['“Seven slippery snakes slid south.” What kind of language is this?', 'Alliteration', ['Hyperbole', 'Simile'], 'Listen to the first sound of each word.'],
    ['“The old car groaned up the hill.” What kind of figurative language is this?', 'Personification', ['Hyperbole', 'Alliteration'], 'Which word gives the car a human action?'],
  ],
  [
    ['“My backpack weighs a ton.” What does the speaker mean?', 'The backpack is very heavy.', ['The backpack weighs exactly 2,000 pounds.', 'The backpack is full of tools.'], 'It is hyperbole: an exaggeration for effect.'],
    ['“The test was a breeze.” What does the speaker mean?', 'The test was easy.', ['The test was outside.', 'The test was very short and windy.'], 'Think about how a gentle breeze feels.'],
    ['“Her words cut deeper than a knife.” What does the writer suggest?', 'Her words were deeply hurtful.', ['She was holding a knife.', 'She spoke very quietly.'], 'What can words “cut”, if not skin?'],
    ['“Hope is a lighthouse in a storm.” What does the metaphor suggest about hope?', 'It guides and comforts people in hard times.', ['It is dangerous during storms.', 'It is only useful near the sea.'], 'What does a lighthouse do for ships in a storm?'],
  ],
];
function figurative(d, rand) { return fromBank(rand, FIGURATIVE[d - 1]); }

const CONTEXT = [
  [
    ['“The puppy was so lethargic after the long walk that it slept all afternoon.” What does “lethargic” mean?', 'tired and slow', ['excited and loud', 'hungry'], 'What did the puppy do after the walk?'],
    ['“The water was so murky that we could not see the bottom of the pond.” What does “murky” mean?', 'cloudy and dark', ['very cold', 'very deep'], 'Why could they not see the bottom?'],
    ['“Unlike his gregarious sister, Leo preferred to stay home and read.” What does “gregarious” mean?', 'enjoys being with others', ['enjoys reading alone', 'very tall'], '“Unlike” tells you the sister is the opposite of Leo.'],
  ],
  [
    ['“The ancient bridge was fragile, so only one person could cross at a time.” What does “fragile” mean?', 'easily broken', ['very long', 'brightly painted'], 'Why might only one person cross at a time?'],
    ['“Despite the scorching heat, the team kept practicing.” What does “scorching” mean?', 'very hot', ['very windy', 'pleasantly warm'], '“Despite” signals that the heat made practice hard.'],
    ['“The instructions were ambiguous, so half the class did the wrong task.” What does “ambiguous” mean?', 'unclear; could be understood more than one way', ['very long', 'written in another language'], 'What went wrong because of the instructions?'],
  ],
  [
    ['“The senator’s speech was so verbose that the audience grew restless.” What does “verbose” mean?', 'using more words than needed', ['spoken very loudly', 'full of jokes'], 'Why might an audience grow restless during a speech?'],
    ['“Her meticulous notes included every date, name and detail.” What does “meticulous” mean?', 'extremely careful and precise', ['messy', 'quickly written'], 'What did her notes include?'],
    ['“The candidate’s claims were spurious; none of them held up to fact-checking.” What does “spurious” mean?', 'false or not genuine', ['surprising', 'very popular'], 'What happened when the claims were checked?'],
  ],
];
function contextClues(d, rand) { return fromBank(rand, CONTEXT[d - 1]); }

// Original short argumentative passages. Questions: claim (1), best evidence (2), irrelevant detail (3).
const ARGUMENTS = [
  {
    title: 'Later Start Times',
    text: 'Middle schools should start classes at 8:30 a.m. or later. Studies of teenage sleep have found that the body clock of adolescents shifts later, making it hard to fall asleep early. Schools that moved their start times later reported that students were more alert in morning classes. My cousin’s school has a great cafeteria. A later start would help students learn more of what they are taught.',
    q: [
      ['What is the author’s main claim?', 'Middle schools should start classes at 8:30 a.m. or later.', ['Teenagers sleep too much.', 'School cafeterias should be improved.']],
      ['Which sentence is the strongest evidence for the claim?', 'Schools that moved their start times later reported that students were more alert in morning classes.', ['A later start would help students learn more of what they are taught.', 'My cousin’s school has a great cafeteria.']],
      ['Which sentence does NOT support the claim?', 'My cousin’s school has a great cafeteria.', ['Studies of teenage sleep have found that the body clock of adolescents shifts later.', 'Schools that moved their start times later reported that students were more alert.']],
    ],
  },
  {
    title: 'A Town Library App',
    text: 'Our town should create a free library app. Many residents work during the library’s opening hours and cannot visit in person. An app would let them borrow e-books at any time of day. The library building was painted blue last year. Neighboring towns that offer apps have seen more people borrowing books.',
    q: [
      ['What is the author’s main claim?', 'The town should create a free library app.', ['The library should be painted a new color.', 'People should read more e-books than printed books.']],
      ['Which detail best supports the claim?', 'Neighboring towns that offer apps have seen more people borrowing books.', ['The library building was painted blue last year.', 'Our town should create a free library app.']],
      ['Which sentence is irrelevant to the argument?', 'The library building was painted blue last year.', ['Many residents work during the library’s opening hours.', 'An app would let them borrow e-books at any time of day.']],
    ],
  },
  {
    title: 'Reusable Water Bottles',
    text: 'Students should be required to use reusable water bottles at school. Single-use plastic bottles add to the waste that ends up in landfills. A school that installed bottle-filling stations counted thousands fewer plastic bottles in its trash in one year. Reusable bottles come in many colors. Making the switch is a simple way to reduce waste.',
    q: [
      ['What is the author’s main claim?', 'Students should be required to use reusable water bottles at school.', ['Reusable bottles come in many colors.', 'Landfills should be closed.']],
      ['Which sentence gives specific evidence for the claim?', 'A school that installed bottle-filling stations counted thousands fewer plastic bottles in its trash in one year.', ['Making the switch is a simple way to reduce waste.', 'Reusable bottles come in many colors.']],
      ['Which sentence does NOT help the argument?', 'Reusable bottles come in many colors.', ['Single-use plastic bottles add to the waste that ends up in landfills.', 'A school that installed bottle-filling stations counted thousands fewer plastic bottles.']],
    ],
  },
];
function argumentEvidence(d, rand) {
  const p = pick(rand, ARGUMENTS);
  const [q, answer, wrong] = p.q[d - 1];
  return choice(rand, {
    prompt: q, visual: { kind: 'passage', title: p.title, text: p.text }, answer, size: 3, wrong: wrong.map((value) => ({ value })),
    hints: [d === 1 ? 'The claim is what the author wants you to believe or do. It is often the first or last sentence.' : 'Good evidence is a fact or finding that makes the claim more believable.',
      d === 3 ? 'Ask of each sentence: does this give a reason to agree with the claim?' : 'An opinion that repeats the claim is not evidence.'],
  });
}

// Original short literary passages. Questions: point of view (1), tone (2), theme (3).
const LITERARY = [
  {
    title: 'The Last Leaf',
    text: 'I watched from my window as the wind tore at the maple tree. One by one the leaves let go, until a single red leaf clung to the highest branch. Every morning I checked on it. Every morning it was still there. By the time the first snow fell, I had decided that if one small leaf could hold on through all that, so could I.',
    q: [
      ['From which point of view is the story told?', 'First person', ['Third person', 'Second person'], 'Look at the pronouns the narrator uses for themself: I, me, my.'],
      ['Which word best describes the tone of the ending?', 'hopeful', ['angry', 'humorous'], 'How does the narrator feel in the final sentence?'],
      ['Which is the best statement of the theme?', 'Persistence can inspire us to keep going through hard times.', ['Autumn is the most beautiful season.', 'Trees lose their leaves in winter.'], 'A theme is a message about life, not just what happens.'],
    ],
  },
  {
    title: 'The Science Fair',
    text: 'Dev had rebuilt the volcano three times. When the judges reached his table, the baking soda fizzled out with a sad little burp. Dev laughed so hard that the judges laughed too. He did not win a ribbon, but on the bus home he was already sketching a better design.',
    q: [
      ['From which point of view is the story told?', 'Third person', ['First person', 'Second person'], 'Is the narrator a character saying “I”, or someone describing Dev?'],
      ['Which word best describes the tone of the passage?', 'lighthearted', ['tragic', 'furious'], 'How do Dev and the judges react when the volcano fails?'],
      ['Which is the best statement of the theme?', 'Failure can be a step toward doing better.', ['Volcanoes are dangerous.', 'Judges should give every student a ribbon.'], 'What does Dev do after he does not win?'],
    ],
  },
  {
    title: 'Grandmother’s Recipe',
    text: 'Marisol’s grandmother never measured anything. A handful of flour, a pinch of salt, a splash of milk. When Marisol finally wrote the recipe down, she had to watch her grandmother cook it five times. The card now hangs on the kitchen wall, stained and smudged, and it is the most precious thing the family owns.',
    q: [
      ['From which point of view is the story told?', 'Third person', ['First person', 'Second person'], 'Does the narrator say “I”, or describe Marisol from outside?'],
      ['Which word best describes the tone of the final sentence?', 'tender', ['sarcastic', 'fearful'], 'How does the narrator describe the recipe card?'],
      ['Which is the best statement of the theme?', 'Family traditions are worth preserving.', ['Recipes should always be measured exactly.', 'Kitchens should be kept clean.'], 'Why is a stained card the most precious thing the family owns?'],
    ],
  },
];
function literaryAnalysis(d, rand) {
  const p = pick(rand, LITERARY);
  const [q, answer, wrong, hint] = p.q[d - 1];
  return choice(rand, {
    prompt: q, visual: { kind: 'passage', title: p.title, text: p.text }, answer, size: 3, wrong: wrong.map((value) => ({ value })),
    hints: [hint, 'Point to the exact words in the passage that support your choice.'],
  });
}

// ---------- Science ----------
const MATTER = [
  [
    ['Which state of matter has a fixed shape?', 'Solid', ['Liquid', 'Gas'], 'Think of an ice cube compared with water and steam.'],
    ['What happens to ice when it is heated?', 'It melts into a liquid.', ['It turns straight into a solid.', 'It gets heavier.'], 'What happens to an ice cube left in the sun?'],
    ['Which of these is a gas?', 'Steam', ['Ice', 'Juice'], 'Which one spreads out to fill its container?'],
  ],
  [
    ['What is it called when a liquid turns into a gas?', 'Evaporation', ['Condensation', 'Freezing'], 'Think of a puddle drying up on a sunny day.'],
    ['What is it called when a gas cools and turns into a liquid?', 'Condensation', ['Evaporation', 'Melting'], 'Think of water drops forming on a cold glass.'],
    ['A liquid takes the shape of its container. What about its volume?', 'Its volume stays the same.', ['Its volume grows to fill the container.', 'It has no volume.'], 'Pour a cup of water into a bowl. Is there more or less water?'],
  ],
  [
    ['Why can gases be squeezed into a smaller space but solids cannot?', 'Gas particles are far apart, with lots of space between them.', ['Gas particles are bigger than solid particles.', 'Solids have no particles.'], 'Think about how tightly the particles are packed.'],
    ['When water freezes, what happens to the particles?', 'They slow down and lock into fixed positions.', ['They speed up and spread out.', 'They disappear.'], 'Freezing removes energy from the particles.'],
    ['Which change is NOT a change of state?', 'Dissolving sugar in water', ['Melting butter', 'Boiling water'], 'A change of state is between solid, liquid and gas of the same substance.'],
  ],
];
const ECOSYSTEMS = [
  [
    ['In the food chain grass → rabbit → fox, which is the producer?', 'Grass', ['Rabbit', 'Fox'], 'A producer makes its own food from sunlight.'],
    ['Where does the energy in almost every food chain first come from?', 'The sun', ['The soil', 'Water'], 'What do plants need to make food?'],
    ['What do decomposers such as fungi and bacteria do?', 'Break down dead plants and animals, returning nutrients to the soil.', ['Make food from sunlight.', 'Hunt other animals.'], 'What happens to a fallen log over many years?'],
  ],
  [
    ['In the food chain algae → small fish → heron, what is the heron?', 'A consumer that eats the small fish', ['A producer', 'A decomposer'], 'Does the heron make its own food?'],
    ['If all the rabbits in grass → rabbit → fox disappeared, what would most likely happen to the foxes?', 'They would have less food and their numbers would drop.', ['They would start making their own food.', 'Nothing would change.'], 'What do the foxes eat?'],
    ['What is an herbivore?', 'An animal that eats only plants', ['An animal that eats only meat', 'A plant that eats insects'], '“Herb” is a clue.'],
  ],
  [
    ['Why are there usually fewer predators than prey in an ecosystem?', 'Energy is lost at each step of a food chain, so less is available higher up.', ['Predators live longer.', 'Prey animals are always smaller.'], 'Think about how much energy each level passes on.'],
    ['Which describes the movement of matter in an ecosystem?', 'Matter cycles between living things and the environment.', ['Matter is used up and disappears.', 'Matter only moves from animals to plants.'], 'Think about what decomposers return to the soil.'],
    ['Which is an example of competition?', 'Two bird species eating the same seeds in a forest', ['A bee carrying pollen between flowers', 'A fungus breaking down a dead leaf'], 'Competition happens when organisms need the same limited resource.'],
  ],
];
const CELLS = [
  [
    ['What is the basic unit of all living things?', 'The cell', ['The atom', 'The organ'], 'Every living thing is made of at least one of these.'],
    ['Which part controls the cell’s activities and contains its DNA?', 'Nucleus', ['Cell membrane', 'Cytoplasm'], 'Think of the cell’s control center.'],
    ['Which part controls what enters and leaves the cell?', 'Cell membrane', ['Nucleus', 'Chloroplast'], 'It is the cell’s outer boundary.'],
  ],
  [
    ['Which structure is found in plant cells but not in animal cells?', 'Cell wall', ['Cell membrane', 'Nucleus'], 'What gives plant cells a rigid shape?'],
    ['What do mitochondria do?', 'Release energy from food for the cell', ['Make food from sunlight', 'Store DNA'], 'They are often called the powerhouse of the cell.'],
    ['Where does photosynthesis take place in a plant cell?', 'Chloroplasts', ['Mitochondria', 'Nucleus'], 'This part contains the green pigment chlorophyll.'],
  ],
  [
    ['Why do muscle cells contain many mitochondria?', 'Muscles need a lot of energy to contract.', ['Muscles make food from sunlight.', 'Mitochondria make muscles green.'], 'What do mitochondria provide?'],
    ['A cell with a cell wall, chloroplasts and a large central vacuole is most likely from:', 'A plant', ['An animal', 'A human'], 'Which kind of organism has all three?'],
    ['Which list goes from smallest to largest?', 'cell → tissue → organ → organ system', ['organ → cell → tissue → organ system', 'tissue → cell → organ system → organ'], 'Cells group into tissues, tissues into organs.'],
  ],
];
const PHOTO = [
  [
    ['What do plants need for photosynthesis?', 'Sunlight, water and carbon dioxide', ['Soil, oxygen and sugar', 'Darkness and warmth'], 'Think about what a plant takes in from air, roots and light.'],
    ['Which gas do plants release during photosynthesis?', 'Oxygen', ['Carbon dioxide', 'Nitrogen'], 'Which gas do animals need to breathe?'],
    ['What food does a plant make by photosynthesis?', 'Sugar (glucose)', ['Protein', 'Salt'], 'Plants store energy in a sweet substance.'],
  ],
  [
    ['Where does a plant get the carbon dioxide it uses?', 'From the air, through tiny pores in its leaves', ['From the soil, through its roots', 'From sunlight'], 'Carbon dioxide is a gas.'],
    ['Why are photosynthesis and animal respiration linked?', 'Photosynthesis makes oxygen animals use; respiration makes carbon dioxide plants use.', ['Both happen only at night.', 'Both make sugar from sunlight.'], 'Compare what each one takes in and gives out.'],
    ['What is the role of chlorophyll?', 'It absorbs light energy.', ['It stores water.', 'It releases carbon dioxide.'], 'It is the green pigment in leaves.'],
  ],
  [
    ['A plant is kept in the dark for a week. What most likely happens?', 'It makes little or no sugar and begins to weaken.', ['It grows faster.', 'It makes more oxygen.'], 'What does photosynthesis need?'],
    ['Which shows photosynthesis as a word equation?', 'carbon dioxide + water → glucose + oxygen', ['glucose + oxygen → carbon dioxide + water', 'oxygen + water → glucose + carbon dioxide'], 'The reactants are what the plant takes in.'],
    ['Why is photosynthesis important to almost every food web?', 'It turns light energy into chemical energy that consumers depend on.', ['It removes all oxygen from the air.', 'It only matters to plants.'], 'Where does the energy in food chains start?'],
  ],
];
const SPACE = [
  [
    ['Why do we see the moon change shape over a month?', 'We see different amounts of its sunlit half as it orbits Earth.', ['Earth’s shadow covers part of it each night.', 'The moon grows and shrinks.'], 'The moon does not make its own light.'],
    ['How long does Earth take to orbit the sun?', 'About one year', ['About one day', 'About one month'], 'One orbit is one trip around the sun.'],
    ['What causes day and night?', 'Earth spinning on its axis', ['Earth orbiting the sun', 'The moon blocking the sun'], 'Think about one full turn every 24 hours.'],
  ],
  [
    ['What causes the seasons on Earth?', 'The tilt of Earth’s axis', ['Earth’s distance from the sun', 'The phases of the moon'], 'When it is summer in the north, it is winter in the south.'],
    ['During a solar eclipse, what blocks the sun?', 'The moon', ['Earth', 'A cloud of dust'], 'Which body passes between Earth and the sun?'],
    ['During a lunar eclipse, where is Earth?', 'Between the sun and the moon', ['Behind the moon', 'Beside the sun'], 'Whose shadow falls on the moon?'],
  ],
  [
    ['Why is it summer in the Northern Hemisphere in June?', 'The Northern Hemisphere is tilted toward the sun, so sunlight is more direct.', ['Earth is closest to the sun in June.', 'The sun is hotter in June.'], 'Direct sunlight heats the ground more.'],
    ['Why do we not have a solar eclipse every month?', 'The moon’s orbit is tilted, so it usually passes above or below the sun’s line.', ['The moon is too small.', 'Eclipses only happen in winter.'], 'The sun, moon and Earth must line up exactly.'],
    ['About how long is one full cycle of moon phases?', 'About 29.5 days', ['About 7 days', 'About 365 days'], 'It is close to a calendar month.'],
  ],
];
function scienceBank(bank) { return (d, rand) => fromBank(rand, bank[d - 1]); }

function density(d, rand) {
  const dens = d === 1 ? int(rand, 1, 9) : pick(rand, [1, 2, 3, 4, 5, 7, 8, 11, 19]);
  const vol = int(rand, 2, 12);
  const mass = dens * vol;
  if (d === 3) {
    // Water is 1 g/cm³: below that floats, above sinks. Never exactly 1.
    const [m, v] = pick(rand, [[2, 4], [3, 6], [9, 18], [12, 16], [20, 10], [27, 9], [15, 5], [44, 11]]);
    const ans = m / v < 1 ? 'It floats' : 'It sinks';
    return {
      prompt: `An object has a mass of ${m} g and a volume of ${v} cm³. Water has a density of 1 g/cm³. Will the object float or sink in water?`,
      answer: ans, options: [{ id: 'It floats', label: 'It floats' }, { id: 'It sinks', label: 'It sinks' }],
      hints: ['Work out its density: mass ÷ volume.', 'Less dense than water floats; more dense sinks.'],
    };
  }
  return input(`A block has a mass of ${mass} g and a volume of ${vol} cm³. What is its density in g/cm³?`, dens,
    ['Density = mass ÷ volume.', `Work out ${mass} ÷ ${vol}.`], { [mass * vol]: 'wrong-operation' });
}

function forces(d, rand) {
  const m = int(rand, 2, 20); const a = int(rand, 1, 10); const f = m * a;
  if (d === 1) return input(`A ${m} kg cart accelerates at ${a} m/s². What net force acts on it, in newtons?`, f, ['Use F = m × a.', `Multiply ${m} by ${a}.`], { [m + a]: 'times-as-add' });
  if (d === 2) return input(`A net force of ${f} N acts on a ${m} kg box. What is its acceleration, in m/s²?`, a, ['Rearrange F = ma: a = F ÷ m.', `Work out ${f} ÷ ${m}.`], { [f * m]: 'wrong-operation' });
  return input(`A net force of ${f} N gives an object an acceleration of ${a} m/s². What is its mass, in kg?`, m, ['Rearrange F = ma: m = F ÷ a.', `Work out ${f} ÷ ${a}.`], { [f * a]: 'wrong-operation' });
}

const REACTIONS = [
  ['baking soda', 'vinegar', 'the products'], ['magnesium', 'oxygen', 'magnesium oxide'], ['iron', 'sulfur', 'iron sulfide'],
];
function conservationOfMass(d, rand) {
  const [r1, r2, prod] = pick(rand, REACTIONS);
  const m1 = int(rand, 5, 60); const m2 = int(rand, 5, 60);
  if (d === 1) return input(`In a sealed container, ${m1} g of ${r1} reacts completely with ${m2} g of ${r2}. What is the total mass of ${prod}, in grams?`, m1 + m2,
    ['In a closed system, mass is neither created nor destroyed.', 'Total mass before = total mass after.']);
  const total = m1 + m2;
  if (d === 2) return input(`${m1} g of ${r1} reacts completely with some ${r2} in a sealed container. The products have a mass of ${total} g. How much ${r2} reacted, in grams?`, m2,
    ['Mass before the reaction equals mass after.', `Subtract the ${m1} g you know from the ${total} g total.`], { [total + m1]: 'wrong-operation' });
  return {
    prompt: `A student burns ${m1} g of wood in an open dish. The ash left over has a mass of only ${Math.max(1, Math.round(m1 / 5))} g. What best explains the missing mass?`,
    answer: 'Gases produced in the reaction escaped into the air.',
    options: shuffled([
      { id: 'Gases produced in the reaction escaped into the air.', label: 'Gases produced in the reaction escaped into the air.' },
      { id: 'The mass was destroyed by the fire.', label: 'The mass was destroyed by the fire.' },
      { id: 'Heat has negative mass.', label: 'Heat has negative mass.' },
    ], rand),
    hints: ['Mass is conserved in every chemical reaction.', 'The dish was open. Where could some of the products go?'],
  };
}

function genetics(d, rand) {
  const [dom, rec, trait] = pick(rand, [['B', 'b', 'brown eyes'], ['T', 't', 'tall stems'], ['P', 'p', 'purple flowers']]);
  const crosses = d === 1 ? [[`${dom}${rec}`, `${rec}${rec}`]] : [[`${dom}${rec}`, `${dom}${rec}`], [`${dom}${rec}`, `${rec}${rec}`]];
  const [p1, p2] = pick(rand, crosses);
  const offspring = [];
  for (const a of p1) for (const b of p2) offspring.push(a + b);
  const showRecessive = d === 3 ? false : true;
  const count = offspring.filter((g) => (showRecessive ? g === rec + rec : g.includes(dom))).length;
  const answer = `${count}/4`;
  const asked = showRecessive ? `the recessive trait (${rec}${rec})` : `the dominant trait (${trait})`;
  const options = ['1/4', '2/4', '3/4', '4/4', '0/4'].filter((x) => x !== answer);
  return choice(rand, {
    prompt: `${trait[0].toUpperCase()}${trait.slice(1)} (${dom}) is dominant over ${rec}. Two parents, ${p1} × ${p2}, have offspring. What is the probability that an offspring shows ${asked}?`,
    answer, wrong: shuffled(options, rand).map((value) => ({ value })), size: 4,
    hints: ['Draw a Punnett square: one parent’s alleles across the top, the other’s down the side.', `Count the boxes out of 4 that show ${asked}.`],
  });
}

// ---------- Social studies ----------
const CAPITALS = [
  ['California', 'Sacramento', 'Los Angeles'], ['Texas', 'Austin', 'Houston'], ['New York', 'Albany', 'New York City'],
  ['Florida', 'Tallahassee', 'Miami'], ['Illinois', 'Springfield', 'Chicago'], ['Pennsylvania', 'Harrisburg', 'Philadelphia'],
  ['Washington', 'Olympia', 'Seattle'], ['Nevada', 'Carson City', 'Las Vegas'], ['Ohio', 'Columbus', 'Cleveland'],
  ['Georgia', 'Atlanta', 'Savannah'], ['Michigan', 'Lansing', 'Detroit'], ['Massachusetts', 'Boston', 'Worcester'],
  ['Colorado', 'Denver', 'Colorado Springs'], ['Arizona', 'Phoenix', 'Tucson'], ['Oregon', 'Salem', 'Portland'],
  ['Kentucky', 'Frankfort', 'Louisville'], ['Missouri', 'Jefferson City', 'Kansas City'], ['Alaska', 'Juneau', 'Anchorage'],
  ['Vermont', 'Montpelier', 'Burlington'], ['South Dakota', 'Pierre', 'Sioux Falls'],
];
function statesCapitals(d, rand) {
  const [state, capital, largest] = pick(rand, CAPITALS);
  const otherCaps = shuffled(CAPITALS.filter((c) => c[0] !== state).map((c) => c[1]), rand);
  return choice(rand, {
    prompt: `What is the capital of ${state}?`, answer: capital, size: d === 1 ? 3 : 4,
    wrong: [{ value: largest, misconception: 'capital-largest-city' }, ...otherCaps.map((value) => ({ value }))],
    hints: ['The capital is where the state legislature and governor work.', `It is not always the biggest city. ${largest} is large, but is it the capital?`],
  });
}

const BRANCHES = [
  [
    ['Which branch of the US government makes laws?', 'Legislative (Congress)', ['Executive (the President)', 'Judicial (the courts)'], '“Legislate” means to make laws.'],
    ['Who leads the executive branch?', 'The President', ['The Chief Justice', 'The Speaker of the House'], 'The executive branch carries out laws.'],
    ['Which branch decides what laws mean and whether they follow the Constitution?', 'Judicial (the courts)', ['Legislative (Congress)', 'Executive (the President)'], 'Judges interpret laws.'],
  ],
  [
    ['What are the two parts of Congress?', 'The Senate and the House of Representatives', ['The Senate and the Supreme Court', 'The Cabinet and the House of Representatives'], 'Congress is the legislative branch.'],
    ['How many senators does each state have?', 'Two', ['One', 'It depends on population'], 'Every state has equal representation in the Senate.'],
    ['What is the highest court in the United States?', 'The Supreme Court', ['The Court of Appeals', 'Congress'], 'It sits at the top of the judicial branch.'],
  ],
  [
    ['The President vetoes a bill. How can Congress still make it a law?', 'Override the veto with a two-thirds vote in both houses.', ['Ask the Supreme Court to sign it.', 'Wait one year and pass it automatically.'], 'This is one of the checks Congress has on the President.'],
    ['Which is an example of the judicial branch checking Congress?', 'Declaring a law unconstitutional', ['Vetoing a bill', 'Approving a treaty'], 'What power do courts have over laws?'],
    ['Why does the Constitution separate powers among three branches?', 'So no single branch becomes too powerful.', ['So laws can be passed faster.', 'So the President can control the courts.'], 'Think about checks and balances.'],
  ],
];
const RIGHTS = [
  [
    ['Which amendment protects freedom of speech, religion and the press?', 'The First Amendment', ['The Second Amendment', 'The Fifth Amendment'], 'It is the first right listed in the Bill of Rights.'],
    ['What is the Bill of Rights?', 'The first ten amendments to the Constitution', ['The Declaration of Independence', 'A list of laws passed by Congress each year'], 'It was added to the Constitution in 1791.'],
    ['Which right lets people gather together peacefully?', 'Freedom of assembly', ['Freedom of the press', 'The right to a jury trial'], '“Assemble” means to gather.'],
  ],
  [
    ['Which amendment protects people from unreasonable searches and seizures?', 'The Fourth Amendment', ['The First Amendment', 'The Eighth Amendment'], 'It usually requires a warrant.'],
    ['The right not to be forced to testify against yourself is in which amendment?', 'The Fifth Amendment', ['The Sixth Amendment', 'The Tenth Amendment'], 'People sometimes say they “plead the Fifth”.'],
    ['Which amendment guarantees a speedy and public trial?', 'The Sixth Amendment', ['The Second Amendment', 'The Fourth Amendment'], 'It covers rights of the accused at trial.'],
  ],
  [
    ['The Eighth Amendment bans:', 'Cruel and unusual punishment', ['Searches without a warrant', 'Quartering soldiers in homes'], 'Think about what happens after someone is convicted.'],
    ['The Tenth Amendment says powers not given to the federal government belong to:', 'The states or the people', ['The President', 'The Supreme Court'], 'It is about the balance between national and state power.'],
    ['Why did some states insist on adding a Bill of Rights before ratifying the Constitution?', 'They wanted protection for individual liberties against a strong national government.', ['They wanted to give the President more power.', 'They wanted to end the Supreme Court.'], 'Think about what people feared from a strong central government.'],
  ],
];
const SUPPLY = [
  [
    ['A storm destroys many orange groves. What most likely happens to the price of oranges?', 'It goes up.', ['It goes down.', 'It stays the same.'], 'There are fewer oranges, but people still want them.'],
    ['A new toy becomes very popular and everyone wants one. What happens to its price?', 'It tends to rise.', ['It tends to fall.', 'It must stay the same.'], 'More demand for the same supply.'],
    ['What is “supply”?', 'How much of a product sellers are willing to sell', ['How much buyers want a product', 'The price of a product'], 'Supply comes from sellers.'],
  ],
  [
    ['A factory finds a cheaper way to make bikes and makes many more. What happens to bike prices?', 'They tend to fall.', ['They tend to rise.', 'They stay exactly the same.'], 'Supply increases while demand stays the same.'],
    ['When the price of a product rises, what usually happens to the quantity people want to buy?', 'It falls.', ['It rises.', 'It does not change.'], 'This is the law of demand.'],
    ['What is “scarcity”?', 'Wants are greater than the resources available to meet them.', ['When prices are very low', 'When a store closes'], 'It is the basic problem economics studies.'],
  ],
  [
    ['What happens at the equilibrium price?', 'The quantity supplied equals the quantity demanded.', ['Sellers make no profit.', 'Buyers want more than sellers make.'], 'It is where the supply and demand curves meet.'],
    ['The government sets a maximum price below equilibrium. What is the likely result?', 'A shortage', ['A surplus', 'No change in quantity sold'], 'At a low price, buyers want more than sellers offer.'],
    ['What is an opportunity cost?', 'The value of the next best choice given up', ['The price printed on a product', 'The money a business earns'], 'Every choice means giving something up.'],
  ],
];
function socialBank(bank) { return (d, rand) => fromBank(rand, bank[d - 1]); }

const EVENTS = [
  ['Declaration of Independence', 1776], ['US Constitution signed', 1787], ['Louisiana Purchase', 1803], ['Civil War begins', 1861],
  ['Emancipation Proclamation', 1863], ['Women win the right to vote (19th Amendment)', 1920], ['Stock market crash', 1929],
  ['Brown v. Board of Education', 1954], ['Civil Rights Act', 1964], ['Moon landing', 1969],
];
function usHistoryTimeline(d, rand) {
  const count = d === 1 ? 3 : 4;
  const span = d === 3 ? EVENTS : EVENTS.filter((e, i) => i % 2 === 0 || d === 2);
  const chosen = shuffled(span, rand).slice(0, count);
  const ordered = [...chosen].sort((a, b) => a[1] - b[1]);
  const labels = chosen.map(([name]) => name);
  // Tile labels are joined with spaces in an accepted answer, so encode them.
  // A four-per-em space looks like a space and still lets long tiles wrap.
  const enc = (s) => s.replace(/ /g, ' ');
  return order('Put these events in order, earliest first.', labels.map(enc), [ordered.map(([n]) => enc(n)).join(' ')], rand,
    [`Hint: ${ordered[0][0]} happened first.`, 'Think about which events had to happen before others were possible.'], null);
}

// ---------- Interest ----------
function interest(d, rand) {
  const P = 100 * int(rand, 2, 30); const r = pick(rand, [2, 3, 4, 5, 6, 8, 10]); const t = int(rand, 2, 6);
  const I = (P * r * t) / 100;
  if (d === 1) return input(`You save $${P} at ${r}% simple interest per year. How much interest do you earn in ${t} years, in dollars?`, I,
    ['Simple interest = principal × rate × time.', `Work out ${P} × ${r / 100} × ${t}.`]);
  if (d === 2) return input(`You borrow $${P} at ${r}% simple interest per year for ${t} years. How much do you repay in total, in dollars?`, P + I,
    ['First find the interest: principal × rate × time.', 'Then add the interest to the amount borrowed.'], { [I]: 'one-step-only' });
  const P2 = 1000 * int(rand, 1, 5); const r2 = pick(rand, [10, 20]);
  const after = P2 * (1 + r2 / 100) ** 2;
  return input(`$${P2} earns ${r2}% interest per year, compounded yearly. How much is in the account after 2 years, in dollars?`, Math.round(after),
    [`After year 1: ${P2} × ${1 + r2 / 100}.`, 'Year 2’s interest is calculated on the new total, not the original amount.'],
    { [P2 + 2 * P2 * r2 / 100]: 'simple-vs-compound' });
}

// ---------- Computer science ----------
// Programs are shown in Python. The answer is computed by running the same logic here.
function codeTracing(d, rand) {
  if (d === 1) {
    const a = int(rand, 2, 12); const b = int(rand, 2, 9);
    const op = pick(rand, ['+', '*', '-']);
    const ans = op === '+' ? a + b : op === '*' ? a * b : a - b;
    const code = `x = ${a}\ny = ${b}\nx = x ${op} y\nprint(x)`;
    return input('What does this program print?', ans, ['Track the value of each variable line by line.', 'The third line replaces x with a new value.'], {}, { kind: 'code', text: code });
  }
  if (d === 2) {
    if (rand() < 0.5) {
      const n = int(rand, 3, 7); const k = int(rand, 2, 6);
      const code = `total = 0\nfor i in range(${n}):\n    total = total + ${k}\nprint(total)`;
      return input('What does this program print?', n * k, [`range(${n}) runs the loop ${n} times: i = 0, 1, …, ${n - 1}.`, `Each time, ${k} is added to total.`], { [(n - 1) * k]: 'off-by-one' }, { kind: 'code', text: code });
    }
    const n = int(rand, 3, 8);
    const code = `total = 0\nfor i in range(1, ${n + 1}):\n    total = total + i\nprint(total)`;
    return input('What does this program print?', (n * (n + 1)) / 2, [`range(1, ${n + 1}) gives 1, 2, …, ${n}.`, 'Add each value of i to total.'], { [((n - 1) * n) / 2]: 'off-by-one' }, { kind: 'code', text: code });
  }
  if (rand() < 0.5) {
    const limit = pick(rand, [20, 50, 100, 30]);
    let x = 1; while (x < limit) x *= 2;
    const code = `x = 1\nwhile x < ${limit}:\n    x = x * 2\nprint(x)`;
    return input('What does this program print?', x, ['The loop keeps doubling x while x is less than the limit.', 'Write down x after each pass, and stop when the condition becomes false.'], {}, { kind: 'code', text: code });
  }
  const lo = int(rand, 1, 6); const hi = lo + int(rand, 5, 9);
  let count = 0; for (let i = lo; i < hi; i++) if (i % 2 === 0) count++;
  const code = `count = 0\nfor n in range(${lo}, ${hi}):\n    if n % 2 == 0:\n        count = count + 1\nprint(count)`;
  return input('What does this program print?', count, [`range(${lo}, ${hi}) stops before ${hi}.`, 'n % 2 == 0 is true when n is even. Count the even numbers.'], {}, { kind: 'code', text: code });
}

export const SUBJECT_GENERATORS = {
  'grammar-usage': grammar,
  'figurative-language': figurative,
  'context-clues': contextClues,
  'argument-evidence': argumentEvidence,
  'literary-analysis': literaryAnalysis,
  'states-of-matter': scienceBank(MATTER),
  'food-chains': scienceBank(ECOSYSTEMS),
  'cells': scienceBank(CELLS),
  'photosynthesis': scienceBank(PHOTO),
  'earth-moon-sun': scienceBank(SPACE),
  'density': density,
  'forces-motion': forces,
  'conservation-of-mass': conservationOfMass,
  'genetics': genetics,
  'states-capitals': statesCapitals,
  'branches-of-government': socialBank(BRANCHES),
  'us-history-timeline': usHistoryTimeline,
  'bill-of-rights': socialBank(RIGHTS),
  'supply-demand': socialBank(SUPPLY),
  'simple-interest': interest,
  'code-tracing': codeTracing,
};

// Authored banks, exposed for the bank tests.
export const BANKS = { GRAMMAR, FIGURATIVE, CONTEXT, MATTER, ECOSYSTEMS, CELLS, PHOTO, SPACE, BRANCHES, RIGHTS, SUPPLY };
