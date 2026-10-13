// United States catalogue: how Red Teddy's objectives sit in American schooling.
//
// Four things are kept apart, and must stay apart:
//   1. Official standards (FRAMEWORKS): published by their owners. We store only the
//      code, the framework and a link to the source. We never invent a code.
//   2. Our organisation (COURSES, grades): Red Teddy's own grouping, not an official one.
//   3. Teaching material (lessons.js, generators): our own original work.
//   4. State variations: not modelled yet. Common Core, NGSS and other frameworks are
//      adopted differently by each state, and no state alignment is claimed.
//
// `fit` is how closely an objective addresses a standard:
//   'aligned' - practice targets the core of the standard.
//   'partial' - practice covers part of what the standard asks (often the standard
//               also expects explaining, modelling or wider contexts we do not test).
// An objective with no `standards` has no official mapping. That is shown, not hidden.
export const FRAMEWORKS = {
  'CCSS-M': { name: 'Common Core State Standards for Mathematics', owner: 'NGA Center and CCSSO', version: '2010', url: 'https://www.thecorestandards.org/Math/' },
  'CCSS-ELA': { name: 'Common Core State Standards for English Language Arts & Literacy', owner: 'NGA Center and CCSSO', version: '2010', url: 'https://www.thecorestandards.org/ELA-Literacy/' },
  'NGSS': { name: 'Next Generation Science Standards', owner: 'Achieve and NGSS Lead States', version: '2013', url: 'https://www.nextgenscience.org/' },
};

// Courses are Red Teddy's organisation. `status` says what exists today:
//   'active'  - has objectives with practice; 'planned' - catalogued, no content yet.
export const COURSES = [
  // Elementary
  { id: 'math-k', title: 'Kindergarten Math', subject: 'maths', grades: ['PK', 'K'] },
  { id: 'math-1', title: 'Grade 1 Math', subject: 'maths', grades: ['1'] },
  { id: 'math-2', title: 'Grade 2 Math', subject: 'maths', grades: ['2'] },
  { id: 'math-3', title: 'Grade 3 Math', subject: 'maths', grades: ['3'] },
  { id: 'math-4', title: 'Grade 4 Math', subject: 'maths', grades: ['4'] },
  { id: 'math-5', title: 'Grade 5 Math', subject: 'maths', grades: ['5'] },
  { id: 'ela-k', title: 'Kindergarten Reading', subject: 'literacy', grades: ['PK', 'K'] },
  { id: 'ela-1-2', title: 'Grades 1–2 English Language Arts', subject: 'literacy', grades: ['1', '2'] },
  { id: 'ela-3-5', title: 'Grades 3–5 English Language Arts', subject: 'literacy', grades: ['3', '4', '5'] },
  { id: 'science-elem', title: 'Elementary Science', subject: 'science', grades: ['2', '3', '4', '5'] },
  { id: 'social-elem', title: 'Elementary Social Studies', subject: 'social', grades: ['3', '4', '5'] },
  { id: 'thinking-early', title: 'Thinking Skills', subject: 'thinking', grades: ['PK', 'K', '1', '2', '3', '4', '5'] },
  // Middle school
  { id: 'math-6', title: 'Grade 6 Math', subject: 'maths', grades: ['6'] },
  { id: 'math-7', title: 'Grade 7 Math', subject: 'maths', grades: ['7'] },
  { id: 'math-8', title: 'Grade 8 Math', subject: 'maths', grades: ['8'] },
  { id: 'ela-6-8', title: 'Middle School English', subject: 'literacy', grades: ['6', '7', '8'] },
  { id: 'life-science-ms', title: 'Life Science', subject: 'science', grades: ['6', '7', '8'] },
  { id: 'physical-science-ms', title: 'Physical Science', subject: 'science', grades: ['6', '7', '8'] },
  { id: 'earth-science-ms', title: 'Earth & Space Science', subject: 'science', grades: ['6', '7', '8'] },
  { id: 'civics-ms', title: 'Civics, US History & Economics', subject: 'social', grades: ['6', '7', '8'] },
  { id: 'cs-ms', title: 'Introduction to Programming', subject: 'computing', grades: ['6', '7', '8'] },
  // High school
  { id: 'algebra-1', title: 'Algebra I', subject: 'maths', grades: ['9'] },
  { id: 'geometry', title: 'Geometry', subject: 'maths', grades: ['10'] },
  { id: 'algebra-2', title: 'Algebra II', subject: 'maths', grades: ['11'] },
  { id: 'precalculus', title: 'Precalculus', subject: 'maths', grades: ['11', '12'], status: 'planned' },
  { id: 'calculus', title: 'Calculus', subject: 'maths', grades: ['12'] },
  { id: 'statistics-hs', title: 'Statistics', subject: 'maths', grades: ['11', '12'], status: 'planned' },
  { id: 'english-9-10', title: 'English 9–10', subject: 'literacy', grades: ['9', '10'] },
  { id: 'english-11-12', title: 'English 11–12', subject: 'literacy', grades: ['11', '12'] },
  { id: 'biology', title: 'Biology', subject: 'science', grades: ['9', '10'] },
  { id: 'chemistry', title: 'Chemistry', subject: 'science', grades: ['10', '11'] },
  { id: 'physics', title: 'Physics', subject: 'science', grades: ['11', '12'] },
  { id: 'us-government', title: 'US Government', subject: 'social', grades: ['12'] },
  { id: 'us-history-hs', title: 'US History', subject: 'social', grades: ['11'], status: 'planned' },
  { id: 'world-history', title: 'World History', subject: 'social', grades: ['9', '10'], status: 'planned' },
  { id: 'economics', title: 'Economics & Personal Finance', subject: 'social', grades: ['11', '12'] },
  { id: 'cs-hs', title: 'Computer Science', subject: 'computing', grades: ['9', '10', '11', '12'] },
  // Catalogued electives with no content yet
  { id: 'world-languages', title: 'World Languages (Spanish)', subject: 'electives', grades: ['6', '7', '8', '9', '10', '11', '12'], status: 'planned' },
  { id: 'art', title: 'Art & Design', subject: 'electives', grades: ['K', '1', '2', '3', '4', '5', '6', '7', '8'], status: 'planned' },
  { id: 'music', title: 'Music', subject: 'electives', grades: ['K', '1', '2', '3', '4', '5', '6', '7', '8'], status: 'planned' },
  { id: 'health', title: 'Health & Wellbeing', subject: 'electives', grades: ['3', '4', '5', '6', '7', '8'], status: 'planned' },
  { id: 'study-skills', title: 'Study Skills', subject: 'electives', grades: ['6', '7', '8', '9', '10', '11', '12'], status: 'planned' },
];

export const SUBJECT_NAMES = {
  maths: 'Math', literacy: 'English Language Arts', science: 'Science', social: 'Social Studies',
  computing: 'Computer Science', thinking: 'Thinking Skills', electives: 'Electives',
};

const S = (framework, code, fit = 'aligned') => ({ framework, code, fit });

// Objective -> US placement. grades: usual grades; course: Red Teddy course id;
// also: other courses that list it (a skill taught across a grade boundary).
export const PLACEMENT = {
  'count-to-5': { grades: ['PK', 'K'], course: 'math-k', standards: [S('CCSS-M', 'K.CC.B.4', 'partial')] },
  'count-to-10': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.CC.B.5')] },
  'number-names': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.CC.A.3')] },
  'subitise': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.CC.B.5', 'partial')] },
  'compare-numbers': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.CC.C.6'), S('CCSS-M', 'K.CC.C.7')] },
  'bonds-to-10': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.OA.A.4')] },
  'shapes': { grades: ['PK', 'K'], course: 'math-k', standards: [S('CCSS-M', 'K.G.A.2')] },
  'shape-words': { grades: ['K'], course: 'math-k', standards: [S('CCSS-M', 'K.G.A.2', 'partial')] },
  'place-value-100': { grades: ['1'], course: 'math-1', standards: [S('CCSS-M', '1.NBT.B.2')] },
  'add-within-20': { grades: ['1'], course: 'math-1', standards: [S('CCSS-M', '1.OA.C.6')] },
  'subtract-within-20': { grades: ['1'], course: 'math-1', standards: [S('CCSS-M', '1.OA.C.6')] },
  'number-line-20': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.MD.B.6', 'partial')] },
  'place-value-1000': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.NBT.A.1')] },
  'add-2digit': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.NBT.B.5')] },
  'subtract-2digit': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.NBT.B.5')] },
  'measure-length': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.MD.A.1')] },
  'tell-time': { grades: ['2'], course: 'math-2', standards: [S('CCSS-M', '2.MD.C.7')] },
  'times-2-5-10': { grades: ['3'], course: 'math-3', standards: [S('CCSS-M', '3.OA.A.1', 'partial')] },
  'times-tables': { grades: ['3'], course: 'math-3', standards: [S('CCSS-M', '3.OA.C.7')] },
  'division-facts': { grades: ['3'], course: 'math-3', standards: [S('CCSS-M', '3.OA.C.7')] },
  'unit-fractions': { grades: ['3'], course: 'math-3', standards: [S('CCSS-M', '3.NF.A.1')] },
  'bar-charts': { grades: ['3'], course: 'math-3', standards: [S('CCSS-M', '3.MD.B.3')] },
  'word-problems': { grades: ['2', '3'], course: 'math-3', also: ['math-2'], standards: [S('CCSS-M', '2.OA.A.1'), S('CCSS-M', '3.OA.D.8', 'partial')] },
  'area-perimeter': { grades: ['3', '4'], course: 'math-4', also: ['math-3'], standards: [S('CCSS-M', '3.MD.C.7', 'partial'), S('CCSS-M', '3.MD.D.8', 'partial'), S('CCSS-M', '4.MD.A.3')] },
  'fractions-compare': { grades: ['3', '4'], course: 'math-4', also: ['math-3'], standards: [S('CCSS-M', '3.NF.A.2', 'partial'), S('CCSS-M', '3.NF.A.3.D'), S('CCSS-M', '4.NF.A.2', 'partial')] },
  'number-patterns': { grades: ['4'], course: 'math-4', standards: [S('CCSS-M', '4.OA.C.5', 'partial')] },
  'decimals': { grades: ['4', '5'], course: 'math-5', also: ['math-4'], standards: [S('CCSS-M', '4.NF.C.6'), S('CCSS-M', '4.NF.C.7')] },
  'ratios-rates': { grades: ['6'], course: 'math-6', standards: [S('CCSS-M', '6.RP.A.3.B')] },
  'mean-median': { grades: ['6'], course: 'math-6', standards: [S('CCSS-M', '6.SP.B.5.C', 'partial')] },
  'percent': { grades: ['6', '7'], course: 'math-6', also: ['math-7'], standards: [S('CCSS-M', '6.RP.A.3.C'), S('CCSS-M', '7.RP.A.3', 'partial')] },
  'integers': { grades: ['7'], course: 'math-7', standards: [S('CCSS-M', '7.NS.A.1', 'partial'), S('CCSS-M', '7.NS.A.2', 'partial')] },
  'probability': { grades: ['7'], course: 'math-7', standards: [S('CCSS-M', '7.SP.C.7.A', 'partial')] },
  'equations-two-step': { grades: ['7'], course: 'math-7', standards: [S('CCSS-M', '7.EE.B.4.A', 'partial')] },
  'exponents': { grades: ['8'], course: 'math-8', standards: [S('CCSS-M', '8.EE.A.1', 'partial')] },
  'pythagorean': { grades: ['8'], course: 'math-8', standards: [S('CCSS-M', '8.G.B.7')] },
  'slope': { grades: ['8'], course: 'math-8', standards: [S('CCSS-M', '8.F.B.4', 'partial')] },
  'multi-step-equations': { grades: ['9'], course: 'algebra-1', standards: [S('CCSS-M', 'HSA-REI.B.3')] },
  'function-notation': { grades: ['9'], course: 'algebra-1', standards: [S('CCSS-M', 'HSF-IF.A.2')] },
  'systems': { grades: ['9'], course: 'algebra-1', standards: [S('CCSS-M', 'HSA-REI.C.6')] },
  'quadratics': { grades: ['9', '10'], course: 'algebra-1', also: ['geometry'], standards: [S('CCSS-M', 'HSA-REI.B.4.B', 'partial')] },
  'trig-ratios': { grades: ['10'], course: 'geometry', standards: [S('CCSS-M', 'HSG-SRT.C.6', 'partial'), S('CCSS-M', 'HSG-SRT.C.8', 'partial')] },
  'logarithms': { grades: ['11'], course: 'algebra-2', standards: [S('CCSS-M', 'HSF-LE.A.4', 'partial')] },
  'derivatives': { grades: ['12'], course: 'calculus', standards: [], note: 'Calculus is beyond the Common Core; covered as in typical AP-style courses.' },

  'letters': { grades: ['PK', 'K'], course: 'ela-k', standards: [S('CCSS-ELA', 'RF.K.1.D')] },
  'letter-sounds': { grades: ['K'], course: 'ela-k', standards: [S('CCSS-ELA', 'RF.K.3.A')] },
  'rhyme': { grades: ['K'], course: 'ela-k', standards: [S('CCSS-ELA', 'RF.K.2.A')] },
  'build-words': { grades: ['1'], course: 'ela-1-2', standards: [S('CCSS-ELA', 'RF.1.2.B', 'partial')] },
  'build-sentences': { grades: ['1', '2'], course: 'ela-1-2', standards: [S('CCSS-ELA', 'L.1.1.J', 'partial')] },
  'spelling': { grades: ['2', '3'], course: 'ela-1-2', also: ['ela-3-5'], standards: [S('CCSS-ELA', 'L.3.2.E', 'partial')] },
  'word-parts': { grades: ['3'], course: 'ela-3-5', standards: [S('CCSS-ELA', 'L.3.4.B')] },
  'comprehension': { grades: ['3', '4'], course: 'ela-3-5', standards: [S('CCSS-ELA', 'RI.3.1', 'partial'), S('CCSS-ELA', 'RL.4.1', 'partial')] },
  'vocabulary': { grades: ['4'], course: 'ela-3-5', standards: [S('CCSS-ELA', 'L.4.5.C')] },
  'grammar-usage': { grades: ['3', '4'], course: 'ela-3-5', standards: [S('CCSS-ELA', 'L.3.1.F', 'partial'), S('CCSS-ELA', 'L.4.1.G')] },
  'figurative-language': { grades: ['5', '7'], course: 'ela-3-5', also: ['ela-6-8'], standards: [S('CCSS-ELA', 'L.5.5.A'), S('CCSS-ELA', 'L.7.5.A', 'partial')] },
  'context-clues': { grades: ['6'], course: 'ela-6-8', standards: [S('CCSS-ELA', 'L.6.4.A')] },
  'argument-evidence': { grades: ['6', '8', '9'], course: 'ela-6-8', also: ['english-9-10'], standards: [S('CCSS-ELA', 'RI.6.8', 'partial')] },
  'literary-analysis': { grades: ['9', '10'], course: 'english-9-10', standards: [S('CCSS-ELA', 'RL.9-10.2', 'partial')] },

  'states-of-matter': { grades: ['2'], course: 'science-elem', standards: [S('NGSS', '2-PS1-1', 'partial')] },
  'food-chains': { grades: ['5'], course: 'science-elem', standards: [S('NGSS', '5-LS2-1', 'partial')] },
  'cells': { grades: ['6', '7'], course: 'life-science-ms', standards: [S('NGSS', 'MS-LS1-2', 'partial')] },
  'photosynthesis': { grades: ['7'], course: 'life-science-ms', standards: [S('NGSS', 'MS-LS1-6', 'partial')] },
  'earth-moon-sun': { grades: ['6', '8'], course: 'earth-science-ms', standards: [S('NGSS', 'MS-ESS1-1', 'partial')] },
  'density': { grades: ['6', '8'], course: 'physical-science-ms', standards: [] },
  'forces-motion': { grades: ['11'], course: 'physics', standards: [S('NGSS', 'HS-PS2-1', 'partial')] },
  'conservation-of-mass': { grades: ['10'], course: 'chemistry', standards: [S('NGSS', 'HS-PS1-7', 'partial')] },
  'genetics': { grades: ['9', '10'], course: 'biology', standards: [S('NGSS', 'HS-LS3-3', 'partial')] },

  'states-capitals': { grades: ['4'], course: 'social-elem', standards: [], note: 'Social studies standards are set by each state; no code is mapped.' },
  'branches-of-government': { grades: ['5', '8'], course: 'civics-ms', also: ['social-elem'], standards: [], note: 'Social studies standards are set by each state; no code is mapped.' },
  'us-history-timeline': { grades: ['5', '8'], course: 'civics-ms', also: ['social-elem'], standards: [], note: 'Social studies standards are set by each state; no code is mapped.' },
  'bill-of-rights': { grades: ['8', '12'], course: 'us-government', also: ['civics-ms'], standards: [], note: 'Social studies standards are set by each state; no code is mapped.' },
  'supply-demand': { grades: ['8', '12'], course: 'economics', also: ['civics-ms'], standards: [], note: 'Economics standards are set by each state; no code is mapped.' },
  'simple-interest': { grades: ['11', '12'], course: 'economics', standards: [], note: 'Personal finance requirements vary by state; no code is mapped.' },
  'code-tracing': { grades: ['7', '10'], course: 'cs-ms', also: ['cs-hs'], standards: [], note: 'Computer science standards are not mapped yet.' },

  'colours': { grades: ['PK'], course: 'thinking-early', standards: [] },
  'sorting': { grades: ['PK', 'K'], course: 'thinking-early', standards: [S('CCSS-M', 'K.MD.B.3', 'partial')] },
  'observation': { grades: ['PK', 'K'], course: 'thinking-early', standards: [] },
  'patterns': { grades: ['PK', 'K'], course: 'thinking-early', standards: [] },
  'sequencing': { grades: ['K'], course: 'thinking-early', standards: [] },
  'memory': { grades: ['PK'], course: 'thinking-early', standards: [] },
  'logic-puzzles': { grades: ['3', '4', '5'], course: 'thinking-early', standards: [] },
};

export const US_CATALOGUE = { country: 'US', label: 'United States', frameworks: FRAMEWORKS, courses: COURSES, placement: PLACEMENT, subjectNames: SUBJECT_NAMES };
