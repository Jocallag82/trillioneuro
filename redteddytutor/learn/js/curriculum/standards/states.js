// State layer: how each state's own standards relate to the national baseline.
//
// The national baseline (CCSS-M, CCSS-ELA, NGSS) is NEVER treated as a state's
// curriculum. A state entry records, per subject, what the state adopted and where
// to verify it; a skill counts as "state-verified" only when a person has checked it
// against that state's own document and recorded it in `verifiedMappings`. None has
// been verified yet, so every state reports 0 verified skills.
//
// basis:
//   'CCSS' / 'NGSS'               adopted largely as published (state may add to it)
//   'CCSS-derived' / 'NGSS-derived'  state revision based on the national framework;
//                                  codes and expectations differ, so a national
//                                  mapping is a starting point, not an alignment
//   'state'                       the state's own framework; national mappings do
//                                  not transfer
//   null                          not researched yet
//
// `source` is the state education agency's site; `asOf` is when this entry was
// recorded from public information. `verified: false` means the entry itself has not
// been checked against the agency's current document in this build.

const ENTRY = (name, math, ela, science, extra = {}) => ({ name, subjects: { math, ela, science }, verifiedMappings: {}, ...extra });
const F = (basis, framework, note = null) => ({ basis, framework, note });

export const STATES = {
  CA: ENTRY('California',
    F('CCSS', 'California Common Core State Standards: Mathematics', 'Adopted 2010 with California additions; course sequence differs in high school.'),
    F('CCSS', 'California Common Core State Standards: ELA/Literacy', 'Adopted 2010 with California additions.'),
    F('NGSS', 'California Next Generation Science Standards', 'Adopted 2013; uses California-specific middle-school integrated model.'),
    { source: 'https://www.cde.ca.gov/be/st/ss/', assessments: ['CAASPP (Smarter Balanced ELA and math; California Science Test)'], launch: 'priority' }),
  NY: ENTRY('New York',
    F('CCSS-derived', 'New York State Next Generation Mathematics Learning Standards', 'Revised from CCSS (2017); codes and some expectations differ.'),
    F('CCSS-derived', 'New York State Next Generation ELA Learning Standards', 'Revised from CCSS (2017).'),
    F('NGSS-derived', 'New York State P-12 Science Learning Standards', 'Based on NGSS (2016) with state changes.'),
    { source: 'https://www.nysed.gov/curriculum-instruction', assessments: ['Grades 3-8 State Tests', 'Regents Examinations'], launch: 'priority' }),
  IL: ENTRY('Illinois',
    F('CCSS', 'Illinois Learning Standards for Mathematics', 'Based on CCSS.'),
    F('CCSS', 'Illinois Learning Standards for ELA', 'Based on CCSS.'),
    F('NGSS', 'Illinois Learning Standards for Science', 'Based on NGSS.'),
    { source: 'https://www.isbe.net/Pages/Learning-Standards.aspx', assessments: ['State assessment program (verify current name and format)'], launch: 'priority' }),
  TX: ENTRY('Texas',
    F('state', 'Texas Essential Knowledge and Skills (TEKS): Mathematics', 'Texas never adopted CCSS.'),
    F('state', 'TEKS: English Language Arts and Reading'),
    F('state', 'TEKS: Science'),
    { source: 'https://tea.texas.gov/academics/curriculum-standards/teks-review', assessments: ['STAAR', 'End-of-Course assessments'], launch: 'requires-state-mapping' }),
  FL: ENTRY('Florida',
    F('state', 'B.E.S.T. Standards: Mathematics', 'Replaced Florida’s CCSS-based standards.'),
    F('state', 'B.E.S.T. Standards: ELA'),
    F('state', 'Next Generation Sunshine State Standards: Science'),
    { source: 'https://www.fldoe.org/academics/standards/', assessments: ['FAST (Florida Assessment of Student Thinking)', 'Statewide Science Assessment', 'End-of-Course assessments'], launch: 'requires-state-mapping' }),
  VA: ENTRY('Virginia',
    F('state', 'Virginia Standards of Learning: Mathematics', 'Virginia never adopted CCSS.'),
    F('state', 'Virginia Standards of Learning: English'),
    F('state', 'Virginia Standards of Learning: Science'),
    { source: 'https://www.doe.virginia.gov/teaching-learning-assessment/instruction', assessments: ['Standards of Learning (SOL) tests'], launch: 'requires-state-mapping' }),
};

// Every other state and DC: listed so the gap is visible, not researched yet.
const OTHERS = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  UT: 'Utah', VT: 'Vermont', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
for (const [code, name] of Object.entries(OTHERS)) STATES[code] = ENTRY(name, F(null, null), F(null, null), F(null, null), { source: null, assessments: [], launch: 'not-researched' });

export const STATE_LAYER = { asOf: '2026-10-13', entriesVerified: false };

// What the national baseline means for one state, per subject. Never 'aligned'.
export function stateStatus(code) {
  const s = STATES[code];
  if (!s) return null;
  const subj = (f) => {
    if (!f.basis) return 'not-researched';
    if (f.basis === 'state') return 'national-mapping-does-not-transfer';
    if (f.basis.endsWith('-derived')) return 'national-mapping-is-a-starting-point';
    return 'national-mapping-likely-transfers-unverified';
  };
  return {
    code, name: s.name, launch: s.launch,
    math: subj(s.subjects.math), ela: subj(s.subjects.ela), science: subj(s.subjects.science),
    verifiedSkills: Object.keys(s.verifiedMappings).length,
    unsupported: ['State-specific history and civics requirements', 'Graduation requirements and course sequences', 'State assessment formats and blueprints'],
  };
}

export const allStateStatus = () => Object.keys(STATES).sort().map(stateStatus);
