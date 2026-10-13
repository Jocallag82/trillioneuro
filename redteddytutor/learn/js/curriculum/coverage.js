// The curriculum coverage inventory. Computed from the data, never typed in, so it
// cannot claim more than exists. Used by the public curriculum page and by tests.
import { OBJECTIVES } from './framework.js';
import { GENERATORS } from './generators.js';
import { LESSONS } from './lessons.js';
import { US_GRADES } from './grades.js';

// Per-objective facts.
export function objectiveFacts(catalogue, id) {
  const place = catalogue.placement[id] || { grades: [], standards: [] };
  return {
    id,
    label: OBJECTIVES[id].label,
    subject: OBJECTIVES[id].subject,
    grades: place.grades,
    course: place.course || null,
    standards: place.standards || [],
    standardsMapped: (place.standards || []).length > 0,
    lesson: Boolean(LESSONS[id]),
    practice: Boolean(GENERATORS[id]),
    // Every generated set ends in a scored check; the placement check covers maths and reading.
    assessment: Boolean(GENERATORS[id]),
    prereqsLinked: OBJECTIVES[id].prereqs.length > 0,
    review: OBJECTIVES[id].review, // 'authored': Red Teddy team; no outside educator review yet
    stateVerified: false, // no state alignment has been verified
    note: place.note || null,
  };
}

// Rows of { grade, subject, objectives, standardsMapped, lessons, practice, ... }.
export function coverageByGrade(catalogue) {
  const ids = Object.keys(catalogue.placement).filter((id) => OBJECTIVES[id]);
  const rows = [];
  for (const grade of US_GRADES) {
    const subjects = [...new Set(catalogue.courses.filter((c) => c.grades.includes(grade)).map((c) => c.subject))];
    for (const subject of subjects) {
      const here = ids.filter((id) => catalogue.placement[id].grades.includes(grade) && OBJECTIVES[id].subject === subject).map((id) => objectiveFacts(catalogue, id));
      rows.push({
        grade, subject,
        courses: catalogue.courses.filter((c) => c.subject === subject && c.grades.includes(grade)).map((c) => ({ id: c.id, title: c.title, status: courseStatus(catalogue, c) })),
        objectives: here.length,
        standardsMapped: here.filter((f) => f.standardsMapped).length,
        lessons: here.filter((f) => f.lesson).length,
        practice: here.filter((f) => f.practice).length,
        prereqsLinked: here.filter((f) => f.prereqsLinked).length,
        stateVerified: 0,
        items: here,
      });
    }
  }
  return rows;
}

// True when an objective is listed in a course, as its home course or cross-listed.
export const inCourse = (place, courseId) => place.course === courseId || (place.also || []).includes(courseId);

export function courseStatus(catalogue, course) {
  if (course.status === 'planned') return 'planned';
  const has = Object.values(catalogue.placement).some((p) => inCourse(p, course.id));
  return has ? 'active' : 'planned';
}

export function totals(catalogue) {
  const facts = Object.keys(catalogue.placement).filter((id) => OBJECTIVES[id]).map((id) => objectiveFacts(catalogue, id));
  return {
    objectives: facts.length,
    withPractice: facts.filter((f) => f.practice).length,
    withLessons: facts.filter((f) => f.lesson).length,
    standardsMapped: facts.filter((f) => f.standardsMapped).length,
    activeCourses: catalogue.courses.filter((c) => courseStatus(catalogue, c) === 'active').length,
    plannedCourses: catalogue.courses.filter((c) => courseStatus(catalogue, c) === 'planned').length,
  };
}
