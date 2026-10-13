// School grades and how they map onto the engine's age bands.
//
// The engine plans by age band (framework BANDS). Countries name their school years
// differently, so grades live here and in each country catalogue, never in the engine.
export const US_GRADES = ['PK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export const GRADE_BAND = {
  PK: '3-5', K: '5-7', 1: '5-7', 2: '7-9', 3: '7-9', 4: '9-11', 5: '9-11',
  6: '11-14', 7: '11-14', 8: '11-14', 9: '14-18', 10: '14-18', 11: '14-18', 12: '14-18',
};

export const gradeLabel = (g) => (g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : `Grade ${g}`);
export const gradeShort = (g) => (g === 'PK' ? 'Pre-K' : g === 'K' ? 'K' : g);

// Elementary (K-5), middle (6-8), high (9-12). Pre-K sits with early learning.
export function schoolLevel(g) {
  if (g === 'PK') return 'early';
  if (g === 'K' || Number(g) <= 5) return 'elementary';
  if (Number(g) <= 8) return 'middle';
  return 'high';
}

export const LEVEL_LABEL = { early: 'Early learning', elementary: 'Elementary school', middle: 'Middle school', high: 'High school' };

export const isGrade = (g) => US_GRADES.includes(g);
