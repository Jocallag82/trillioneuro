// Tests for the Red Teddy bakery game logic (no DOM, no Phaser). Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, BOSS, PASS_MARK, ROUNDS_PER_LEVEL, makeRound, buildLevelRounds, buildBossRounds, checkAnswer, levelById,
} from '../redteddytutor/learn/game/js/curriculum.js';
import { mulberry32 } from '../redteddytutor/learn/game/js/rng.js';
import {
  tierFromResults, tierForSkill, adjustForSession, levelPassed, unlockedLevels,
} from '../redteddytutor/learn/game/js/mastery.js';

const kinds = ['count', 'compare', 'shape', 'pattern'];

test('every generated round is self-consistent for all tiers and many seeds', () => {
  for (const kind of kinds) {
    for (const tier of [1, 2, 3]) {
      for (let seed = 1; seed <= 200; seed++) {
        const r = makeRound(kind, tier, mulberry32(seed));
        assert.ok(r.options.includes(String(r.answer)), `${kind} t${tier} s${seed}: answer not offered`);
        assert.equal(new Set(r.options.map(String)).size, r.options.length, `${kind} t${tier}: duplicate options`);
        assert.ok(r.options.length >= 2 && r.options.length <= 4);
        assert.equal(r.hints.length, 2);
        assert.ok(r.prompt.length > 0);
      }
    }
  }
});

test('count rounds: the answer is the real number of cakes', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = makeRound('count', 2, mulberry32(seed));
    assert.equal(String(r.data.count), r.answer);
    assert.ok(r.data.count >= 3 && r.data.count <= 6);
  }
});

test('compare rounds: the answer names the tray with more cakes, and the trays differ', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = makeRound('compare', 3, mulberry32(seed));
    assert.notEqual(r.data.left, r.data.right);
    assert.equal(r.answer, r.data.left > r.data.right ? 'left' : 'right');
  }
});

test('pattern rounds: the gap answer matches the repeating sequence', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const tier of [1, 2, 3]) {
      const r = makeRound('pattern', tier, mulberry32(seed));
      const cycle = tier === 3 ? 3 : 2;
      assert.equal(r.data.seq[r.data.gap], r.answer);
      for (let i = cycle; i < r.data.seq.length; i++) {
        if (i !== r.data.gap) assert.equal(r.data.seq[i], r.data.seq[i - cycle], `tier ${tier} seed ${seed} breaks pattern`);
      }
    }
  }
});

test('checkAnswer accepts only the offered correct option', () => {
  const r = { options: ['2', '3', '4'], answer: '3' };
  assert.equal(checkAnswer(r, '3'), true);
  assert.equal(checkAnswer(r, 3), true, 'numbers are compared as text');
  assert.equal(checkAnswer(r, '2'), false);
  assert.equal(checkAnswer(r, '9'), false, 'an option that was never offered is rejected');
});

test('level rounds: five per level, tiers taken from the adaptive function', () => {
  const rounds = buildLevelRounds(LEVELS[0], (i) => (i < 2 ? 1 : 3), 42);
  assert.equal(rounds.length, ROUNDS_PER_LEVEL);
  assert.deepEqual(rounds.map((r) => r.tier), [1, 1, 3, 3, 3]);
  assert.ok(rounds.every((r) => r.kind === 'count'));
});

test('boss round mixes all four kinds', () => {
  const rounds = buildBossRounds(() => 2, 7);
  assert.equal(new Set(rounds.map((r) => r.kind)).size, 4);
});

test('levels are ordered and addressable', () => {
  assert.deepEqual(LEVELS.map((l) => l.order), [1, 2, 3, 4]);
  assert.equal(levelById(BOSS.id), BOSS);
  assert.equal(levelById('nope'), null);
  assert.ok(PASS_MARK <= ROUNDS_PER_LEVEL);
});

test('tiers: too few answers starts easy; accuracy moves the tier up and down', () => {
  assert.equal(tierFromResults([true, true]), 1);
  assert.equal(tierFromResults([false, false, false, true]), 1);
  assert.equal(tierFromResults([true, true, false, true]), 2);
  assert.equal(tierFromResults([true, true, true, true]), 3);
});

test('tierForSkill reads only the child\'s own recorded answers for that skill', () => {
  const steps = [
    ...Array.from({ length: 4 }, () => ({ skill: 'shapes', firstTry: true })),
    { skill: 'patterns', firstTry: false },
  ];
  assert.equal(tierForSkill(steps, 'shapes'), 3);
  assert.equal(tierForSkill(steps, 'patterns'), 1);
});

test('in-session adjustment: two misses in a row step the difficulty down, never below 1', () => {
  assert.equal(adjustForSession(3, 1), 3);
  assert.equal(adjustForSession(3, 2), 2);
  assert.equal(adjustForSession(1, 5), 1);
});

test('levels unlock one after another, only after a pass', () => {
  assert.deepEqual(unlockedLevels([], PASS_MARK), [LEVELS[0].id]);
  const failed = [{ activityId: LEVELS[0].id, correctFirst: 2 }];
  assert.deepEqual(unlockedLevels(failed, PASS_MARK), [LEVELS[0].id]);
  const passed = [{ activityId: LEVELS[0].id, correctFirst: 3 }];
  assert.deepEqual(unlockedLevels(passed, PASS_MARK), [LEVELS[0].id, LEVELS[1].id]);
  // A pass on level 2 without level 1 passed does not open level 3.
  const skipped = [{ activityId: LEVELS[1].id, correctFirst: 5 }];
  assert.equal(levelPassed(skipped, LEVELS[1].id, PASS_MARK), true);
  assert.deepEqual(unlockedLevels(skipped, PASS_MARK), [LEVELS[0].id]);
});
