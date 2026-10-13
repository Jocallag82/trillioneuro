(function () {
  'use strict';
  var T = window.TE, PAGE = 24;
  var f = T.$('#filters'), list = T.$('#list'), pager = T.$('#pager'), count = T.$('#count');
  var state = { q: T.qs('q') || '', country: (T.qs('country') || '').toUpperCase(), sort: T.qs('sort') === 'oldest' ? 'oldest' : 'newest', page: Math.max(1, parseInt(T.qs('page') || '1', 10) || 1) };
  T.$('#q').value = state.q; T.$('#sort').value = state.sort;
  T.countries().then(function (cs) {
    T.$('#country').insertAdjacentHTML('beforeend', cs.map(function (c) { return '<option value="' + c.code + '">' + T.esc(c.name) + '</option>'; }).join(''));
    T.$('#country').value = state.country;
  });
  var timer;
  f.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 280); });
  f.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
  function apply() {
    state.q = T.$('#q').value.trim(); state.country = T.$('#country').value; state.sort = T.$('#sort').value; state.page = 1; load(true);
  }
  function load(push) {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q); if (state.country) p.set('country', state.country);
    if (state.sort !== 'newest') p.set('sort', state.sort); if (state.page > 1) p.set('page', state.page);
    if (push) history.replaceState(null, '', '/record' + (p.toString() ? '?' + p : ''));
    list.setAttribute('aria-busy', 'true'); list.innerHTML = T.skeletonCards(6);
    T.rpc('te_record', { p_q: state.q || null, p_country: state.country || null, p_sort: state.sort, p_limit: PAGE, p_offset: (state.page - 1) * PAGE })
      .then(function (r) {
        list.setAttribute('aria-busy', 'false');
        var filtered = state.q || state.country;
        if (!r.rows.length) {
          list.innerHTML = '';
          list.insertAdjacentHTML('afterend', '');
          count.textContent = '';
          list.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>' + (filtered ? 'No entries match.' : 'The record is waiting for Nº 000001.') + '</h3><p>' +
            (filtered ? 'Try a different number, nickname or country.' : 'No verified entries yet. Be the first name in the story.') + '</p>' +
            (filtered ? '<button class="btn btn-line btn-sm" type="button" id="clear">Clear filters</button>' : '<a class="btn btn-gold" href="/join">Join the Founders’ Record</a>') + '</div>';
          var c = T.$('#clear'); if (c) c.onclick = function () { f.reset(); apply(); };
          pager.innerHTML = ''; return;
        }
        count.textContent = T.num(r.total) + (r.total === 1 ? ' verified entry' : ' verified entries') + (filtered ? ' match' : '');
        list.innerHTML = r.rows.map(T.entryCard).join(''); T.reveal(list);
        var pages = Math.ceil(r.total / PAGE);
        pager.innerHTML = pages > 1 ? (state.page > 1 ? '<button class="btn btn-line btn-sm" data-p="' + (state.page - 1) + '">← Previous</button>' : '') +
          '<span class="small muted">Page ' + state.page + ' of ' + pages + '</span>' +
          (state.page < pages ? '<button class="btn btn-line btn-sm" data-p="' + (state.page + 1) + '">Next →</button>' : '') : '';
      })
      .catch(function (e) {
        list.setAttribute('aria-busy', 'false');
        list.innerHTML = '<div style="grid-column:1/-1">' + T.errorBlock(e.message, true) + '</div>';
        T.$('[data-retry]').onclick = function () { load(false); };
      });
  }
  pager.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state.page = parseInt(b.getAttribute('data-p'), 10); load(true); window.scrollTo({ top: 0 });
  });
  load(false);
})();
