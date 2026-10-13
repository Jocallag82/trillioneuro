# Red Teddy Tutor — US K–12 curriculum: definition, coverage and backlog

Generated data: `inventory.json` (`node scripts/curriculum-inventory.mjs`) and
`quality-report.json` (`node scripts/quality-gate.mjs`). Figures below are from 13 October 2026.

## 1. What "complete" means here

Coverage is measured against an explicit denominator, never against "all of K–12".

| Layer | Definition | Where |
|---|---|---|
| National core | Every standard in the denominator: CCSS-M K–8 (229), CCSS-ELA K–8 (373: RL, RI, RF, W, SL, L), NGSS performance expectations K–12 (208). **810 standards.** | `learn/js/curriculum/standards/registry.js` |
| K–8 progressions | Skills placed by grade with prerequisites; a prerequisite never starts later than its dependant (tested). | `framework.js`, `core-spec.js`, `catalogues/us.js` |
| High-school courses | Algebra I, Geometry, Algebra II, Precalculus, Calculus, Statistics, English 9–10 / 11–12, Biology, Chemistry, Physics, US Government, US History, World History, Economics, Computer Science, Web Development. HS CCSS codes are mapped where certain but are **outside** the denominator. | `catalogues/us.js` |
| Standards mapping | Each link is `aligned` (core of the standard practised) or `partial`. Codes roll up to the standard (3.NF.A.3.D → 3.NF.A.3). | `standards/coverage.js` |
| State layer | Per state and subject: adopted as published / derived / state's own / not researched. A national mapping is never reported as a state alignment. | `standards/states.js` |
| Coverage report | Public dashboard `/curriculum` and `inventory.json`, computed from the code the app runs. | `curriculum.js` |

Status per standard: **mapped** (a skill lists it) ⊇ **taught** (that skill has a lesson) and
**assessed** (practice passes the quality gate); **fully covered** = taught + assessed + an `aligned`
link; **partial**; **unsupported**; **educator-reviewed** (none yet); **state-verified** (none yet).

### Sources
| Framework | Owner | Version | Licence |
|---|---|---|---|
| CCSS Mathematics — thecorestandards.org/Math | NGA Center & CCSSO | 2010 | Public licence, attribution required; codes only stored |
| CCSS ELA/Literacy — thecorestandards.org/ELA-Literacy | NGA Center & CCSSO | 2010 | As above |
| NGSS — nextgenscience.org | Achieve / NGSS Lead States | 2013 | Trademark; codes referenced, text not reproduced |
| Referenced, not mapped: CSTA K–12 CS (2017), C3 Social Studies (2013), NHES health (2024), National Core Arts (2014), ACTFL World-Readiness (2015), Jump$tart personal finance (2021) | | | |

The code lists were compiled from each framework's published structure and checked against the
published totals (229 / 373 / 208) in tests. The source sites were unreachable from the build
environment, so they have **not** been machine-diffed against the owners' files: do that first.

## 2. Results (13 October 2026)

| | Before this build | After |
|---|---|---|
| Published skills | 111 | **205** |
| Skills with a lesson | 85 | **179** (every new skill has two worked examples) |
| Skills passing the automated quality gate | not measured | **205 / 205** |
| Authored bank items in new skills | — | 435 (three difficulty tiers each) |
| Grade × subject cells below target | 27 | **3** |
| Courses with content / planned | 36 / 6 | **46 / 0** (incl. K–1 science, world geography, US history, CS elementary, web development, five enrichment courses) |

Standards coverage, denominator 810:

| Framework | Standards | Mapped | Taught | Assessed | Fully covered | Educator-reviewed |
|---|---|---|---|---|---|---|
| CCSS-M K–8 | 229 | 119 (52.0%) | 106 (46.3%) | 119 (52.0%) | 39 (17.0%) | 0 |
| CCSS-ELA K–8 | 373 | 44 (11.8%) | 40 (10.7%) | 44 (11.8%) | 9 (2.4%) | 0 |
| NGSS K–12 | 208 | 73 (35.1%) | 73 (35.1%) | 73 (35.1%) | 0 (0%) | 0 |
| **All** | **810** | **236 (29.1%)** | **219 (27.0%)** | **236 (29.1%)** | **48 (5.9%)** | **0** |

Before this build: 94 mapped (11.6%), 75 taught, 21 fully covered.

## 3. Quality gate (`scripts/quality-gate.mjs`, exits 1 on failure)
ids and titles unique · prerequisites exist, acyclic, ordered · placed in a same-subject course at
each grade · lesson complete · 40 generated sets per skill validate · one key per question, no
distractor equal to the key · at least 8 distinct items per 40 sets · cross-skill duplicate
questions reported · reachable by some age band · every K–8/NGSS code exists in the registry.
`scripts/core.test.mjs` additionally re-solves every computed item of the new skills from its
prompt text (600 seeds × 3 levels), checks bank integrity, lesson arithmetic, the planner and the
state layer.

## 4. Residual backlog (in priority order)
1. **Educator review** of all 435 new authored items and 94 new lessons (none reviewed). Required
   before any "reviewed" claim.
2. **Verify the registry** against the CCSSO and NGSS source files; add CCSS-M high school (~150)
   and CCSS-ELA 9–12 to the denominator.
3. **ELA writing, speaking and listening** (W, SL: ~140 standards): needs extended-response tasks
   with rubric scoring; multiple choice cannot assess them. RL/RI grades 4–8 need more passages.
4. **NGSS "fully covered" is 0**: add modelling and data-analysis tasks (graph reading, CER
   explanations) so practice addresses the full performance expectation.
5. **CCSS-M remaining 110**: K geometry/measurement attributes, grade 3–5 line plots and
   measurement data, 6.SP distributions, 7.EE/7.NS rational-number operations, 8.F function
   comparison, 8.SP scatter plots.
6. **Legacy content**: 26 early-years skills have no lesson; 78 legacy lessons have one worked
   example; 7 legacy early-years generators have low variety (all flagged as warnings).
7. **State layer**: verify CA, NY, IL entries against agency documents; map TX TEKS, FL B.E.S.T. and
   VA SOL as separate frameworks; research the remaining 44 states + DC; graduation requirements.
8. **CSTA / C3 / Jump$tart mapping** for computing, social studies and personal finance skills.
9. **Accessibility of new content**: read-aloud exists app-wide; add simplified-language variants
   for authored bank items aimed at grades K–2.
