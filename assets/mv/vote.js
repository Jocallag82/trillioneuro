/* Priorities voting: cards, one vote per contributor per round (enforced in Postgres), and idea submission. */
(function () {
  'use strict';
  var MV = window.MV, esc = MV.esc;

  function mount(root) {
    var state = null, signedIn = !!MV.session(), busy = false;

    function load() {
      return MV.rpc('mv_priorities', {}, { auth: signedIn }).then(function (s) { state = s; render(); }, function () {
        root.innerHTML = '<div class="board-empty"><b>' + esc(MV.t('vote.fail.t', 'Priorities could not be loaded.')) + '</b>' + esc(MV.t('vote.fail.d', 'Please refresh in a moment.')) + '</div>';
      });
    }
    function btn(i) {
      var mine = state.my_vote === i.id;
      if (!signedIn) return '<a class="btn btn-ghost" href="/join#join">' + esc(MV.t('vote.join', 'Join to vote')) + ' <span class="arr">→</span></a>';
      if (state.my_vote) return '<button type="button" class="btn ' + (mine ? 'btn-gold' : 'btn-ghost') + '" disabled>' + (mine ? '✓ ' + esc(MV.t('vote.yours', 'Your vote')) : esc(MV.t('vote.cast', 'Vote cast'))) + '</button>';
      return '<button type="button" class="btn btn-gold" data-vote="' + i.id + '">' + esc(MV.t('vote.btn', 'Vote for this')) + '</button>';
    }
    function card(i, n) {
      return '<article class="vcard rv' + (state.my_vote === i.id ? ' mine' : '') + '" style="--d:' + (n % 3) + '"><div class="vart">' + window.MVArt(i.art_key, 'v' + i.id) + '</div><div class="vbody">' +
        '<h3>' + esc(i.title) + '</h3><p>' + esc(i.summary) + '</p>' +
        '<div class="vmeta"><span><b class="num" data-n="' + i.votes + '">0</b> ' + esc(i.votes === 1 ? MV.t('vote.vote', 'vote') : MV.t('vote.votes', 'votes')) + '</span><span class="num">' + i.pct + '%</span></div>' +
        '<div class="bar" role="img" aria-label="' + i.pct + '% of votes"><i data-w="' + i.pct + '"></i></div>' + btn(i) + '</div></article>';
    }
    function render() {
      var seeds = state.ideas.filter(function (i) { return i.kind === 'seed'; }), comm = state.ideas.filter(function (i) { return i.kind !== 'seed'; });
      var total = state.total_votes;
      var h = '<div class="vgrid">' + seeds.map(card).join('') + otherCard(comm) + '</div>';
      h += '<div class="row-actions"><span class="muted">' + (total ? '<b class="num">' + MV.num(total) + '</b> ' + esc(MV.t('vote.total', 'votes cast so far')) : esc(MV.t('vote.none', 'No votes yet — be the first to shape the direction.'))) + '</span>' +
        (total ? '<span class="shares" id="vote-share"></span>' : '') + '</div>';
      root.innerHTML = h; MV.reveal(root);
      MV.onVisible(root, function () {
        MV.$$('.bar i', root).forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
        MV.$$('[data-n]', root).forEach(function (n) { MV.countUp(n, Number(n.getAttribute('data-n')), { duration: 1200 }); });
      }, '0px 0px 0px 0px');
      var sh = MV.$('#vote-share', root);
      if (sh) {
        var lead = state.ideas.slice().sort(function (a, b) { return b.votes - a.votes; })[0];
        MV.bindShare(sh, { url: MV.SITE + '/#priorities', kind: 'votes', text: 'The Trillion Euro community has cast ' + MV.num(total) + ' votes on what to tackle first — ' + lead.title + ' leads with ' + lead.pct + '%. Add your voice:' });
      }
    }
    function otherCard(comm) {
      var form = signedIn
        ? '<form id="idea-form" novalidate><div class="fld"><label for="idea-title">' + esc(MV.t('idea.title', 'Your idea')) + '</label><input id="idea-title" maxlength="80" autocomplete="off" placeholder="' + esc(MV.t('idea.ph', 'e.g. Clean cooking for every household')) + '"></div>' +
          '<div class="fld"><label for="idea-sum">' + esc(MV.t('idea.sum', 'Why it matters')) + ' <small>(20–400)</small></label><textarea id="idea-sum" rows="3" maxlength="400"></textarea></div>' +
          '<div class="msg" id="idea-msg" role="alert"></div><button class="btn btn-blue" type="submit">' + esc(MV.t('idea.send', 'Suggest this priority')) + '</button>' +
          '<p class="fine">' + esc(MV.t('idea.rules', 'Ideas are reviewed before they appear. No links, please — describe the idea in words.')) + '</p></form>'
        : '<a class="btn btn-gold" href="/join#join">' + esc(MV.t('idea.join', 'Join to suggest an idea')) + ' <span class="arr">→</span></a>';
      var list = comm.length ? '<div class="idea-list">' + comm.map(function (i) {
        return '<div class="idea"><b>' + esc(i.title) + '</b><small>' + esc(i.summary) + ' · <span class="num">' + MV.num(i.votes) + '</span> votes (' + i.pct + '%)</small>' +
          (!signedIn ? '' : state.my_vote === i.id ? '<span class="pill gold">' + esc(MV.t('vote.yours', 'Your vote')) + '</span>' : state.my_vote ? '' : '<button class="btn btn-gold btn-sm" type="button" data-vote="' + i.id + '">' + esc(MV.t('vote.btn.s', 'Vote')) + '</button>') + '</div>';
      }).join('') + '</div>' : '<p class="muted" style="margin-top:14px">' + esc(MV.t('idea.none', 'No community ideas have been approved yet. Yours could be the first.')) + '</p>';
      return '<article class="vcard other rv"><div class="other-in"><div><span class="kicker">' + esc(MV.t('idea.kicker', 'Other ideas')) + '</span><h3 style="margin:14px 0 10px;font-size:clamp(26px,3vw,38px)">' + esc(MV.t('idea.h', 'Something we have missed?')) + '</h3>' +
        '<p style="color:var(--ink-2)">' + esc(MV.t('idea.d', 'The best priorities will come from contributors. Suggest one — once reviewed it joins the vote for everyone.')) + '</p>' + form + '</div><div>' +
        '<span class="pill">' + esc(MV.t('idea.sub', 'Submitted by contributors')) + '</span>' + list + '</div></div></article>';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vote]'); if (!b || busy) return;
      busy = true; b.disabled = true;
      MV.rpc('mv_cast_vote', { p_idea_id: Number(b.getAttribute('data-vote')) }, { auth: true }).then(function (s) {
        state = s; render(); MV.toast(MV.t('vote.ok', 'Your vote is counted. Thank you.')); MV.track('vote', {}); document.dispatchEvent(new CustomEvent('mv:voted'));
      }).catch(function (err) {
        MV.toast(err.message); if (err.code === 'ALREADY_VOTED') load(); else b.disabled = false;
      }).then(function () { busy = false; });
    });
    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'idea-form') return; e.preventDefault();
      var t = MV.$('#idea-title', root).value, s = MV.$('#idea-sum', root).value, msg = MV.$('#idea-msg', root), f = e.target;
      msg.className = 'msg'; var sb = f.querySelector('button'); sb.disabled = true;
      MV.rpc('mv_submit_idea', { p_title: t, p_summary: s }, { auth: true }).then(function () {
        f.reset(); msg.className = 'msg ok show'; msg.textContent = MV.t('idea.thanks', 'Thank you — your idea is awaiting review and will join the vote once approved.'); MV.track('idea', {});
      }).catch(function (err) { msg.className = 'msg err show'; msg.textContent = err.message; }).then(function () { sb.disabled = false; });
    });
    load();
    return { reload: load };
  }
  window.MVVote = { mount: mount };
})();
