(function () {
  'use strict';
  var T = window.TE;
  function set(k, html, pending) {
    var el = T.$('[data-k="' + k + '"]'); if (!el) return;
    el.innerHTML = html; el.classList.toggle('pending', !!pending);
  }

  T.rpc('te_stats').then(function (s) {
    var st = s.settings || {};
    set('entries', s.entries > 0 ? T.num(s.entries) : '0');
    set('countries', T.num(s.countries));
    set('started', st.challenge_started_on ? T.esc(T.date(st.challenge_started_on, { day: 'numeric', month: 'short', year: 'numeric' }))
      : 'Start date to be published', !st.challenge_started_on);
    var target = Number(st.target_eur) || 1e12;
    if (s.net_worth) {
      var nw = s.net_worth;
      set('networth', T.esc(T.bigEur(nw.amount, nw.currency)));
      set('networth-src', 'As of ' + T.esc(T.date(nw.as_of)) + ' · <a href="/challenge#methodology">methodology</a>');
      if (nw.currency === 'EUR') {
        var pct = Math.max(0, Math.min(100, nw.amount / target * 100));
        T.$('#dist-fill').style.width = Math.max(pct, 0.4) + '%';
        T.$('#dist-now').textContent = T.bigEur(nw.amount, 'EUR') + ' verified · ' + (pct < 0.01 ? '<0.01' : pct.toFixed(2)) + '% of the target';
        T.$('#dist-bar').setAttribute('aria-label', 'Verified net worth ' + T.bigEur(nw.amount, 'EUR') + ', ' + pct.toFixed(4) + '% of €1 trillion, as of ' + T.date(nw.as_of));
      }
    } else {
      set('networth', 'Not yet published', true);
      set('networth-src', 'Published only with a dated source and <a href="/challenge#methodology">method</a>.');
    }
    if (s.entries === 0) {
      T.$('#preview').outerHTML = '<div class="empty"><h3>The record opens with entry Nº 000001.</h3><p>No verified entries yet. ' +
        (st.payments_enabled ? 'The first number is still unclaimed.' : 'Paid entries open once payments are approved — you can preview your entry and join the waitlist now.') +
        '</p><a class="btn btn-gold" href="/join">' + (st.payments_enabled ? 'Claim Nº 000001' : 'Preview your entry') + '</a></div>';
    }
    T.$('#price').textContent = T.money(st.price_cents, st.currency);
  }).catch(function () {
    ['entries', 'countries', 'started', 'networth'].forEach(function (k) { set(k, 'Unavailable', true); });
  });

  // record preview
  var prev = T.$('#preview');
  prev.innerHTML = T.skeletonCards(6);
  T.rpc('te_record', { p_sort: 'newest', p_limit: 6, p_offset: 0 }).then(function (r) {
    if (!T.$('#preview')) return;
    if (!r.rows.length) { prev.innerHTML = ''; return; }
    prev.innerHTML = r.rows.map(T.entryCard).join(''); T.reveal(prev);
  }).catch(function () { prev.innerHTML = T.errorBlock(); });

  T.countries().then(function (cs) {
    var sel = T.$('#hc');
    sel.insertAdjacentHTML('beforeend', cs.map(function (c) { return '<option value="' + c.code + '">' + T.esc(c.name) + '</option>'; }).join(''));
  });

  // world + leaders
  T.rpc('te_country_stats').then(function (rows) {
    window.TEWorld.render(T.$('#world'), rows);
    var top = rows.filter(function (r) { return r.entries > 0; }).slice(0, 8);
    T.$('#top-countries').innerHTML = top.length ? top.map(function (r) {
      return '<li><a href="/countries/' + r.code + '" style="text-decoration:none;display:flex;justify-content:space-between;gap:12px"><span><span class="flag" aria-hidden="true">' + T.flag(r.code) + '</span> ' +
        T.esc(r.name) + '</span><span class="num gold">' + T.num(r.entries) + '</span></a></li>';
    }).join('') : '<li class="muted" style="padding-left:0">No country has a verified entry yet. The first entry puts its country on the map.</li>';
  }).catch(function () { T.$('#world').innerHTML = T.errorBlock('The map could not load.'); });

  // journey
  Promise.all([T.rpc('te_milestones_list'), T.rpc('te_journal_list', { p_limit: 3 })]).then(function (res) {
    var ms = res[0], posts = res[1];
    T.$('#timeline').innerHTML = ms.length ? ms.slice(0, 5).map(function (m) {
      return '<li class="' + T.esc(m.kind) + '"><time datetime="' + T.esc(m.occurred_on) + '">' + T.esc(T.date(m.occurred_on)) + '</time>' +
        '<h3>' + T.esc(m.title) + '</h3>' + (m.detail ? '<p class="muted">' + T.esc(m.detail) + '</p>' : '') +
        (m.verified ? '<span class="badge">Verified</span>' : '<span class="badge" style="border-color:var(--line-2);color:var(--mute)">Founder-reported</span>') + '</li>';
    }).join('') : '<li><time>Day one</time><h3>The timeline starts with the first verified milestone.</h3><p class="muted">Milestones appear here only once they have happened and are documented. Nothing is back-filled.</p></li>';
    T.$('#latest-posts').innerHTML = posts.length ? posts.map(function (p) {
      return '<a class="post" href="/journal/' + encodeURIComponent(p.slug) + '"><span class="kicker">' + T.esc(T.date(p.published_at)) + '</span><h3>' + T.esc(p.title) + '</h3>' +
        (p.excerpt ? '<p class="muted">' + T.esc(p.excerpt) + '</p>' : '') + '</a>';
    }).join('') : '<div class="empty"><h3>The journal opens soon.</h3><p>Founder updates will be published here — wins and setbacks alike.</p></div>';
  }).catch(function () {});

  T.shareButtons(T.$('#share-site'), { url: T.SITE + '/', text: 'BEAT ELON. One impossible ambition. A place in the story.', kind: 'home' });
})();
