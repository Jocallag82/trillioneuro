// Help for working a question out, before or after a wrong answer.
//
// Three rungs, always available, never costing a try:
//   1. Hints      - the question's own hints, one at a time.
//   2. The method - how to approach this kind of question, in words for the learner's age.
//   3. Show me how - a different question of the same kind, worked step by step with its
//                   answer, so the learner can copy the method on their own question.
// Nothing here gives away the answer to the question on screen.
// Using help is recorded by the engine (useHelp): the answer that follows is not unaided.
import { OBJECTIVES } from './curriculum/framework.js';
import { GENERATORS, generateStep } from './curriculum/generators.js';
import { LESSONS } from './curriculum/lessons.js';
import { workFor } from './curriculum/worked.js';

// How to approach skills that have no full lesson (mostly ages 3-7). Short, concrete,
// said aloud: one action per line.
export const HOWTO = {
  'count-to-5': ['Put your finger on one dot.', 'Say “one”. Move to the next dot and say “two”.', 'The last number you say is how many.'],
  'count-to-10': ['Touch each one as you count.', 'Count each one only once.', 'The last number you say is how many there are.'],
  'number-names': ['Look at the number.', 'Count the dots in each picture.', 'Find the picture with that many dots.'],
  'subitise': ['A full row of the frame has 5.', 'Count on from 5 for the dots in the next row.', 'Count the empty boxes too: the whole frame holds 10.'],
  'compare-numbers': ['Count both numbers, or picture them on a number line.', 'The number you say later when counting is bigger.'],
  'number-line-20': ['Find 0 at the start of the line.', 'Count the jumps between marks, not the marks.', 'Stop when you reach the number.'],
  'place-value-100': ['The left digit tells how many tens.', 'The right digit tells how many ones.', 'Each long block is a ten; each small cube is a one.'],
  'place-value-1000': ['Read the digits from left to right: hundreds, tens, ones.', 'Each place is worth ten times the place to its right.'],
  'bonds-to-10': ['Count how many you have.', 'Count up to 10 on your fingers.', 'The fingers you counted on are the missing part.'],
  'add-within-20': ['Start with the bigger number.', 'Count on the smaller number, one step at a time.', 'Or make 10 first, then add the rest.'],
  'subtract-within-20': ['Start at the bigger number.', 'Count back the smaller number, one step at a time.', 'Or count up from the smaller number to the bigger one.'],
  'times-2-5-10': ['Multiplying means equal groups.', 'Count in 2s, 5s or 10s, once for each group.'],
  'measure-length': ['Check that the object starts at 0 on the ruler.', 'Read the number where it ends.', 'If it does not start at 0, take the start away from the end.'],
  'shapes': ['Count the sides.', 'Look for corners.', 'A circle has no corners. A triangle has 3 sides.'],
  'shape-words': ['Count the sides and corners.', 'Say each shape name and check it against the picture.'],
  'letters': ['Look at the shape of the letter.', 'Watch the direction: b and d face different ways.'],
  'letter-sounds': ['Say the word slowly.', 'Listen to the very first sound.', 'Find the letter that makes that sound.'],
  'rhyme': ['Say the first word.', 'Listen to how it ends.', 'Find the word that ends with the same sound.'],
  'build-words': ['Say the word slowly, sound by sound.', 'Put the letter for the first sound first.', 'Add the letters in the order you hear them.'],
  'build-sentences': ['Find the word with a capital letter: it goes first.', 'Find the word with the period: it goes last.', 'Read it aloud to check it makes sense.'],
  'colours': ['Look at each color.', 'Say its name out loud.', 'Find the one that matches.'],
  'sorting': ['Look at just one thing: the color, or the shape.', 'Put each one with the others that match.'],
  'observation': ['Look at each picture in turn.', 'Most of them are the same.', 'Find the one that is different.'],
  'patterns': ['Say the pattern out loud from the start.', 'Find the part that repeats.', 'Say what comes next.'],
  'sequencing': ['Find the smallest number first.', 'Then find the next one up.', 'Keep going until all are in order.'],
  'memory': ['Turn over one card.', 'Try to remember where each card is.', 'Find the card that matches it.'],
};

// How much to show at once, and in what voice, for each stage.
const STAGE_STYLE = {
  early: { methodLines: 2, framing: 'Let’s work it out together.', exampleIntro: 'Watch me do one like it.' },
  primary: { methodLines: 3, framing: 'Here’s a way to work it out.', exampleIntro: 'Here is one like it, worked out step by step.' },
  middle: { methodLines: 4, framing: 'Method', exampleIntro: 'Worked example (different numbers)' },
  high: { methodLines: 4, framing: 'Method', exampleIntro: 'Worked example (different numbers)' },
};
export const styleFor = (stageId) => STAGE_STYLE[stageId] || STAGE_STYLE.primary;

// The method for an objective: the lesson's key ideas, or the short how-to.
export function methodFor(objective, stageId) {
  const style = styleFor(stageId);
  const lines = LESSONS[objective]?.ideas || HOWTO[objective] || [];
  return lines.slice(0, style.methodLines);
}

// Text of a step's correct answer, in the form the learner would see or enter.
export function answerText(step) {
  if (step.kind === 'order') return step.accept[0].replace(/ /g, ' ');
  if (step.kind === 'numberline' || step.kind === 'build') return String(step.target);
  if (step.options) return String(step.options.find((o) => o.id === step.answer)?.label ?? step.answer);
  return String(step.answer ?? '');
}

const signature = (s) => JSON.stringify([s.prompt, s.visual, s.answer, s.target, s.options?.map((o) => o.id)]);

// A worked example: a different question of the same kind, with its hints as the
// steps and its answer at the end. Null when no generator exists or no different
// question can be made (the method still shows).
export function workedExample(step, objective, rand) {
  if (!GENERATORS[objective] || ['drop', 'memory'].includes(step.kind)) return null;
  const d = step.difficulty || 2;
  const mine = signature(step);
  const myAnswer = answerText(step);
  for (let tries = 0; tries < 12; tries++) {
    const other = generateStep(objective, d, rand);
    // Never show the learner's own question, or one with the same answer.
    if (signature(other) === mine || answerText(other) === myAnswer) continue;
    // The same question with a different right option (rhymes, for example) would
    // still answer the learner's own question, so the wording must differ too.
    if (other.prompt === step.prompt && JSON.stringify(other.visual) === JSON.stringify(step.visual)) continue;
    if (other.kind !== step.kind && !(other.kind === undefined && step.kind === undefined)) continue;
    const answer = answerText(other);
    return { step: other, steps: workFor(objective, other, answer), answer };
  }
  return null;
}

// Everything the help panel can show for one question.
export function helpFor(step, objective, stageId, rand) {
  return {
    style: styleFor(stageId),
    hints: step.hints,
    method: methodFor(objective, stageId),
    example: workedExample(step, objective, rand),
    label: OBJECTIVES[objective]?.label || '',
  };
}
