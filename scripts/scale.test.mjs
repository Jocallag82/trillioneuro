import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleLadder, analyseIdea, FACTS as TF } from '../lib/scale.js';
import { aiElectricity, evTakeover, cumulativeInvestment, marketAtScale, quadrillionClock, ESTIMATES, FACTS as QF } from '../quadrillioneuro/lib/scenario.js';

test('every fact names a source URL and a date', () => {
  for (const f of [...Object.values(TF), ...Object.values(QF)]) {
    assert.match(f.url, /^https:\/\//);
    assert.ok(f.asOf);
  }
});

test('scale ladder: €1 trillion at €100 a year needs more customers than people exist', () => {
  const l = scaleLadder(100);
  const tn = l.find((r) => r.revenue === 1e12);
  assert.equal(tn.customers, 1e10);
  assert.equal(tn.possible, false);
  assert.equal(l[0].customers, 1e4);
});

test('idea analyser: LTV, LTV:CAC and payback', () => {
  const r = analyseIdea({ pricePerYear: 120, grossMargin: 0.8, cac: 60, annualChurn: 0.3, newCustomersPerMonth: 100, monthlyAcquisitionGrowth: 0, years: 3 });
  assert.equal(Math.round(r.ltv), 320);
  assert.ok(Math.abs(r.ltvToCac - 320 / 60) < 1e-9);
  assert.equal(Math.round(r.paybackMonths * 10) / 10, 7.5);
  assert.equal(r.years.length, 3);
  assert.ok(r.years[2].customers > r.years[0].customers);
});

test('estimates are derived from facts, and say how', () => {
  assert.equal(Math.round(ESTIMATES.globalElectricityTwh.value), Math.round(415 / 0.015));
  assert.match(ESTIMATES.newCarsPerYear.how, /÷/);
});

test('scenarios: bands are ordered, takeover year is found, sums accumulate', () => {
  const ai = aiElectricity({ growth: 0.15, years: 6, gridGrowth: 0.03 });
  assert.ok(ai.dc.low < ai.dc.base && ai.dc.base < ai.dc.high);
  assert.ok(ai.share.base > 0.015);
  const ev = evTakeover({ growth: 0.2, marketGrowth: 0.01 });
  assert.ok(ev.years > 0 && ev.year > 2024);
  const inv = cumulativeInvestment({ growth: 0, years: 10 });
  assert.equal(inv.total, 22e12);
  const m = marketAtScale({ population: 1e9, adoption: 0.1, spendPerYear: 100, growth: 0, years: 5, gdpGrowth: 0 });
  assert.equal(m.size, 1e10);
  assert.equal(m.sensitivity[1][1], 1e10);
  const q = quadrillionClock({ gdpGrowth: 0 });
  assert.equal(q.years, Math.ceil(1e15 / 118e12));
});
