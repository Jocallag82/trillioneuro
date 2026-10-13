// National core build-out, high school (October 2026): geometry, statistics,
// calculus, physics, English 9-12 and computer science 11-12. Same rules as the other
// generator files; scripts/core.test.mjs re-solves every computed item.
import { int, pick, choice, input } from './kit.js';

function fromBank(rand, items) {
  const [prompt, answer, wrong, hint, mc] = pick(rand, items);
  return choice(rand, {
    prompt, answer, size: Math.min(4, wrong.length + 1),
    wrong: wrong.map((value, i) => ({ value, ...(i === 0 && mc ? { misconception: mc } : {}) })),
    hints: [hint, 'Rule out the answers you are sure are wrong, then compare what is left.'],
  });
}
const bank = (b) => (d, rand) => fromBank(rand, b[d - 1]);

// ---------- Geometry ----------
function similarity(d, rand) {
  const k = d === 1 ? int(rand, 2, 4) : pick(rand, [2, 3, 4, 5]);
  const a = int(rand, 2, 9); const b = int(rand, 3, 11);
  if (d === 3) {
    // Area scales by k².
    const area = int(rand, 3, 20);
    return input(`Two similar figures have a scale factor of ${k}. The smaller has an area of ${area} cm². What is the larger figure’s area, in cm²?`, area * k * k,
      ['Lengths scale by the scale factor; areas scale by its square.', `Multiply by ${k}² = ${k * k}.`], { [area * k]: 'additive-scaling' });
  }
  return input(`Triangle ABC is similar to triangle DEF. AB = ${a}, BC = ${b} and DE = ${a * k}. What is EF?`, b * k,
    ['Corresponding sides of similar triangles are in the same ratio.', `DE ÷ AB = ${a * k} ÷ ${a} = ${k}. Multiply BC by the same factor.`], { [b + a * k - a]: 'additive-scaling' });
}

function circleAngles(d, rand) {
  if (d === 1) {
    const c = 2 * int(rand, 15, 85);
    return input(`A central angle measures ${c}°. What is the measure of an inscribed angle that intercepts the same arc?`, c / 2,
      ['An inscribed angle is half the central angle on the same arc.', `${c} ÷ 2.`], { [c * 2]: 'inverse-operation' });
  }
  const deg = pick(rand, [30, 45, 60, 90, 120, 180]);
  // Radii that keep k a whole number or a half, so answers stay short and exact.
  const r = pick(rand, [2, 3, 4, 6, 8, 9, 10, 12].filter((x) => (4 * x * deg) % 360 === 0 && (2 * x * x * deg) % 360 === 0));
  if (d === 2) return input(`A circle has radius ${r} cm. An arc has a central angle of ${deg}°. Its length is kπ cm. What is k?`, (2 * r * deg) / 360,
    ['Arc length = (angle ÷ 360) × 2πr.', `(${deg}/360) × 2 × ${r}.`], { [(r * deg) / 360 === (2 * r * deg) / 360 ? -1 : (r * deg) / 360]: 'radius-diameter' });
  return input(`A circle has radius ${r} cm. A sector has a central angle of ${deg}°. Its area is kπ cm². What is k?`, (r * r * deg) / 360,
    ['Sector area = (angle ÷ 360) × πr².', `(${deg}/360) × ${r}².`], { [(2 * r * deg) / 360]: 'circle-area-circumference' });
}

// ---------- Statistics ----------
function normalDistribution(d, rand) {
  const mean = 10 * int(rand, 5, 9); const sd = pick(rand, [2, 4, 5, 10]);
  if (d === 3) {
    const x = mean + pick(rand, [-2, -1, 1, 2, 3]) * sd;
    return input(`Scores have mean ${mean} and standard deviation ${sd}. What is the z-score of ${x}?`, (x - mean) / sd,
      ['z = (value − mean) ÷ standard deviation.', `(${x} − ${mean}) ÷ ${sd}.`], {});
  }
  const k = d === 1 ? 1 : pick(rand, [1, 2, 3]);
  const pct = { 1: 68, 2: 95, 3: 99.7 }[k];
  return choice(rand, {
    prompt: `Heights are normally distributed with mean ${mean} cm and standard deviation ${sd} cm. About what percent lie between ${mean - k * sd} and ${mean + k * sd} cm?`,
    answer: `${pct}%`, wrong: [68, 95, 99.7, 50].filter((x) => x !== pct).map((x) => ({ value: `${x}%` })),
    hints: ['Use the 68–95–99.7 rule.', `How many standard deviations from the mean is each end? ${k}.`],
  });
}

// ---------- Calculus ----------
function integrals(d, rand) {
  if (d === 1) {
    const n = int(rand, 1, 5); const c = (n + 1) * int(rand, 1, 4);
    return choice(rand, {
      prompt: `Find an antiderivative of ${c}x${sup(n)}.`, answer: `${c / (n + 1)}x${sup(n + 1)} + C`,
      wrong: [{ value: `${c * n}x${sup(n - 1)} + C`, misconception: 'inverse-operation' }, { value: `${c}x${sup(n + 1)} + C` }, { value: `${c / (n + 1)}x${sup(n)} + C` }],
      hints: ['Add 1 to the power, then divide by the new power.', 'Check by differentiating your answer.'],
    });
  }
  const a = int(rand, 1, d === 2 ? 3 : 4); const n = d === 2 ? 1 : pick(rand, [1, 2]);
  const k = (n + 1) * int(rand, 1, 3);
  // ∫₀ᵃ k xⁿ dx = k aⁿ⁺¹ / (n + 1), an integer by construction.
  return input(`Evaluate the definite integral of ${k}x${sup(n)} from x = 0 to x = ${a}.`, (k * a ** (n + 1)) / (n + 1),
    [`An antiderivative is ${k / (n + 1)}x${sup(n + 1)}.`, `Evaluate at ${a} and subtract its value at 0.`], { [k * a ** n]: 'inverse-operation' });
}
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function sup(n) { return n === 1 ? '' : String(n).split('').map((c) => SUPS[c]).join(''); }

// ---------- Physics ----------
function momentum(d, rand) {
  const m = int(rand, 2, 12); const v = int(rand, 2, 15);
  if (d === 1) return input(`A ${m} kg cart moves at ${v} m/s. What is its momentum, in kg·m/s?`, m * v, ['Momentum p = mass × velocity.', `${m} × ${v}.`], { [m + v]: 'times-as-add' });
  if (d === 2) {
    const m2 = int(rand, 2, 12);
    const total = m * v;
    if (total % (m + m2)) return momentum(1, rand);
    return input(`A ${m} kg cart moving at ${v} m/s hits a ${m2} kg cart at rest, and they stick together. What is their speed afterwards, in m/s?`, total / (m + m2),
      ['Momentum before = momentum after.', `${m} × ${v} = (${m} + ${m2}) × v.`], { [v]: null });
  }
  const t = pick(rand, [2, 4, 5]); const dv = t * int(rand, 1, 5);
  return input(`A force acts on a ${m} kg object for ${t} s and changes its velocity by ${dv} m/s. What is the force, in newtons?`, (m * dv) / t,
    ['Impulse F × t equals the change in momentum m × Δv.', `F = (${m} × ${dv}) ÷ ${t}.`], { [m * dv]: 'one-step-only' });
}

const NUCLEAR = [
  [
    ['What holds the nucleus of an atom together?', 'The strong nuclear force', ['Gravity', 'Magnetism'], 'It is far stronger than electric repulsion at tiny distances.'],
    ['What is nuclear fission?', 'A heavy nucleus splitting into smaller nuclei', ['Two light nuclei joining', 'An electron leaving an atom'], 'Fission means splitting.'],
    ['What powers the sun?', 'Nuclear fusion of hydrogen into helium', ['Burning coal', 'Fission of uranium'], 'Fusion joins light nuclei.'],
  ],
  [
    ['Which particle is emitted in alpha decay?', 'A helium nucleus (2 protons, 2 neutrons)', ['An electron', 'A photon only'], 'Alpha particles are the heaviest common radiation.'],
    ['A sample has a half-life of 5 years. What fraction remains after 10 years?', '1/4', ['1/2', '0'], 'Two half-lives have passed.'],
    ['Why do nuclear reactions release so much energy?', 'A small amount of mass is converted to energy (E = mc²).', ['Atoms burn very hot.', 'Electrons are destroyed.'], 'Compare the mass before and after.'],
  ],
  [
    ['In beta-minus decay, what happens to the atomic number?', 'It increases by 1', ['It decreases by 2', 'It stays the same'], 'A neutron becomes a proton.'],
    ['Carbon-14 has a half-life of about 5,730 years. Why is it useful?', 'Dating once-living material up to about 50,000 years old', ['Dating rocks billions of years old', 'Measuring temperature'], 'Living things take in carbon.'],
    ['Why is fusion hard to achieve on Earth?', 'Nuclei must be extremely hot and dense to overcome electric repulsion.', ['Hydrogen is rare.', 'Fusion releases no energy.'], 'Both nuclei are positively charged.'],
  ],
];

// ---------- English 9-12 ----------
const EVIDENCE_HS = [
  [
    ['A writer claims school uniforms reduce bullying. Which evidence best supports the claim?', 'A study of 40 schools found bullying reports fell 20% after uniforms were introduced.', ['Uniforms come in many colors.', 'Some students like uniforms.'], 'Evidence should measure the claim directly.'],
    ['What is the central idea of a passage that describes how bees pollinate crops worth billions of dollars?', 'Bees are economically vital to agriculture.', ['Bees can sting.', 'Crops grow in fields.'], 'What point do all the details serve?'],
    ['Which sentence is an inference rather than a stated fact?', 'The author seems to distrust the new policy.', ['The policy began in 2024.', 'The article is 800 words long.'], 'An inference goes beyond what is directly stated.'],
  ],
  [
    ['An argument says, “Everyone agrees this is the best solution.” What is the flaw?', 'A bandwagon appeal with no evidence', ['It cites too much data', 'It is too short'], 'Popularity is not proof.'],
    ['Which best explains how an author develops a central idea over a text?', 'Introducing it, then refining it with examples and counterpoints', ['Repeating the title', 'Listing unrelated facts'], 'Ideas build and change across a text.'],
    ['A source is cited as “a study” with no author, date or publisher. What should a reader conclude?', 'The evidence cannot be checked, so it is weak.', ['It must be accurate.', 'It is a primary source.'], 'Can you verify it?'],
  ],
  [
    ['Two texts on the same event reach different conclusions. What is the strongest analysis?', 'Compare their evidence, assumptions and purposes to judge which is better supported.', ['Choose the longer text.', 'Assume both are wrong.'], 'Evaluate reasoning, not length.'],
    ['An essay argues a policy failed because crime rose after it began. What is the weakness?', 'Correlation is treated as causation; other causes are ignored.', ['It uses statistics.', 'It is too formal.'], 'Did something else change at the same time?'],
    ['Which revision makes a claim more precise and defensible?', 'Later start times would likely improve attendance for most high-school students.', ['Later start times would fix everything.', 'School is bad.'], 'Qualifiers make claims more accurate.'],
  ],
];

const ROOTS = [
  [
    ['The root “bio” means…', 'life', ['water', 'earth'], 'Think of biology.'],
    ['The prefix “tele-” means…', 'far', ['small', 'under'], 'Think of telephone and telescope.'],
    ['The root “graph” means…', 'write', ['see', 'carry'], 'Think of autograph.'],
  ],
  [
    ['Using roots, what does “chronology” mean?', 'The study or ordering of time', ['Fear of time', 'A type of clock'], '“Chron” = time; “-ology” = study of.'],
    ['What does “benevolent” most likely mean?', 'Kind and wishing good', ['Angry', 'Very fast'], '“Bene” means good.'],
    ['What does “incredulous” most likely mean?', 'Unwilling to believe', ['Easy to fool', 'Very famous'], '“In-” = not; “cred” = believe.'],
  ],
  [
    ['What does “circumspect” most likely mean?', 'Careful, considering all circumstances', ['Round in shape', 'Careless'], '“Circum” = around; “spect” = look.'],
    ['Which word means “a speech given by one person”?', 'monologue', ['dialogue', 'prologue'], '“Mono” = one.'],
    ['What does “magnanimous” most likely mean?', 'Generous and forgiving', ['Huge in size', 'Small-minded'], '“Magna” = great; “anim” = spirit.'],
  ],
];

const CITATION = [
  [
    ['Why do writers cite sources?', 'To credit others’ ideas and let readers check them', ['To make essays longer', 'Because quotes are decorative'], 'Using ideas without credit is plagiarism.'],
    ['Which needs a citation?', 'A statistic you found in an article', ['Your own opinion', 'Common knowledge such as “water is wet”'], 'If you learned it from a source, cite it.'],
    ['What is a direct quotation?', 'An author’s exact words in quotation marks', ['A summary in your words', 'Your own idea'], 'Exact words need quotation marks.'],
  ],
  [
    ['What is the best way to integrate a quotation?', 'Introduce it, quote it, then explain its significance.', ['Drop it in alone', 'Use only quotations'], 'A quotation needs context and analysis.'],
    ['Where does a full list of sources go in an MLA paper?', 'A Works Cited page at the end', ['The title page', 'Inside every sentence'], 'MLA calls it Works Cited.'],
    ['Which is plagiarism?', 'Paraphrasing a source closely without citing it', ['Quoting and citing a source', 'Stating your own conclusion'], 'Paraphrases still need credit.'],
  ],
  [
    ['A website has no author but is published by a university research center and updated last month. How credible is it likely to be?', 'Fairly credible: check its evidence and the center’s expertise', ['Not credible at all because it lacks an author', 'Perfectly credible without checking'], 'Weigh publisher, currency and evidence together.'],
    ['How should you handle a source that contradicts your thesis?', 'Acknowledge it and respond with evidence', ['Leave it out', 'Change the quotation'], 'Addressing counterevidence strengthens an argument.'],
    ['In APA style, what follows the author’s name in an in-text citation?', 'The year of publication', ['The page title', 'The URL'], 'APA emphasizes when research was published.'],
  ],
];

// ---------- Computer science 11-12 ----------
function complexity(d, rand) {
  const n = pick(rand, [10, 20, 50, 100]);
  if (d === 1) return input(`A loop runs once for each of ${n} items and does one comparison each time. How many comparisons?`, n, ['One comparison per item.', `There are ${n} items.`], {});
  if (d === 2) return input(`A loop inside another loop: both run over the same ${n} items, one comparison per inner step. How many comparisons?`, n * n, ['The inner loop runs fully for every outer step.', `${n} × ${n}.`], { [2 * n]: 'times-as-add' });
  return fromBank(rand, [
    ['Which grows fastest as n gets large?', 'O(n²)', ['O(n)', 'O(log n)'], 'Compare n = 1,000: which is biggest?'],
    ['Binary search on a sorted list is…', 'O(log n)', ['O(n²)', 'O(n)'], 'Each step halves the list.'],
    ['Checking every pair of n items is…', 'O(n²)', ['O(n)', 'O(1)'], 'There are about n × n pairs.'],
    ['Looking up one item in an array by index is…', 'O(1)', ['O(n)', 'O(n²)'], 'It takes the same time however long the array is.'],
  ]);
}

const DATA_STRUCTURES = [
  [
    ['Which structure is “last in, first out”?', 'A stack', ['A queue', 'A list sorted by name'], 'Think of plates piled up: which one do you take first?'],
    ['Which structure is “first in, first out”?', 'A queue', ['A stack', 'A tree'], 'Think of a line at a store.'],
    ['What does an array store?', 'An ordered collection of items accessed by index', ['Only one number', 'A web page'], 'Items are numbered from 0.'],
  ],
  [
    ['Push 3, push 7, pop, push 5. What is on top of the stack?', '5', ['7', '3'], 'Pop removes the most recent item.'],
    ['Enqueue A, enqueue B, dequeue, enqueue C. Who is at the front?', 'B', ['A', 'C'], 'Dequeue removes the oldest item.'],
    ['Which structure best stores pairs like “word → definition”?', 'A dictionary (hash map)', ['A stack', 'A queue'], 'You look things up by a key.'],
  ],
  [
    ['Why can looking up a key in a hash map be faster than searching a list?', 'The key is turned into a position directly instead of checking each item.', ['Hash maps are always sorted.', 'Lists cannot hold strings.'], 'Think of jumping straight to a locker number.'],
    ['Which structure fits a family tree or file folders?', 'A tree', ['A queue', 'A stack'], 'Each item can have children.'],
    ['A browser’s back button returns to the most recent page. Which structure fits?', 'A stack', ['A queue', 'A hash map'], 'The last page visited comes back first.'],
  ],
];

export const CORE_HS_GENERATORS = {
  'similarity': similarity,
  'circle-geometry': circleAngles,
  'normal-distribution': normalDistribution,
  'integrals': integrals,
  'momentum': momentum,
  'nuclear-processes': bank(NUCLEAR),
  'evidence-analysis': bank(EVIDENCE_HS),
  'word-roots': bank(ROOTS),
  'citation-research': bank(CITATION),
  'algorithm-efficiency': complexity,
  'data-structures': bank(DATA_STRUCTURES),
};

export const CORE_HS_BANKS = { NUCLEAR, EVIDENCE_HS, ROOTS, CITATION, DATA_STRUCTURES };
