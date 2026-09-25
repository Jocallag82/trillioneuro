/**
 * TrillionEuro — the arithmetic of scale. Pure functions, no DOM.
 * Tested by scripts/scale.test.mjs (node --test).
 *
 * Every figure the page shows is one of:
 *   FACT        — from the source named beside it (FACTS below)
 *   ASSUMPTION  — something the visitor typed or a default they can change
 *   CALCULATED  — arithmetic on the two above; never a forecast
 */

export const FACTS = {
  worldPopulation: { value: 8.2e9, label: 'World population', unit: 'people', asOf: '2025', source: 'UNFPA / UN World Population Prospects', url: 'https://www.unfpa.org/data/world-population/WORLD' },
  worldGdp: { value: 118e12, label: 'World GDP', unit: 'US$ a year', asOf: '2025 (IMF estimate, April 2026 WEO)', source: 'IMF World Economic Outlook', url: 'https://www.imf.org/external/datamapper/NGDPD@WEO/WEOWORLD' },
  euGdp: { value: 18.8e12, label: 'EU GDP', unit: '€ a year', asOf: '2025', source: 'Eurostat', url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/wdn-20260806-1' },
  irelandGniStar: { value: 334e9, label: 'Ireland modified GNI (GNI*)', unit: '€ a year', asOf: '2025', source: 'CSO Annual National Accounts', url: 'https://www.cso.ie/en/releasesandpublications/ep/p-ana/annualnationalaccounts2025/gniandde-globalisedresults/' },
  energyInvestment: { value: 3.3e12, label: 'Global energy investment', unit: 'US$ a year', asOf: '2025 (IEA estimate)', source: 'IEA World Energy Investment 2025', url: 'https://www.iea.org/reports/world-energy-investment-2025/executive-summary', note: 'of which about $2.2 trillion clean energy' },
  evSales: { value: 17e6, label: 'Electric cars sold', unit: 'cars', asOf: '2024', source: 'IEA Global EV Outlook 2025', url: 'https://www.iea.org/reports/global-ev-outlook-2025/executive-summary', note: 'more than 20% of all new cars' },
  dataCentreElectricity: { value: 415, label: 'Data-centre electricity use', unit: 'TWh', asOf: '2024 (IEA estimate)', source: 'IEA Energy and AI', url: 'https://www.iea.org/reports/energy-and-ai/executive-summary', note: 'about 1.5% of global electricity' },
};

export const MILESTONES = [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];

export function fmtMoney(n, cur = '€') {
  const a = Math.abs(n);
  const s = a >= 1e12 ? `${+(a / 1e12).toFixed(a >= 1e14 ? 0 : 1)} trillion`
    : a >= 1e9 ? `${+(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)} billion`
    : a >= 1e6 ? `${+(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)} million`
    : Math.round(a).toLocaleString('en-IE');
  return `${n < 0 ? '−' : ''}${cur}${s}`;
}

export function fmtCount(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)} million`;
  return Math.ceil(n).toLocaleString('en-IE');
}

/**
 * The scale ladder: how many paying customers each revenue milestone needs at
 * a given yearly price, and what share of a population that is.
 */
export function scaleLadder(pricePerYear, population = FACTS.worldPopulation.value) {
  return MILESTONES.map((revenue) => {
    const customers = pricePerYear > 0 ? revenue / pricePerYear : Infinity;
    const share = customers / population;
    return { revenue, customers, share, possible: share <= 1 };
  });
}

/**
 * Unit economics and a simple growth model for an idea.
 * All inputs are assumptions. Returns calculated year-by-year figures.
 */
export function analyseIdea(i) {
  const monthlyChurn = 1 - Math.pow(1 - Math.min(0.99, Math.max(0, i.annualChurn)), 1 / 12);
  const monthlyPrice = i.pricePerYear / 12;
  const ltv = i.annualChurn > 0 ? (i.pricePerYear * i.grossMargin) / i.annualChurn : Infinity;
  const ltvToCac = i.cac > 0 ? ltv / i.cac : Infinity;
  const paybackMonths = monthlyPrice * i.grossMargin > 0 ? i.cac / (monthlyPrice * i.grossMargin) : Infinity;

  let customers = 0;
  let newPerMonth = i.newCustomersPerMonth;
  const years = [];
  let firstMilestone = {};
  for (let y = 1; y <= i.years; y++) {
    let revenue = 0, acquired = 0;
    for (let m = 0; m < 12; m++) {
      customers = customers * (1 - monthlyChurn) + newPerMonth;
      if (i.maxCustomers && customers > i.maxCustomers) customers = i.maxCustomers;
      revenue += customers * monthlyPrice;
      acquired += newPerMonth;
      newPerMonth *= 1 + i.monthlyAcquisitionGrowth;
    }
    const gross = revenue * i.grossMargin;
    const acquisitionSpend = acquired * i.cac;
    years.push({ year: y, customers: Math.round(customers), revenue, grossProfit: gross, acquisitionSpend, contribution: gross - acquisitionSpend });
    for (const ms of MILESTONES) if (revenue >= ms && !(ms in firstMilestone)) firstMilestone[ms] = y;
  }
  return { ltv, ltvToCac, paybackMonths, monthlyChurn, years, firstMilestone };
}
