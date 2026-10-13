// Local words and stage names, kept apart from what is taught.
//
// These are labels for orientation only. They do NOT claim that an objective
// matches a national curriculum: no country's curriculum has been mapped or
// reviewed yet, and the UI says so. Adding a locale means adding an entry here;
// nothing else changes.

export const LOCALES = {
  'en-GB': {
    label: 'United Kingdom',
    words: { maths: 'Maths', colour: 'colour', Colours: 'Colours', parent: 'parent or carer' },
    stages: { '2-3': 'Toddler', '3-5': 'Nursery & Reception', '5-7': 'Year 1–2', '7-9': 'Year 3–4', '9-11': 'Year 5–6', '11-14': 'Year 7–9', '14-18': 'Year 10–13' },
  },
  'en-IE': {
    label: 'Ireland',
    words: { maths: 'Maths', colour: 'colour', Colours: 'Colours', parent: 'parent or guardian' },
    stages: { '2-3': 'Toddler', '3-5': 'Preschool & Junior Infants', '5-7': 'Senior Infants – 1st class', '7-9': '2nd–3rd class', '9-11': '4th–5th class', '11-14': '6th class – 2nd year', '14-18': '3rd–6th year' },
  },
  'en-US': {
    label: 'United States',
    words: { maths: 'Math', colour: 'color', Colours: 'Colors', parent: 'parent or caregiver' },
    stages: { '2-3': 'Toddler', '3-5': 'Preschool & Pre-K', '5-7': 'Kindergarten – Grade 1', '7-9': 'Grades 2–3', '9-11': 'Grades 4–5', '11-14': 'Grades 6–8 (middle school)', '14-18': 'Grades 9–12 (high school)' },
  },
  'en-AU': {
    label: 'Australia',
    words: { maths: 'Maths', colour: 'colour', Colours: 'Colours', parent: 'parent or carer' },
    stages: { '2-3': 'Toddler', '3-5': 'Kindy & Foundation', '5-7': 'Foundation – Year 1', '7-9': 'Years 2–3', '9-11': 'Years 4–5', '11-14': 'Years 6–8', '14-18': 'Years 9–12' },
  },
};

// The United States is the first market, so it is the default when the browser does not say.
export const DEFAULT_LOCALE = 'en-US';

// Picks a supported locale from the browser's preferences.
export function pickLocale(preferred = []) {
  for (const tag of preferred) {
    if (LOCALES[tag]) return tag;
    const region = String(tag).split('-')[1]?.toUpperCase();
    const hit = Object.keys(LOCALES).find((k) => k.endsWith(`-${region}`));
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

export const localeOf = (id) => LOCALES[id] || LOCALES[DEFAULT_LOCALE];

// Replaces "Maths"/"Colours" style words in UI strings for the learner's locale.
export function localise(text, id) {
  const w = localeOf(id).words;
  return String(text)
    .replace(/\bMaths\b/g, w.maths)
    .replace(/\bColours\b/g, w.Colours)
    .replace(/\bcolours\b/g, `${w.colour}s`)
    .replace(/\bcolour\b/g, w.colour);
}

export const stageName = (band, id) => localeOf(id).stages[band] || `Age ${band}`;
