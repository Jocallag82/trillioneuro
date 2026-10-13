// The standards denominator: every official standard Red Teddy measures itself against.
//
// Coverage is reported as "of these N standards, how many are mapped, taught, assessed
// and reviewed". The list is the published code structure of each framework at
// standard level (sub-parts such as 3.NF.A.3.D roll up to 3.NF.A.3). Only codes are
// stored; standard text stays with its owner (see SOURCES for links and licences).
//
// Scope of the denominator (October 2026):
//   CCSS-M   Kindergarten to Grade 8             229 standards
//   CCSS-ELA Kindergarten to Grade 8 (RL, RI, RF, W, SL, L)   373 standards
//   NGSS     Kindergarten to High School (performance expectations)   208
// Not yet in the denominator (and so never counted as covered): CCSS-M high school,
// CCSS-ELA grades 9-12, CSTA computer science, C3 social studies, state frameworks.
//
// `verified` records how the code list was obtained. The list was compiled from the
// published structure of each framework; it has not been machine-checked against the
// owner's files in this environment (the source sites were unreachable from the
// build). tests/standards check counts against the published totals (229 / 373 / 208).

export const SOURCES = {
  'CCSS-M': {
    name: 'Common Core State Standards for Mathematics', owner: 'NGA Center and CCSSO', version: '2010 (unchanged since publication)',
    url: 'https://www.thecorestandards.org/Math/', pdf: 'https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf',
    grades: 'K-8 in denominator (HS mapped but outside denominator)', licence: 'Public licence: free use with attribution "© Copyright 2010. National Governors Association Center for Best Practices and Council of Chief State School Officers. All rights reserved."',
    publishedTotal: 229, verified: 'structure-compiled',
  },
  'CCSS-ELA': {
    name: 'Common Core State Standards for English Language Arts & Literacy', owner: 'NGA Center and CCSSO', version: '2010',
    url: 'https://www.thecorestandards.org/ELA-Literacy/', pdf: 'https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-ELA-Standards.pdf',
    grades: 'K-8 in denominator', licence: 'Same public licence as CCSS-M.', publishedTotal: 373, verified: 'structure-compiled',
  },
  'NGSS': {
    name: 'Next Generation Science Standards', owner: 'Achieve, Inc. on behalf of the NGSS Lead States', version: '2013',
    url: 'https://www.nextgenscience.org/search-standards', grades: 'K-12 (performance expectations)',
    licence: 'NGSS is a registered trademark of Achieve; codes referenced, text not reproduced.', publishedTotal: 208, verified: 'structure-compiled',
  },
};

// Frameworks referenced for orientation only, with no codes counted (yet).
export const REFERENCE_FRAMEWORKS = {
  'CSTA': { name: 'CSTA K-12 Computer Science Standards', owner: 'Computer Science Teachers Association', version: '2017', url: 'https://csteachers.org/k12standards/', status: 'not-mapped' },
  'C3': { name: 'College, Career, and Civic Life (C3) Framework for Social Studies State Standards', owner: 'National Council for the Social Studies', version: '2013', url: 'https://www.socialstudies.org/standards/c3', status: 'not-mapped' },
  'NHES': { name: 'National Health Education Standards', owner: 'SHAPE America', version: '2024', url: 'https://www.shapeamerica.org/standards/health/', status: 'not-mapped' },
  'NCAS': { name: 'National Core Arts Standards', owner: 'National Coalition for Core Arts Standards', version: '2014', url: 'https://www.nationalartsstandards.org/', status: 'not-mapped' },
  'ACTFL': { name: 'World-Readiness Standards for Learning Languages', owner: 'ACTFL', version: '2015', url: 'https://www.actfl.org/educator-resources/world-readiness-standards-for-learning-languages', status: 'not-mapped' },
  'JUMPSTART': { name: 'National Standards for Personal Financial Education', owner: 'Jump$tart Coalition and CEE', version: '2021', url: 'https://www.jumpstart.org/what-we-do/support-financial-education/standards/', status: 'not-mapped' },
};

// ---- Builders -----------------------------------------------------------------
const list = [];
const add = (framework, grade, domain, code) => list.push({ framework, grade, domain, code });

// CCSS-M: grade -> domain -> [cluster, count] (standards numbered on across clusters).
const MATH = {
  K: { CC: [['A', 3], ['B', 2], ['C', 2]], OA: [['A', 5]], NBT: [['A', 1]], MD: [['A', 2], ['B', 1]], G: [['A', 3], ['B', 3]] },
  1: { OA: [['A', 2], ['B', 2], ['C', 2], ['D', 2]], NBT: [['A', 1], ['B', 2], ['C', 3]], MD: [['A', 2], ['B', 1], ['C', 1]], G: [['A', 3]] },
  2: { OA: [['A', 1], ['B', 1], ['C', 2]], NBT: [['A', 4], ['B', 5]], MD: [['A', 4], ['B', 2], ['C', 2], ['D', 2]], G: [['A', 3]] },
  3: { OA: [['A', 4], ['B', 2], ['C', 1], ['D', 2]], NBT: [['A', 3]], NF: [['A', 3]], MD: [['A', 2], ['B', 2], ['C', 3], ['D', 1]], G: [['A', 2]] },
  4: { OA: [['A', 3], ['B', 1], ['C', 1]], NBT: [['A', 3], ['B', 3]], NF: [['A', 2], ['B', 2], ['C', 3]], MD: [['A', 3], ['B', 1], ['C', 3]], G: [['A', 3]] },
  5: { OA: [['A', 2], ['B', 1]], NBT: [['A', 4], ['B', 3]], NF: [['A', 2], ['B', 5]], MD: [['A', 1], ['B', 1], ['C', 3]], G: [['A', 2], ['B', 2]] },
  6: { RP: [['A', 3]], NS: [['A', 1], ['B', 3], ['C', 4]], EE: [['A', 4], ['B', 4], ['C', 1]], G: [['A', 4]], SP: [['A', 3], ['B', 2]] },
  7: { RP: [['A', 3]], NS: [['A', 3]], EE: [['A', 2], ['B', 2]], G: [['A', 3], ['B', 3]], SP: [['A', 2], ['B', 2], ['C', 4]] },
  8: { NS: [['A', 2]], EE: [['A', 4], ['B', 2], ['C', 2]], F: [['A', 3], ['B', 2]], G: [['A', 5], ['B', 3], ['C', 1]], SP: [['A', 4]] },
};
for (const [g, domains] of Object.entries(MATH)) {
  for (const [dom, clusters] of Object.entries(domains)) {
    let n = 0;
    for (const [cl, count] of clusters) for (let i = 0; i < count; i++) add('CCSS-M', g, dom, `${g}.${dom}.${cl}.${++n}`);
  }
}

// CCSS-ELA K-8: strand -> grade -> standard numbers.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ELA_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
const ELA = {
  RL: () => [...range(1, 7), 9, 10],
  RI: () => range(1, 10),
  W: (g) => (['K', '1', '2'].includes(g) ? [1, 2, 3, 5, 6, 7, 8] : g === '3' ? [...range(1, 8), 10] : range(1, 10)),
  SL: () => range(1, 6),
  L: (g) => (['K', '1'].includes(g) ? [1, 2, 4, 5, 6] : range(1, 6)),
  RF: (g) => (['K', '1'].includes(g) ? range(1, 4) : ['2', '3', '4', '5'].includes(g) ? [3, 4] : []),
};
for (const [strand, nums] of Object.entries(ELA)) {
  for (const g of ELA_GRADES) for (const n of nums(g)) add('CCSS-ELA', g, strand, `${strand}.${g}.${n}`);
}

// NGSS performance expectations: band -> [discipline-core-idea, count].
const NGSS = {
  K: [['PS2', 2], ['PS3', 2], ['LS1', 1], ['ESS2', 2], ['ESS3', 3]],
  1: [['PS4', 4], ['LS1', 2], ['LS3', 1], ['ESS1', 2]],
  2: [['PS1', 4], ['LS2', 2], ['LS4', 1], ['ESS1', 1], ['ESS2', 3]],
  'K-2': [['ETS1', 3]],
  3: [['PS2', 4], ['LS1', 1], ['LS2', 1], ['LS3', 2], ['LS4', 4], ['ESS2', 2], ['ESS3', 1]],
  4: [['PS3', 4], ['PS4', 3], ['LS1', 2], ['ESS1', 1], ['ESS2', 2], ['ESS3', 2]],
  5: [['PS1', 4], ['PS2', 1], ['PS3', 1], ['LS1', 1], ['LS2', 1], ['ESS1', 2], ['ESS2', 2], ['ESS3', 1]],
  '3-5': [['ETS1', 3]],
  MS: [['PS1', 6], ['PS2', 5], ['PS3', 5], ['PS4', 3], ['LS1', 8], ['LS2', 5], ['LS3', 2], ['LS4', 6], ['ESS1', 4], ['ESS2', 6], ['ESS3', 5], ['ETS1', 4]],
  HS: [['PS1', 8], ['PS2', 6], ['PS3', 5], ['PS4', 5], ['LS1', 7], ['LS2', 8], ['LS3', 3], ['LS4', 6], ['ESS1', 6], ['ESS2', 7], ['ESS3', 6], ['ETS1', 4]],
};
for (const [band, ideas] of Object.entries(NGSS)) {
  for (const [dci, count] of ideas) for (let i = 1; i <= count; i++) add('NGSS', band, dci, `${band}-${dci}-${i}`);
}

export const STANDARDS = list;
export const STANDARD_INDEX = new Map(list.map((s) => [`${s.framework}:${s.code}`, s]));

// Rolls a mapped code up to the standard it belongs to: '3.NF.A.3.D' -> '3.NF.A.3',
// 'RF.K.1.D' -> 'RF.K.1'. High-school codes (HSA-…) are returned unchanged.
export function standardOf(framework, code) {
  if (framework === 'CCSS-M' && /^[K1-8]\./.test(code)) return code.split('.').slice(0, 4).join('.');
  if (framework === 'CCSS-ELA' && /^[A-Z]+\.[K1-8]\./.test(code)) return code.split('.').slice(0, 3).join('.');
  return code;
}

// Grade-band label used by the dashboard.
export const gradeOfStandard = (s) => s.grade;
