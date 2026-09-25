/**
 * QuadrillionEuro — civilisation-scale scenarios. Pure functions, no DOM.
 * Tested by scripts/scale.test.mjs.
 *
 * Four kinds of number, never blurred:
 *   FACT        — published figure, source named
 *   ESTIMATE    — derived arithmetically from facts (the derivation is shown)
 *   ASSUMPTION  — a visitor's input or an editable default
 *   SCENARIO    — the output of assumptions applied to facts. Not a forecast.
 */

export const FACTS = {
  worldPopulation: { value: 8.2e9, unit: 'people', asOf: '2025', source: 'UNFPA / UN World Population Prospects', url: 'https://www.unfpa.org/data/world-population/WORLD' },
  worldGdp: { value: 118e12, unit: 'US$ / year', asOf: '2025 (IMF estimate)', source: 'IMF World Economic Outlook, April 2026', url: 'https://www.imf.org/external/datamapper/NGDPD@WEO/WEOWORLD' },
  dataCentreTwh: { value: 415, unit: 'TWh / year', asOf: '2024 (IEA estimate)', source: 'IEA, Energy and AI', url: 'https://www.iea.org/reports/energy-and-ai/executive-summary' },
  dataCentreGrowth: { value: 0.15, unit: '/ year', asOf: '2024–2030 base case', source: 'IEA, Energy and AI (around 15% a year)', url: 'https://www.iea.org/reports/energy-and-ai/executive-summary' },
  dataCentreShare: { value: 0.015, unit: 'of global electricity', asOf: '2024', source: 'IEA, Energy and AI (about 1.5%)', url: 'https://www.iea.org/reports/energy-and-ai/executive-summary' },
  evSales: { value: 17e6, unit: 'cars / year', asOf: '2024', source: 'IEA Global EV Outlook 2025 (more than 17 million)', url: 'https://www.iea.org/reports/global-ev-outlook-2025/executive-summary' },
  evShare: { value: 0.2, unit: 'of new cars', asOf: '2024', source: 'IEA Global EV Outlook 2025 (more than 20%)', url: 'https://www.iea.org/reports/global-ev-outlook-2025/executive-summary' },
  cleanInvestment: { value: 2.2e12, unit: 'US$ / year', asOf: '2025 (IEA estimate)', source: 'IEA World Energy Investment 2025', url: 'https://www.iea.org/reports/world-energy-investment-2025/executive-summary' },
};

/** Derived figures, each with its derivation shown to the reader. */
export const ESTIMATES = {
  globalElectricityTwh: { value: FACTS.dataCentreTwh.value / FACTS.dataCentreShare.value, how: '415 TWh ÷ 1.5% ≈ total global electricity use in 2024' },
  newCarsPerYear: { value: FACTS.evSales.value / FACTS.evShare.value, how: '17 million EVs ÷ 20% share ≈ all new cars sold in 2024 (an upper bound: both IEA figures are “more than”)' },
};

export const QUADRILLION = 1e15;

const grow = (base, rate, years) => base * Math.pow(1 + rate, years);

/** Three-point sensitivity on a growth rate: rate − spread, rate, rate + spread. */
export function band(base, rate, years, spread = 0.05) {
  return {
    low: grow(base, Math.max(-0.99, rate - spread), years),
    base: grow(base, rate, years),
    high: grow(base, rate + spread, years),
  };
}

/** AI and data centres: electricity use in `years`, and its share of total electricity. */
export function aiElectricity({ growth, years, gridGrowth }) {
  const dc = band(FACTS.dataCentreTwh.value, growth, years);
  const grid = grow(ESTIMATES.globalElectricityTwh.value, gridGrowth, years);
  return { dc, grid, share: { low: dc.low / grid, base: dc.base / grid, high: dc.high / grid } };
}

/** Electric cars: the year EV sales would equal today's whole new-car market. */
export function evTakeover({ growth, marketGrowth }) {
  let ev = FACTS.evSales.value, market = ESTIMATES.newCarsPerYear.value, y = 0;
  while (ev < market && y < 100) { ev *= 1 + growth; market *= 1 + marketGrowth; y++; }
  return { years: y < 100 ? y : null, year: y < 100 ? 2024 + y : null };
}

/** Clean-energy investment accumulated over `years` at a growth rate. */
export function cumulativeInvestment({ growth, years }) {
  let total = 0, yearly = FACTS.cleanInvestment.value;
  for (let i = 0; i < years; i++) { total += yearly; yearly *= 1 + growth; }
  return { total, finalYear: yearly / (1 + growth) };
}

/** Anything at scale: people × adoption × spend, grown over time, against world GDP. */
export function marketAtScale({ population, adoption, spendPerYear, growth, years, gdpGrowth }) {
  const size = population * adoption * spendPerYear;
  const future = band(size, growth, years);
  const gdp = grow(FACTS.worldGdp.value, gdpGrowth, years);
  const grid = [0.5, 1, 1.5].map((a) => [0.5, 1, 1.5].map((s) => population * adoption * a * spendPerYear * s));
  return { size, future, gdp, shareOfGdp: future.base / gdp, sensitivity: grid };
}

/** The quadrillion clock: years of world output until the cumulative total passes $1 quadrillion. */
export function quadrillionClock({ gdpGrowth, startYear = 2026 }) {
  let total = 0, gdp = FACTS.worldGdp.value, y = 0;
  while (total < QUADRILLION && y < 200) { total += gdp; gdp *= 1 + gdpGrowth; y++; }
  return { years: y, reachedIn: startYear + y - 1 };
}

export function fmt(n, unit = '') {
  const a = Math.abs(n);
  const s = a >= 1e15 ? `${+(a / 1e15).toFixed(2)} quadrillion`
    : a >= 1e12 ? `${+(a / 1e12).toFixed(a >= 1e14 ? 0 : 1)} trillion`
    : a >= 1e9 ? `${+(a / 1e9).toFixed(1)} billion`
    : a >= 1e6 ? `${+(a / 1e6).toFixed(1)} million`
    : Math.round(a).toLocaleString('en-IE');
  return `${n < 0 ? '−' : ''}${unit}${s}`;
}
