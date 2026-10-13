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
  'additive-scaling': {
    label: 'Adding instead of scaling',
    parent: 'Added the same amount to both quantities instead of multiplying both by the same factor. Ratios grow by multiplying.',
    tip: 'A ratio stays the same when both parts are multiplied by the same number, not when the same amount is added.',
  },
  'integer-sign': {
    label: 'Sign error with negative numbers',
    parent: 'Got the size of the answer right but the sign wrong. Picturing a number line, or the rules for signs, helps.',
    tip: 'Check the sign separately: which direction do you move on the number line?',
  },
  'median-unsorted': {
    label: 'Finding the median without ordering',
    parent: 'Took the middle value of the list as written, without putting the numbers in order first.',
    tip: 'Put the numbers in order from smallest to largest before you find the middle.',
  },
  'part-to-part': {
    label: 'Comparing part to part instead of part to whole',
    parent: 'Wrote a probability as one group compared with another group, instead of compared with the total.',
    tip: 'Probability compares the outcomes you want with all the possible outcomes.',
  },
  'inverse-operation': {
    label: 'Undoing with the wrong operation',
    parent: 'When solving an equation, undid an addition by adding (or a subtraction by subtracting) instead of using the opposite operation.',
    tip: 'To undo + 5, subtract 5 from both sides. Do the opposite operation.',
  },
  'power-as-product': {
    label: 'Multiplying the base by the exponent',
    parent: 'Worked out 2⁵ as 2 × 5 instead of 2 × 2 × 2 × 2 × 2.',
    tip: 'The exponent says how many times the base is multiplied by itself.',
  },
  'exponent-law-mix': {
    label: 'Mixing up the laws of exponents',
    parent: 'Multiplied exponents when they should be added (or the other way round). x³ · x⁴ = x⁷, but (x³)⁴ = x¹².',
    tip: 'Same base multiplied: add the exponents. A power of a power: multiply them.',
  },
  'pythagorean-no-square': {
    label: 'Adding sides without squaring',
    parent: 'Added the two shorter sides instead of their squares. The theorem is about the areas of squares on each side.',
    tip: 'Square each side first: a² + b² = c². Then take the square root.',
  },
  'slope-inverted': {
    label: 'Run over rise instead of rise over run',
    parent: 'Divided the change in x by the change in y. Slope is the change in y divided by the change in x.',
    tip: 'Slope = rise ÷ run: the change in y, divided by the change in x.',
  },
  'distribution-error': {
    label: 'Not multiplying every term in the parentheses',
    parent: 'Multiplied only the first term inside the parentheses. 3(x + 2) is 3x + 6, not 3x + 2.',
    tip: 'Multiply the number outside by every term inside the parentheses.',
  },
  'factor-sign': {
    label: 'Sign error in the solutions of a quadratic',
    parent: 'Factored correctly but gave solutions with the wrong signs. If (x − 2)(x − 3) = 0, then x = 2 or x = 3.',
    tip: 'Set each factor equal to zero: x − 2 = 0 gives x = 2.',
  },
  'trig-ratio-mix': {
    label: 'Mixing up sine, cosine and tangent',
    parent: 'Used the wrong pair of sides for the ratio. SOH CAH TOA is a common memory aid.',
    tip: 'SOH CAH TOA: sine = opposite ÷ hypotenuse, cosine = adjacent ÷ hypotenuse, tangent = opposite ÷ adjacent.',
  },
  'simple-vs-compound': {
    label: 'Using simple interest for compound interest',
    parent: 'Calculated interest only on the starting amount each year. Compound interest also earns interest on earlier interest.',
    tip: 'With compound interest, each year’s interest is added before the next year’s is worked out.',
  },
  'capital-largest-city': {
    label: 'Choosing the largest city instead of the capital',
    parent: 'Chose a state’s best-known or largest city. Many state capitals are smaller cities.',
    tip: 'The capital is where the state government meets. It is often not the biggest city.',
  },
  'density-inverted': {
    label: 'Dividing volume by mass',
    parent: 'Worked out volume ÷ mass instead of mass ÷ volume.',
    tip: 'Density = mass ÷ volume.',
  },
  'partial-product-place': {
    label: 'Forgetting the zero in a partial product',
    parent: 'Multiplied by the tens digit as if it were ones, so one partial product was ten times too small.',
    tip: 'When you multiply by the tens digit, you are multiplying by tens: write a zero first.',
  },
  'add-denominators': {
    label: 'Adding (or subtracting) the denominators',
    parent: 'Added the bottom numbers as well as the top numbers. 1/4 + 1/4 is 2/4, not 2/8: the size of the pieces does not change.',
    tip: 'Only the numerators are added. The denominator says what size the pieces are.',
  },
  'flip-wrong-fraction': {
    label: 'Flipping the wrong fraction when dividing',
    parent: 'Turned the first fraction upside down instead of the second.',
    tip: 'Keep the first fraction, change ÷ to ×, flip the second.',
  },
  'left-to-right': {
    label: 'Working strictly left to right',
    parent: 'Did the operations in the order they were written instead of multiplying and dividing before adding and subtracting.',
    tip: 'Parentheses, then exponents, then × and ÷, then + and −.',
  },
  'triangle-no-half': {
    label: 'Forgetting the half in a triangle area',
    parent: 'Multiplied base by height without halving. A triangle is half of a rectangle.',
    tip: 'Area of a triangle = ½ × base × height.',
  },
  'circle-area-circumference': {
    label: 'Mixing up area and circumference',
    parent: 'Used the circumference formula (2πr) for area, or the other way round.',
    tip: 'Circumference goes around: 2πr. Area covers the inside: πr².',
  },
  'radius-diameter': {
    label: 'Mixing up radius and diameter',
    parent: 'Used the diameter where the formula needs the radius (or the reverse).',
    tip: 'The radius is half the diameter.',
  },
  'count-zeros': {
    label: 'Counting zeros instead of places',
    parent: 'Counted the zeros in the number rather than how far the decimal point moves.',
    tip: 'Count the places the decimal point moves to give a number from 1 to 10.',
  },
  'cone-no-third': {
    label: 'Forgetting the third in a cone',
    parent: 'Found the volume of the matching cylinder. A cone holds one third as much.',
    tip: 'Volume of a cone = ⅓πr²h.',
  },
  'linear-vs-exponential': {
    label: 'Treating repeated multiplying as adding',
    parent: 'Added the same amount each time when the amount should be multiplied each time.',
    tip: '“Doubles every hour” means × 2 each hour, not + the starting amount.',
  },
  'iqr-range-mix': {
    label: 'Mixing up range and interquartile range',
    parent: 'Gave the range (largest − smallest) instead of Q3 − Q1.',
    tip: 'The IQR is the spread of the middle half of the data: Q3 − Q1.',
  },
  'ke-no-half': {
    label: 'Forgetting the half in kinetic energy',
    parent: 'Worked out mass × speed² without halving.',
    tip: 'Kinetic energy = ½ × m × v².',
  },
  'protons-neutrons-mix': {
    label: 'Mixing up protons, neutrons and mass number',
    parent: 'Confused the atomic number (protons) with the mass number (protons + neutrons).',
    tip: 'Atomic number = protons. Neutrons = mass number − atomic number.',
  },
  'ion-charge-sign': {
    label: 'Getting the ion charge the wrong way round',
    parent: 'Added electrons for a positive ion (or removed them for a negative one). A positive ion has lost electrons.',
    tip: 'Positive: fewer electrons than protons. Negative: more.',
  },
  'volume-surface-mix': {
    label: 'Mixing up volume and surface area',
    parent: 'Added the areas of the faces (surface area) instead of finding the space inside (volume).',
    tip: 'Volume fills the box: length × width × height. Surface area wraps it.',
  },
};

export const isMisconception = (code) => typeof code === 'string' && Object.hasOwn(MISCONCEPTIONS, code);
