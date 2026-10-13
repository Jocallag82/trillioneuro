// The learning framework: subjects, strands and objectives, and how they depend on
// each other. This is the one place that says WHAT is taught. Nothing here is about
// how it looks, which country it is taught in, or how a child is doing.
//
// Objective ids are also the `skill` ids stored with every recorded answer
// (rtt_attempts.skill, and `skill` in device progress). The first twelve are the
// skills the starter library and Teddy's Bakery have always recorded, so existing
// progress keeps its meaning. Retire an objective by leaving it here.
//
// Honesty rules for this file:
// - `bands` are the ages an objective is usually met at. A starting point, not a rule.
// - Objectives here never claim alignment by themselves. Which official standards an
//   objective relates to, and for which grade, lives in a country catalogue
//   (catalogues/us.js), with the standard's source and how closely it is addressed.
// - `review` marks who checked the wording: 'authored' means written by the Red Teddy
//   team and covered by tests. Nothing is marked reviewed by an outside educator.

export const BANDS = ['2-3', '3-5', '5-7', '7-9', '9-11', '11-14', '14-18'];

// How the workspace should feel at each stage. Used by the UI, never by the engine.
export const STAGES = {
  '2-3': { id: 'early', label: 'Toddler', supervised: true, reading: 'none', diagnostic: false },
  '3-5': { id: 'early', label: 'Pre-school', supervised: true, reading: 'none', diagnostic: true },
  '5-7': { id: 'early', label: 'Early primary', supervised: false, reading: 'early', diagnostic: true },
  '7-9': { id: 'primary', label: 'Primary', supervised: false, reading: 'independent', diagnostic: true },
  '9-11': { id: 'primary', label: 'Upper primary', supervised: false, reading: 'independent', diagnostic: true },
  '11-14': { id: 'middle', label: 'Middle school', supervised: false, reading: 'independent', diagnostic: true },
  '14-18': { id: 'high', label: 'High school', supervised: false, reading: 'independent', diagnostic: true },
};

export const SUBJECTS = {
  maths: { label: 'Maths', strands: ['number', 'calculation', 'fractions', 'shape', 'measure', 'data', 'ratio', 'algebra', 'functions', 'trigonometry', 'calculus'] },
  literacy: { label: 'Reading & words', strands: ['letters', 'words', 'sentences', 'reading', 'language', 'writing'] },
  science: { label: 'Science', strands: ['physical', 'life', 'earth'] },
  social: { label: 'Social studies', strands: ['civics', 'history', 'geography', 'economics'] },
  computing: { label: 'Computer science', strands: ['programming'] },
  thinking: { label: 'Thinking skills', strands: ['patterns', 'sorting', 'memory', 'reasoning'] },
};

export const STRANDS = {
  number: 'Number sense',
  calculation: 'Calculation',
  fractions: 'Fractions',
  shape: 'Shape & space',
  measure: 'Measurement',
  data: 'Data & graphs',
  letters: 'Letters & sounds',
  words: 'Words & vocabulary',
  sentences: 'Sentences',
  reading: 'Reading for meaning',
  patterns: 'Patterns & sequences',
  sorting: 'Sorting & observation',
  memory: 'Memory & attention',
  reasoning: 'Reasoning',
  ratio: 'Ratios, rates & percent',
  algebra: 'Expressions & equations',
  functions: 'Functions',
  trigonometry: 'Geometry & trigonometry',
  calculus: 'Calculus',
  language: 'Grammar & language',
  writing: 'Argument & evidence',
  physical: 'Physical science',
  life: 'Life science',
  earth: 'Earth & space science',
  civics: 'Civics & government',
  history: 'History',
  geography: 'Geography',
  economics: 'Economics & personal finance',
  programming: 'Programming',
};

// Each objective:
//   label        short name, shown to children and parents
//   domain       the older grouping used by the starter library (kept for compatibility)
//   subject, strand
//   bands        usual ages
//   prereqs      objectives that should be at least "developing" first
//   goal         what a child can do when this is secure (shown to parents)
//   order        position on the subject's ladder, used by the diagnostic
const O = (label, domain, subject, strand, bands, prereqs, goal, order) => ({
  label, domain, subject, strand, bands, prereqs, goal, order, review: 'authored',
});

export const OBJECTIVES = {
  // ---- Maths: number sense ----
  'count-to-5': O('Counting to 5', 'Counting', 'maths', 'number', ['2-3', '3-5'], [],
    'Counts up to five objects, saying one number for each.', 10),
  'count-to-10': O('Counting to 10', 'Counting', 'maths', 'number', ['3-5', '5-7'], ['count-to-5'],
    'Counts up to ten objects accurately, without skipping or counting twice.', 20),
  'number-names': O('Recognising numbers', 'Numbers', 'maths', 'number', ['3-5', '5-7'], ['count-to-5'],
    'Recognises the written numbers 0 to 10 and matches them to amounts.', 22),
  'subitise': O('Seeing amounts at a glance', 'Numbers', 'maths', 'number', ['3-5', '5-7'], ['count-to-5'],
    'Recognises small amounts on a ten frame without counting one by one.', 25),
  'compare-numbers': O('More and fewer', 'Numbers', 'maths', 'number', ['3-5', '5-7'], ['count-to-10'],
    'Says which of two amounts or numbers is bigger, up to 20.', 30),
  'number-line-20': O('Number line to 20', 'Numbers', 'maths', 'number', ['5-7', '7-9'], ['number-names', 'compare-numbers'],
    'Places numbers up to 20 on a number line, using the marks in between.', 40),
  'place-value-100': O('Tens and ones', 'Place value', 'maths', 'number', ['5-7', '7-9'], ['number-line-20'],
    'Explains a two-digit number as tens and ones (47 is 4 tens and 7 ones).', 60),
  'place-value-1000': O('Hundreds, tens and ones', 'Place value', 'maths', 'number', ['7-9', '9-11'], ['place-value-100'],
    'Reads and builds three-digit numbers from hundreds, tens and ones.', 80),
  // ---- Maths: calculation ----
  'bonds-to-10': O('Number bonds to 10', 'Addition & subtraction', 'maths', 'calculation', ['5-7'], ['count-to-10', 'subitise'],
    'Knows the pairs that make 10 (6 and 4, 7 and 3) and uses them.', 45),
  'add-within-20': O('Adding within 20', 'Addition & subtraction', 'maths', 'calculation', ['5-7'], ['bonds-to-10'],
    'Adds two numbers with a total up to 20, counting on or using bonds.', 50),
  'subtract-within-20': O('Subtracting within 20', 'Addition & subtraction', 'maths', 'calculation', ['5-7', '7-9'], ['bonds-to-10'],
    'Takes away within 20 and understands subtraction as finding the difference.', 52),
  'add-2digit': O('Adding two-digit numbers', 'Addition & subtraction', 'maths', 'calculation', ['7-9'], ['place-value-100', 'add-within-20'],
    'Adds two-digit numbers, including when the ones make a new ten.', 65),
  'subtract-2digit': O('Subtracting two-digit numbers', 'Addition & subtraction', 'maths', 'calculation', ['7-9'], ['place-value-100', 'subtract-within-20'],
    'Subtracts two-digit numbers, including exchanging a ten for ones.', 67),
  'times-2-5-10': O('Times tables: 2, 5 and 10', 'Multiplication & division', 'maths', 'calculation', ['7-9'], ['add-within-20'],
    'Understands multiplication as equal groups and knows the 2, 5 and 10 times tables.', 70),
  'times-tables': O('Times tables to 12', 'Multiplication & division', 'maths', 'calculation', ['7-9', '9-11'], ['times-2-5-10'],
    'Recalls multiplication facts up to 12 × 12.', 85),
  'division-facts': O('Division facts', 'Multiplication & division', 'maths', 'calculation', ['7-9', '9-11'], ['times-tables'],
    'Uses times tables to divide, and knows division undoes multiplication.', 90),
  // ---- Maths: fractions ----
  'unit-fractions': O('Halves, thirds and quarters', 'Fractions', 'maths', 'fractions', ['7-9'], ['times-2-5-10'],
    'Recognises a fraction as equal parts of a whole, and names unit fractions.', 75),
  'fractions-compare': O('Comparing fractions', 'Fractions', 'maths', 'fractions', ['9-11'], ['unit-fractions', 'number-line-20'],
    'Places fractions on a number line and compares them.', 95),
  // ---- Maths: shape and measure ----
  'shapes': O('Shapes', 'Shapes', 'maths', 'shape', ['2-3', '3-5'], [],
    'Recognises circles, squares, triangles and rectangles in any size or turn.', 12),
  'shape-words': O('Matching words to shapes', 'Shapes', 'maths', 'shape', ['5-7'], ['shapes', 'letters'],
    'Reads the names of common shapes and matches them.', 35),
  'measure-length': O('Measuring length', 'Measurement', 'maths', 'measure', ['5-7', '7-9'], ['number-line-20'],
    'Reads a length in centimetres from a ruler that starts at zero.', 55),
  // ---- Reading and words ----
  'letters': O('Letter recognition', 'Letters & sounds', 'literacy', 'letters', ['3-5', '5-7'], [],
    'Recognises letters by shape, including ones that are easy to mix up.', 10),
  'letter-sounds': O('Letter sounds', 'Letters & sounds', 'literacy', 'letters', ['3-5', '5-7'], ['letters'],
    'Matches common letters to the sound they usually make.', 20),
  'rhyme': O('Rhyming words', 'Words & spelling', 'literacy', 'words', ['3-5', '5-7'], [],
    'Hears and chooses words that rhyme.', 25),
  'build-words': O('Building words', 'Words & spelling', 'literacy', 'words', ['5-7'], ['letter-sounds'],
    'Builds simple words (cat, ship) from their sounds, in order.', 30),
  'vocabulary': O('Word meanings', 'Words & spelling', 'literacy', 'words', ['7-9', '9-11'], ['build-words'],
    'Chooses words with the same or opposite meaning, and uses context.', 50),
  'build-sentences': O('Building sentences', 'Sentences', 'literacy', 'sentences', ['5-7', '7-9'], ['build-words'],
    'Puts words in order to make a sentence that makes sense.', 40),
  'word-parts': O('Prefixes and suffixes', 'Words & spelling', 'literacy', 'words', ['7-9', '9-11'], ['vocabulary'],
    'Knows how un-, re-, -ful and -less change a word’s meaning.', 70),
  // ---- Thinking skills ----
  'colours': O('Colours', 'Colours', 'thinking', 'sorting', ['2-3', '3-5'], [],
    'Names and matches the main colours.', 5),
  'sorting': O('Sorting', 'Sorting', 'thinking', 'sorting', ['2-3', '3-5'], [],
    'Sorts objects into groups by one rule: colour, shape or size.', 10),
  'observation': O('Spotting differences', 'Observation', 'thinking', 'sorting', ['3-5', '5-7'], ['sorting'],
    'Notices what is the same and what is different between pictures.', 20),
  'patterns': O('Patterns', 'Patterns', 'thinking', 'patterns', ['3-5', '5-7'], ['colours'],
    'Continues a repeating pattern by finding the part that repeats.', 25),
  'sequencing': O('Sequencing', 'Sequencing', 'thinking', 'patterns', ['3-5', '5-7'], [],
    'Puts events or numbers in order.', 30),
  'memory': O('Memory', 'Observation', 'thinking', 'memory', ['3-5', '5-7'], [],
    'Remembers where things are and finds matching pairs.', 15),
  'number-patterns': O('Number patterns', 'Patterns', 'thinking', 'patterns', ['7-9', '9-11'], ['add-within-20'],
    'Finds the rule in a number sequence and continues it.', 60),
  'logic-puzzles': O('Logic puzzles', 'Logic', 'thinking', 'reasoning', ['7-9', '9-11'], ['sequencing'],
    'Combines two or more clues to work out an order, and checks the answer against every clue.', 65),

  // ---- Older learners (7 to 11) ----
  'tell-time': O('Telling the time', 'Time', 'maths', 'measure', ['7-9'], ['times-2-5-10'],
    'Reads an analogue clock to the nearest five minutes.', 72),
  'bar-charts': O('Reading bar charts', 'Data', 'maths', 'data', ['7-9', '9-11'], ['compare-numbers', 'times-2-5-10'],
    'Reads values from a bar chart, including scales that count in 2s, 5s or 10s, and compares bars.', 74),
  'word-problems': O('Word problems', 'Problem solving', 'maths', 'calculation', ['7-9', '9-11'], ['add-2digit', 'subtract-2digit'],
    'Works out what a story problem is asking, chooses the operations and solves problems with two steps.', 88),
  'area-perimeter': O('Area and perimeter', 'Area & perimeter', 'maths', 'shape', ['9-11'], ['times-tables'],
    'Finds the area of a rectangle by counting or multiplying, and its perimeter by adding all four sides.', 92),
  'decimals': O('Decimals', 'Decimals', 'maths', 'fractions', ['9-11'], ['fractions-compare', 'place-value-1000'],
    'Knows tenths and hundredths, writes them as decimals, and compares and orders decimals.', 98),
  'spelling': O('Spelling tricky words', 'Spelling', 'literacy', 'words', ['7-9', '9-11'], ['build-words'],
    'Spots the correct spelling of common tricky words in a sentence.', 55),
  'comprehension': O('Reading comprehension', 'Reading', 'literacy', 'reading', ['7-9', '9-11'], ['build-sentences'],
    'Finds information in a short text, works out what is meant but not said, and explains word choices.', 60),

  // ---- Middle school maths (11 to 14) ----
  'integers': O('Positive and negative numbers', 'Integers', 'maths', 'number', ['11-14'], ['subtract-2digit'],
    'Adds, subtracts and multiplies positive and negative numbers.', 100),
  'ratios-rates': O('Ratios and unit rates', 'Ratios', 'maths', 'ratio', ['11-14'], ['division-facts'],
    'Finds unit rates and uses them to compare and scale quantities.', 101),
  'mean-median': O('Mean, median and range', 'Statistics', 'maths', 'data', ['11-14'], ['division-facts'],
    'Finds the mean, median and range of a data set.', 103),
  'percent': O('Percent', 'Ratios', 'maths', 'ratio', ['11-14'], ['ratios-rates', 'decimals'],
    'Finds a percent of a quantity and solves discount and increase problems.', 104),
  'exponents': O('Exponents and powers', 'Algebra', 'maths', 'algebra', ['11-14'], ['times-tables'],
    'Evaluates powers and uses the laws of exponents.', 105),
  'probability': O('Probability', 'Statistics', 'maths', 'data', ['11-14'], ['fractions-compare'],
    'Writes the probability of a simple event as a fraction from 0 to 1.', 106),
  'equations-two-step': O('Two-step equations', 'Algebra', 'maths', 'algebra', ['11-14'], ['integers'],
    'Solves equations of the form px + q = r and checks the solution.', 108),
  'pythagorean': O('The Pythagorean theorem', 'Geometry', 'maths', 'trigonometry', ['11-14'], ['exponents'],
    'Finds a missing side of a right triangle using a² + b² = c².', 110),
  'slope': O('Slope and rate of change', 'Functions', 'maths', 'functions', ['11-14'], ['integers', 'ratios-rates'],
    'Finds the slope of a line through two points and explains what it means.', 112),

  // ---- High school maths (14 to 18) ----
  'multi-step-equations': O('Multi-step linear equations', 'Algebra', 'maths', 'algebra', ['14-18'], ['equations-two-step'],
    'Solves linear equations with variables on both sides and parentheses.', 120),
  'function-notation': O('Function notation', 'Functions', 'maths', 'functions', ['14-18'], ['equations-two-step'],
    'Evaluates functions written as f(x), and finds the input for a given output.', 121),
  'systems': O('Systems of linear equations', 'Algebra', 'maths', 'algebra', ['14-18'], ['multi-step-equations'],
    'Solves a pair of linear equations by substitution or elimination.', 124),
  'quadratics': O('Solving quadratics by factoring', 'Algebra', 'maths', 'algebra', ['14-18'], ['multi-step-equations'],
    'Factors x² + bx + c and finds both solutions.', 126),
  'trig-ratios': O('Right-triangle trigonometry', 'Geometry', 'maths', 'trigonometry', ['14-18'], ['pythagorean'],
    'Uses sine, cosine and tangent as ratios of sides in a right triangle.', 128),
  'logarithms': O('Logarithms', 'Algebra II', 'maths', 'functions', ['14-18'], ['exponents'],
    'Evaluates logarithms as the inverse of exponents.', 130),
  'derivatives': O('Derivatives and the power rule', 'Calculus', 'maths', 'calculus', ['14-18'], ['function-notation', 'exponents'],
    'Differentiates polynomials with the power rule and finds the slope of a tangent.', 134),

  // ---- English, grades 4 to 12 ----
  'grammar-usage': O('Grammar and usage', 'Grammar', 'literacy', 'language', ['9-11', '11-14'], ['build-sentences'],
    'Uses commonly confused words, verb agreement and pronouns correctly.', 72),
  'figurative-language': O('Figurative language', 'Literature', 'literacy', 'reading', ['9-11', '11-14'], ['comprehension'],
    'Identifies and interprets similes, metaphors, personification and hyperbole.', 78),
  'context-clues': O('Word meaning from context', 'Vocabulary', 'literacy', 'words', ['11-14'], ['vocabulary'],
    'Works out an unfamiliar word’s meaning from clues in the sentence.', 82),
  'argument-evidence': O('Claims and evidence', 'Argument', 'literacy', 'writing', ['11-14', '14-18'], ['comprehension'],
    'Identifies an author’s claim and judges which evidence supports it.', 88),
  'literary-analysis': O('Theme, tone and point of view', 'Literature', 'literacy', 'reading', ['14-18'], ['figurative-language'],
    'Identifies theme, narrator’s point of view and tone in short literary passages.', 94),

  // ---- Science ----
  'states-of-matter': O('States of matter', 'Matter', 'science', 'physical', ['7-9'], [],
    'Describes solids, liquids and gases, and how heating and cooling change them.', 10),
  'food-chains': O('Food chains and ecosystems', 'Ecosystems', 'science', 'life', ['9-11'], [],
    'Traces how energy and matter move from plants to animals and decomposers.', 20),
  'cells': O('Cells and their parts', 'Cells', 'science', 'life', ['11-14'], ['food-chains'],
    'Names the main parts of plant and animal cells and what each one does.', 30),
  'earth-moon-sun': O('Earth, moon and sun', 'Space', 'science', 'earth', ['11-14'], [],
    'Explains moon phases, eclipses and seasons using the Earth–sun–moon system.', 32),
  'photosynthesis': O('Photosynthesis', 'Cells', 'science', 'life', ['11-14'], ['cells'],
    'Explains the inputs and outputs of photosynthesis and why it matters to living things.', 34),
  'density': O('Density', 'Matter', 'science', 'physical', ['11-14'], ['states-of-matter', 'division-facts'],
    'Calculates density from mass and volume and predicts whether an object floats.', 36),
  'forces-motion': O('Newton’s second law', 'Forces', 'science', 'physical', ['14-18'], ['equations-two-step'],
    'Uses F = ma to relate force, mass and acceleration.', 50),
  'conservation-of-mass': O('Conservation of mass', 'Chemistry', 'science', 'physical', ['14-18'], ['states-of-matter'],
    'Uses conservation of mass to find an unknown mass in a chemical reaction.', 52),
  'genetics': O('Genetics and Punnett squares', 'Genetics', 'science', 'life', ['14-18'], ['cells', 'probability'],
    'Predicts offspring traits with a Punnett square and states them as probabilities.', 55),

  // ---- Social studies ----
  'states-capitals': O('US states and capitals', 'Geography', 'social', 'geography', ['9-11'], [],
    'Names the capitals of US states and tells them apart from the largest cities.', 5),
  'branches-of-government': O('Branches of government', 'Civics', 'social', 'civics', ['9-11', '11-14'], [],
    'Describes the three branches of the US government and how they check each other.', 10),
  'us-history-timeline': O('US history timeline', 'History', 'social', 'history', ['9-11', '11-14'], [],
    'Puts major events in US history in chronological order.', 15),
  'bill-of-rights': O('The Bill of Rights', 'Civics', 'social', 'civics', ['11-14', '14-18'], ['branches-of-government'],
    'Identifies key rights protected by the first ten amendments.', 20),
  'supply-demand': O('Supply and demand', 'Economics', 'social', 'economics', ['11-14', '14-18'], [],
    'Predicts how prices change when supply or demand changes.', 30),
  'simple-interest': O('Interest and personal finance', 'Economics', 'social', 'economics', ['14-18'], ['percent'],
    'Calculates simple and compound interest and compares savings and loans.', 40),

  // ---- Computer science ----
  'code-tracing': O('Reading code', 'Programming', 'computing', 'programming', ['11-14', '14-18'], ['logic-puzzles'],
    'Predicts what short programs with variables, loops and conditions will print.', 10),
};

export const DOMAINS = [...new Set(Object.values(OBJECTIVES).map((o) => o.domain))];

// Legacy view used by the starter library and Teddy's Bakery.
export const SKILLS = Object.fromEntries(
  Object.entries(OBJECTIVES).map(([id, o]) => [id, { label: o.label, domain: o.domain }]),
);

export const bandIndex = (band) => BANDS.indexOf(band);

// Objectives in a subject, in ladder order.
export function ladder(subject) {
  return Object.entries(OBJECTIVES)
    .filter(([, o]) => o.subject === subject)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id]) => id);
}

// Objectives usually met at this band, or one band either side when `reach` is 1.
export function objectivesFor(band, reach = 0) {
  const i = bandIndex(band);
  return Object.keys(OBJECTIVES).filter((id) => OBJECTIVES[id].bands.some((b) => Math.abs(bandIndex(b) - i) <= reach));
}

// Every prerequisite, direct and indirect.
export function allPrereqs(id, seen = new Set()) {
  for (const p of OBJECTIVES[id]?.prereqs || []) {
    if (!seen.has(p)) { seen.add(p); allPrereqs(p, seen); }
  }
  return seen;
}

// Returns a list of problems; empty means the framework is consistent.
export function validateFramework() {
  const errors = [];
  for (const [id, o] of Object.entries(OBJECTIVES)) {
    if (!SUBJECTS[o.subject]) errors.push(`${id}: unknown subject ${o.subject}`);
    else if (!SUBJECTS[o.subject].strands.includes(o.strand)) errors.push(`${id}: strand ${o.strand} not in ${o.subject}`);
    if (!o.bands.length || !o.bands.every((b) => BANDS.includes(b))) errors.push(`${id}: bad bands`);
    for (const p of o.prereqs) if (!OBJECTIVES[p]) errors.push(`${id}: unknown prereq ${p}`);
    if (allPrereqs(id).has(id)) errors.push(`${id}: prerequisite cycle`);
    if (id.length > 40) errors.push(`${id}: id too long for storage`);
  }
  return errors;
}
