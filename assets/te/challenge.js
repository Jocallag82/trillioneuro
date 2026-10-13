(function () {
  'use strict';
  var T = window.TE;
  var KIND = { personal_net_worth: 'Personal net worth', company_equity_value: 'Company equity value', company_revenue: 'Company revenue', cash_holdings: 'Cash holdings', other: 'Other' };
  T.settings().then(function (s) {
    var op = T.$('#operator-line');
    if (op && s.operator_name) op.textContent = 'TrillionEuro.com is operated by ' + s.operator_name + (s.operator_address ? ', ' + s.operator_address : '') + '.';
    var fp = T.$('#faq-price');
    if (fp) fp.textContent = 'The price is ' + T.money(s.price_cents, s.currency) + ', including any applicable VAT. One payment, no subscription. ' +
      (s.payments_enabled ? '' : 'Paid entries are not open yet; you can preview your entry and join the waitlist.');
  }).catch(function () {});
  var box = T.$('#metrics'), line = T.$('#status-line');
  if (!box && !line) return;
  T.rpc('te_metrics_list').then(function (ms) {
    if (box && ms.length) {
      box.innerHTML = '<h2>Published figures</h2><table><thead><tr><th>Measure</th><th>Amount</th><th>As of</th><th>Source &amp; method</th></tr></thead><tbody>' +
        ms.map(function (m) {
          return '<tr><td>' + T.esc(KIND[m.kind] || m.kind) + '<br><span class="small muted">' + T.esc(m.label) + '</span></td><td class="num">' +
            T.esc(new Intl.NumberFormat('en-IE', { style: 'currency', currency: m.currency, maximumFractionDigits: 0 }).format(m.amount)) + '</td><td>' + T.esc(T.date(m.as_of)) +
            '</td><td class="small">' + T.esc(m.source) + '<br><span class="muted">' + T.esc(m.methodology) + '</span></td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (line) {
      var nw = ms.filter(function (m) { return m.kind === 'personal_net_worth'; })[0];
      line.textContent = nw ? 'Latest verified personal net worth: ' + T.bigEur(nw.amount, nw.currency) + ' as of ' + T.date(nw.as_of) + '. Target: €1,000,000,000,000.'
        : 'No personal net-worth figure has been published yet. One will appear here only with a date, a source and a method — never an estimate dressed up as a fact.';
    }
  }).catch(function () { if (line) line.textContent = 'Figures could not be loaded right now.'; });
})();
