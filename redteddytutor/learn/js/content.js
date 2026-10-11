// Red Teddy Tutor starter library. Every answer is pre-authored here and checked
// by scripts/learn.test.mjs. Nothing in this file is generated at runtime.
//
// Activity shape:
//   { id, title, domain, band, level, skill, instruction, steps: [step, ...] }
//   step: { prompt, visual?, options: [{ id, label, visual? }], answer, hints: [string, ...] }
// Visual shapes: dots, shape, swatch, text, sequence (items may be null = "?").

export const BANDS = ['2-3', '3-5', '5-7'];

export const LEVEL_NAMES = { 1: 'Starter', 2: 'Practice', 3: 'Challenge' };

export const DOMAINS = [
  'Counting', 'Numbers', 'Colours', 'Shapes', 'Sorting',
  'Patterns', 'Letters & sounds', 'Sequencing', 'Observation',
];

export const SKILLS = {
  'count-to-5': { label: 'Counting to 5', domain: 'Counting' },
  'count-to-10': { label: 'Counting to 10', domain: 'Counting' },
  'number-names': { label: 'Recognising numbers', domain: 'Numbers' },
  'colours': { label: 'Colours', domain: 'Colours' },
  'shapes': { label: 'Shapes', domain: 'Shapes' },
  'shape-words': { label: 'Matching words to shapes', domain: 'Shapes' },
  'sorting': { label: 'Sorting', domain: 'Sorting' },
  'patterns': { label: 'Patterns', domain: 'Patterns' },
  'letters': { label: 'Letter recognition', domain: 'Letters & sounds' },
  'letter-sounds': { label: 'Letter sounds', domain: 'Letters & sounds' },
  'sequencing': { label: 'Sequencing', domain: 'Sequencing' },
  'observation': { label: 'Spotting differences', domain: 'Observation' },
};

const RED = '#c8353d';
const BLUE = '#2f6fb3';
const YELLOW = '#f2c230';
const GREEN = '#3c9a5f';
const ORANGE = '#ee8a2b';

const swatch = (id, label, hex) => ({ id, label, visual: { kind: 'swatch', label, hex } });
const shape = (id, label) => ({ id, label, visual: { kind: 'shape', shape: id } });
const word = (label) => ({ id: label.toLowerCase(), label });
const num = (n) => ({ id: String(n), label: String(n) });

export const ACTIVITIES = [
  // ---- Counting ----
  {
    id: 'count-dots-3', title: 'Count the dots', domain: 'Counting', band: '2-3', level: 1, skill: 'count-to-5',
    instruction: 'Count the dots. Touch each one as you count.',
    steps: [{
      prompt: 'How many dots are there?',
      visual: { kind: 'dots', count: 3 },
      options: [num(2), num(3), num(4)],
      answer: '3',
      hints: ['Touch each dot as you count: one, two, three.', 'Point at one dot at a time so you do not skip any.'],
    }],
  },
  {
    id: 'count-dots-5', title: 'Count to five', domain: 'Counting', band: '3-5', level: 2, skill: 'count-to-5',
    instruction: 'Count carefully. Each dot is only counted once.',
    steps: [{
      prompt: 'How many dots are there?',
      visual: { kind: 'dots', count: 5 },
      options: [num(3), num(4), num(5), num(6)],
      answer: '5',
      hints: ['Start at one and count every dot in a line.', 'Count the dots from the top to the bottom, touching each one.'],
    }],
  },
  {
    id: 'count-dots-ten', title: 'Counting up to ten', domain: 'Counting', band: '5-7', level: 3, skill: 'count-to-10',
    instruction: 'Count each group. Then choose the matching number.',
    steps: [
      {
        prompt: 'How many dots are there?',
        visual: { kind: 'dots', count: 8 },
        options: [num(7), num(8), num(9), num(10)],
        answer: '8',
        hints: ['Count in twos to check: two, four, six, eight.', 'Count once more from the left, one dot at a time.'],
      },
      {
        prompt: 'How many dots are there?',
        visual: { kind: 'dots', count: 10 },
        options: [num(8), num(9), num(10), num(12)],
        answer: '10',
        hints: ['Ten is one more than nine. Count to check.', 'Count in fives: five, ten.'],
      },
    ],
  },

  // ---- Numbers ----
  {
    id: 'number-two', title: 'Find the number', domain: 'Numbers', band: '2-3', level: 1, skill: 'number-names',
    instruction: 'Find the number that is named.',
    steps: [
      {
        prompt: 'Which one is the number two?',
        options: [num(1), num(2), num(3)],
        answer: '2',
        hints: ['Two looks like a little swan on the water.', 'Two comes after one.'],
      },
      {
        prompt: 'Which one is the number one?',
        options: [num(1), num(3), num(5)],
        answer: '1',
        hints: ['One is the first number. It is a single straight line.', 'Look for the number with just one line.'],
      },
    ],
  },
  {
    id: 'number-group-8', title: 'Match the number to the group', domain: 'Numbers', band: '3-5', level: 2, skill: 'number-names',
    instruction: 'Look at the group. Which number tells how many?',
    steps: [{
      prompt: 'Which number matches this group?',
      visual: { kind: 'dots', count: 8 },
      options: [num(6), num(7), num(8), num(9)],
      answer: '8',
      hints: ['Count the group first, then find the number.', 'If you counted eight dots, the answer is the number eight.'],
    }],
  },

  // ---- Colours ----
  {
    id: 'colours-find', title: 'Find the colour', domain: 'Colours', band: '2-3', level: 1, skill: 'colours',
    instruction: 'Tap the colour you hear.',
    steps: [
      {
        prompt: 'Tap the red one.',
        options: [swatch('red', 'Red', RED), swatch('blue', 'Blue', BLUE), swatch('yellow', 'Yellow', YELLOW)],
        answer: 'red',
        hints: ['Red is the colour of a ripe strawberry.', 'Look for the colour like Red Teddy.'],
      },
      {
        prompt: 'Tap the blue one.',
        options: [swatch('green', 'Green', GREEN), swatch('blue', 'Blue', BLUE), swatch('orange', 'Orange', ORANGE)],
        answer: 'blue',
        hints: ['Blue is the colour of a clear sky.', 'Blue is cool and calm. It is not green.'],
      },
    ],
  },

  // ---- Shapes ----
  {
    id: 'shape-circle', title: 'Find the circle', domain: 'Shapes', band: '2-3', level: 1, skill: 'shapes',
    instruction: 'Which shape is a circle?',
    steps: [{
      prompt: 'Tap the circle.',
      options: [shape('circle', 'Circle'), shape('square', 'Square'), shape('triangle', 'Triangle')],
      answer: 'circle',
      hints: ['A circle is round all the way around, with no corners.', 'Look for the shape with no corners and no straight edges.'],
    }],
  },
  {
    id: 'shape-triangle-sides', title: 'How many sides?', domain: 'Shapes', band: '5-7', level: 3, skill: 'shapes',
    instruction: 'Count the straight sides of each shape.',
    steps: [{
      prompt: 'Which shape has three straight sides?',
      options: [shape('square', 'Square'), shape('triangle', 'Triangle'), shape('circle', 'Circle'), shape('rectangle', 'Rectangle')],
      answer: 'triangle',
      hints: ['Count the straight sides on each shape.', 'A triangle has three sides and three corners.'],
    }],
  },
  {
    id: 'shape-name-square', title: 'Name the shape', domain: 'Shapes', band: '3-5', level: 2, skill: 'shape-words',
    instruction: 'Look at the shape. Which word is its name?',
    steps: [{
      prompt: 'Which word names this shape?',
      visual: { kind: 'shape', shape: 'square' },
      options: [word('Circle'), word('Square'), word('Triangle')],
      answer: 'square',
      hints: ['This shape has four corners and four sides that are the same length.', 'The word starts with S.'],
    }],
  },

  // ---- Sorting ----
  {
    id: 'sort-round-corners', title: 'Round or corners?', domain: 'Sorting', band: '3-5', level: 2, skill: 'sorting',
    instruction: 'Sort each shape into the right group.',
    steps: [
      {
        prompt: 'Is this shape round or does it have corners?',
        visual: { kind: 'shape', shape: 'circle' },
        options: [word('Round'), word('Has corners')],
        answer: 'round',
        hints: ['Run your finger around the edge. Does it have corners?', 'A circle has no corners.'],
      },
      {
        prompt: 'Is this shape round or does it have corners?',
        visual: { kind: 'shape', shape: 'square' },
        options: [word('Round'), word('Has corners')],
        answer: 'has corners',
        hints: ['Run your finger around the edge. Does it have corners?', 'A square has four corners.'],
      },
      {
        prompt: 'Is this shape round or does it have corners?',
        visual: { kind: 'shape', shape: 'triangle' },
        options: [word('Round'), word('Has corners')],
        answer: 'has corners',
        hints: ['Run your finger around the edge. Does it have corners?', 'A triangle has three corners.'],
      },
    ],
  },
  {
    id: 'sort-warm-cool', title: 'Warm or cool colours?', domain: 'Sorting', band: '5-7', level: 3, skill: 'sorting',
    instruction: 'Warm colours are like sunshine. Cool colours are like water and sky.',
    steps: [
      {
        prompt: 'Is this colour warm or cool?',
        visual: { kind: 'swatch', label: 'Red', hex: RED },
        options: [word('Warm'), word('Cool')],
        answer: 'warm',
        hints: ['Think of fire and sunshine.', 'Red is a warm colour.'],
      },
      {
        prompt: 'Is this colour warm or cool?',
        visual: { kind: 'swatch', label: 'Blue', hex: BLUE },
        options: [word('Warm'), word('Cool')],
        answer: 'cool',
        hints: ['Think of water and the sky.', 'Blue is a cool colour.'],
      },
      {
        prompt: 'Is this colour warm or cool?',
        visual: { kind: 'swatch', label: 'Yellow', hex: YELLOW },
        options: [word('Warm'), word('Cool')],
        answer: 'warm',
        hints: ['Think of the sun.', 'Yellow is a warm colour.'],
      },
    ],
  },

  // ---- Observation ----
  {
    id: 'odd-one-out-shapes', title: 'Which one is different?', domain: 'Observation', band: '3-5', level: 2, skill: 'observation',
    instruction: 'Look closely at all three. Which one is not like the others?',
    steps: [{
      prompt: 'Tap the shape that is different.',
      options: [
        { id: 'first', label: 'First shape', visual: { kind: 'shape', shape: 'circle' } },
        { id: 'square', label: 'Second shape', visual: { kind: 'shape', shape: 'square' } },
        { id: 'third', label: 'Third shape', visual: { kind: 'shape', shape: 'circle' } },
      ],
      answer: 'square',
      hints: ['Two of these are round. Look for the one that is not round.', 'The different one has corners.'],
    }],
  },

  // ---- Letters & sounds ----
  {
    id: 'letters-find-b', title: 'Find the letter B', domain: 'Letters & sounds', band: '2-3', level: 1, skill: 'letters',
    instruction: 'Find the letter that is named.',
    steps: [{
      prompt: 'Which one is the letter B?',
      options: [word('P'), word('B'), word('D')],
      answer: 'b',
      hints: ['B has a straight line down one side and two bumps on the right.', 'P and B look alike, but B has two bumps.'],
    }],
  },
  {
    id: 'letter-sound-s', title: 'Listen for the sound', domain: 'Letters & sounds', band: '3-5', level: 2, skill: 'letter-sounds',
    instruction: 'Listen to the question. Then tap the letter.',
    steps: [{
      prompt: 'Which letter makes the sound sss, as in sun?',
      options: [word('S'), word('B'), word('M')],
      answer: 's',
      hints: ['Sun starts with a hissing sound, like a snake: sss.', 'The letter that looks like a snake is S.'],
    }],
  },
  {
    id: 'letter-initial-ball', title: 'What does it start with?', domain: 'Letters & sounds', band: '5-7', level: 3, skill: 'letter-sounds',
    instruction: 'Say the word slowly, then choose its first letter.',
    steps: [{
      prompt: 'Which letter does ball start with?',
      options: [word('B'), word('D'), word('P')],
      answer: 'b',
      hints: ['Say the word slowly: b-b-ball. Which letter makes the b sound?', 'The first sound in ball is b.'],
    }],
  },

  // ---- Patterns ----
  {
    id: 'pattern-colours', title: 'Finish the pattern', domain: 'Patterns', band: '3-5', level: 2, skill: 'patterns',
    instruction: 'Look for the pattern, then choose what comes next.',
    steps: [{
      prompt: 'What comes next?',
      visual: {
        kind: 'sequence',
        items: [
          { kind: 'swatch', label: 'Red', hex: RED },
          { kind: 'swatch', label: 'Blue', hex: BLUE },
          { kind: 'swatch', label: 'Red', hex: RED },
          { kind: 'swatch', label: 'Blue', hex: BLUE },
          null,
        ],
      },
      options: [swatch('red', 'Red', RED), swatch('blue', 'Blue', BLUE), swatch('yellow', 'Yellow', YELLOW)],
      answer: 'blue',
      hints: ['Look at the first two. Red, then blue. What repeats?', 'The colours take turns: red, blue, red, blue.'],
    }],
  },
  {
    id: 'pattern-shapes', title: 'Shapes that repeat', domain: 'Patterns', band: '3-5', level: 2, skill: 'patterns',
    instruction: 'Find the shape that repeats.',
    steps: [{
      prompt: 'Which shape comes next?',
      visual: {
        kind: 'sequence',
        items: [
          { kind: 'shape', shape: 'circle' },
          { kind: 'shape', shape: 'square' },
          { kind: 'shape', shape: 'circle' },
          { kind: 'shape', shape: 'square' },
          null,
        ],
      },
      options: [shape('circle', 'Circle'), shape('square', 'Square'), shape('triangle', 'Triangle')],
      answer: 'circle',
      hints: ['Circle, square, circle, square. What comes after square?', 'The pattern goes circle then square, again and again.'],
    }],
  },
  {
    id: 'pattern-counting-up', title: 'Counting in twos', domain: 'Patterns', band: '5-7', level: 3, skill: 'patterns',
    instruction: 'Each number follows a rule. Find the rule first.',
    steps: [{
      prompt: 'What number comes next?',
      visual: {
        kind: 'sequence',
        items: [
          { kind: 'text', text: '2' },
          { kind: 'text', text: '4' },
          { kind: 'text', text: '6' },
          null,
        ],
      },
      options: [num(7), num(8), num(9)],
      answer: '8',
      hints: ['Look at how much each number goes up.', 'Each number goes up by two.'],
    }],
  },

  // ---- Sequencing ----
  {
    id: 'sequence-months', title: 'What comes next?', domain: 'Sequencing', band: '5-7', level: 3, skill: 'sequencing',
    instruction: 'Put the steps in order. Say each one aloud.',
    steps: [{
      prompt: 'What comes next in the list?',
      visual: {
        kind: 'sequence',
        items: [
          { kind: 'text', text: 'Jan' },
          { kind: 'text', text: 'Feb' },
          { kind: 'text', text: 'Mar' },
          null,
        ],
      },
      options: [word('Apr'), word('May'), word('Jun')],
      answer: 'apr',
      hints: ['Say the months in order: January, February, March, ...', 'The month after March is April.'],
    }],
  },
];

