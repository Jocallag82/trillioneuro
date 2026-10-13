// What went wrong, as a small closed set that can be counted.
//
// A wrong answer is tagged with one of these only when the answer itself shows it:
// a distractor is built from the mistake (47 + 38 = 715 is "added each column
// without carrying"), so choosing it is evidence of that mistake. Answers that
// could come from many mistakes are left untagged rather than guessed at.
// The AI tutor may suggest a code, but its suggestion is never stored as evidence.
//
// Retire a code by leaving it in place: stored rows reference these ids.

export const MISCONCEPTIONS = {
  'count-skip': {
    label: 'Skipping objects when counting',
    parent: 'Counted fewer than were there. Usually an object was missed. Touching each one while counting helps.',
    tip: 'Touch each one as you count, so none get missed.',
  },
  'count-double': {
    label: 'Counting an object twice',
    parent: 'Counted more than were there. Usually one object was counted twice. Moving or crossing off each one helps.',
    tip: 'Move each one aside as you count it, so you only count it once.',
  },
  'off-by-one': {
    label: 'One out when counting on or back',
    parent: 'The answer was one more or one less. Often the starting number was counted as the first step.',
    tip: 'When you count on, start from the next number, not the one you already have.',
  },
  'wrong-operation': {
    label: 'Added instead of subtracting (or the other way)',
    parent: 'Used the opposite operation. Reading the sign aloud before starting helps.',
    tip: 'Look at the sign first. Is it + or −?',
  },
  'no-regroup': {
    label: 'Not carrying a new ten',
    parent: 'Added each column separately and wrote both digits, instead of making a new ten.',
    tip: 'When the ones make 10 or more, that makes a new ten. Carry it to the tens.',
  },
  'smaller-from-larger': {
    label: 'Taking the smaller digit from the larger',
    parent: 'In each column, took the smaller digit from the larger one, even when it was on top. Needs exchanging a ten for ones.',
    tip: 'If the top ones digit is smaller, exchange one ten for ten ones first.',
  },
  'place-value-swap': {
    label: 'Mixing up tens and ones',
    parent: 'Swapped the tens and ones digits. Building numbers with tens and ones helps.',
    tip: 'The tens digit is on the left. The ones digit is on the right.',
  },
  'times-as-add': {
    label: 'Adding instead of multiplying',
    parent: 'Added the two numbers instead of multiplying. Thinking of equal groups helps.',
    tip: '3 × 4 means 3 groups of 4, not 3 add 4.',
  },
  'fraction-bigger-denominator': {
    label: 'Thinking a bigger bottom number means a bigger fraction',
    parent: 'Thought 1/8 is bigger than 1/4 because 8 is bigger than 4. Cutting the same shape into more parts makes each part smaller.',
    tip: 'More equal parts means each part is smaller.',
  },
  'fraction-count-parts': {
    label: 'Counting parts that are not equal',
    parent: 'Named a fraction from a shape whose parts are not equal, or counted shaded parts instead of all parts.',
    tip: 'The bottom number is how many equal parts the whole has.',
  },
  'number-line-ticks': {
    label: 'Counting marks instead of jumps on a number line',
    parent: 'Counted the marks rather than the spaces between them, so landed one place out.',
    tip: 'Count the jumps between the marks, starting at 0.',
  },
  'ruler-start': {
    label: 'Measuring from the end of the ruler instead of 0',
    parent: 'Read a length from 1 or from the edge of the ruler rather than from 0.',
    tip: 'Line up the start of the object with 0, then read the end.',
  },
  'letter-reversal': {
    label: 'Mixing up mirror letters (b/d, p/q)',
    parent: 'Chose a letter that is a mirror image of the right one. Very common up to about age 7.',
    tip: 'b has its tummy on the right. d has its tummy on the left.',
  },
  'sound-order': {
    label: 'Putting sounds in the wrong order',
    parent: 'Had the right letters but in the wrong order. Saying the word slowly and listening for the first sound helps.',
    tip: 'Say the word slowly. Which sound do you hear first?',
  },
  'pattern-unit': {
    label: 'Not finding the part that repeats',
    parent: 'Continued the pattern without finding the repeating part. Saying the pattern aloud helps.',
    tip: 'Find the part that repeats, then say it out loud.',
  },
  'sequence-rule': {
    label: 'Using the wrong rule for a number pattern',
    parent: 'Applied a different step from the one in the pattern (for example +2 instead of +3).',
    tip: 'Check the jump between every pair of numbers, not just the first.',
  },
  'clock-hands-swap': {
    label: 'Mixing up the hour and minute hands',
    parent: 'Read the long hand as the hour and the short hand as the minutes. Naming the hands before reading helps.',
    tip: 'The short hand shows the hour. The long hand shows the minutes.',
  },
  'clock-hour-next': {
    label: 'Reading the hour the hand is moving towards',
    parent: 'After half past, read the hour the short hand is heading to rather than the one it has passed.',
    tip: 'The hour is the number the short hand has just passed, not the next one.',
  },
  'area-perimeter-mix': {
    label: 'Mixing up area and perimeter',
    parent: 'Gave the distance around a shape when asked for the space inside, or the other way round.',
    tip: 'Area is the squares inside. Perimeter is the distance all the way round the edge.',
  },
  'perimeter-two-sides': {
    label: 'Adding only two sides for perimeter',
    parent: 'Added the length and width once, so went only half way round the shape.',
    tip: 'Perimeter goes all the way round: there are four sides to add.',
  },
  'decimal-longer-bigger': {
    label: 'Thinking more decimal digits means a bigger number',
    parent: 'Thought 0.35 is bigger than 0.4 because it has more digits. Comparing tenths first helps.',
    tip: 'Compare the tenths first. 0.4 has 4 tenths; 0.35 has only 3.',
  },
  'decimal-fraction-digits': {
    label: 'Writing a fraction’s digits as a decimal',
    parent: 'Wrote 3/10 as 3.10 by copying the digits, rather than as 3 tenths (0.3).',
    tip: 'Tenths go in the first place after the point. 3 tenths is 0.3.',
  },
  'one-step-only': {
    label: 'Stopping after the first step of a problem',
    parent: 'Did the first part of a two-step problem correctly but stopped before the second part. Asking “what does the question want?” at the end helps.',
    tip: 'Read the question again. Is there another step after that one?',
  },
};

export const isMisconception = (code) => typeof code === 'string' && Object.hasOwn(MISCONCEPTIONS, code);
