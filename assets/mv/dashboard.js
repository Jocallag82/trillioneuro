/* Contributor dashboard: status, country standing, votes, ideas, invitations, announcements, settings, data rights. */
(function () {
  'use strict';
  var MV = window.MV, $ = MV.$, esc = MV.esc, root = $('#dash-root');
  if (!root) return;

  function gate(title, text, cta) {
    root.innerHTML = '<div class="gate glass"><h2 style="font-size:clamp(28px,4vw,44px)">' + esc(title) + '</h2><p class="lede" style="margin:18px auto 28px">' + esc(text) + '</p>' + cta + '</div>';
  }
  if (!MV.session()) return gate(MV.t('dash.gate.t', 'Sign in to see your dashboard'), MV.t('dash.gate.d', 'Your founding status, country standing, votes and invitation link live here.'),
    '<div class="row-actions" style="justify-content:center"><a class="btn btn-gold" href="/join?mode=signin">' + esc(MV.t('join.signin', 'Sign in')) + '</a><a class="btn btn-ghost" href="/join#join">' + esc(MV.t('join.tab.join', 'Join')) + '</a></div>');

  var seal = '<svg class="seal" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d894"/><stop offset="1" stop-color="#b98f43"/></linearGradient></defs>' +
    '<circle cx="60" cy="60" r="56" fill="none" stroke="url(#sg)" stroke-width="2"/><circle cx="60" cy="60" r="48" fill="rgba(216,180,106,.08)" stroke="url(#sg)" stroke-width="1" stroke-dasharray="2 5"/>' +
    '<path d="M60 22l9 24 25 2-19 16 6 25-21-14-21 14 6-25-19-16 25-2Z" fill="url(#sg)"/></svg>';

  function ago(v) { return MV.date(v); }
  function announcement(a) {
    if (a.kind === 'milestone') return '<li><b>' + (a.scope === 'global' ? MV.t('ann.gm', 'Global milestone reached') : MV.t('ann.cm', 'Your country reached a milestone')) + '</b><span>' + MV.t('ann.m', '{n} contributors.', { n: MV.num(a.threshold) }) + '</span><time>' + esc(ago(a.at)) + '</time></li>';
    return '<li><b>' + esc(a.title) + '</b><span>' + esc(a.body) + '</span><time>' + esc(ago(a.at)) + '</time></li>';
  }
  var pill = { pending: '<span class="pill wait">Awaiting review</span>', live: '<span class="pill ok">Live</span>', rejected: '<span class="pill">Not published</span>' };

  function render(d) {
    var p = d.profile, c = d.country, r = d.referral, url = MV.SITE + '/?ref=' + r.code;
    var title = p.founding_number ? (p.is_founding ? MV.t('dash.founding', 'Founding Contributor') : MV.t('dash.contrib', 'Contributor')) : MV.t('dash.pending', 'Contributor');
    var welcome = MV.qs('welcome') ? '<div class="msg ok show" style="grid-column:span 12;margin:0">' + esc(MV.t('dash.welcome', 'Welcome to the movement. You are in from the beginning — now invite someone.')) + '</div>' : '';
    var warn = !p.confirmed ? '<div class="msg err show" style="grid-column:span 12;margin:0">' + esc(MV.t('dash.unconfirmed', 'Please confirm your email address to activate your place, your vote and your ranking.')) + '</div>' : '';
    root.innerHTML = '<div class="dash">' + welcome + warn +
      '<section class="dcard glass w8 rv"><div class="status">' + seal + '<div><span class="kicker">' + esc(title) + '</span><div class="seal-no" style="margin-top:12px">' + (p.founding_number ? 'Nº ' + MV.pad(p.founding_number) : '—') + '</div>' +
      '<p class="muted" style="margin:10px 0 0">' + esc(p.full_name) + (p.display_name ? ' · “' + esc(p.display_name) + '”' : '') + ' · ' + esc(MV.t('dash.since', 'joined {d}', { d: ago(p.joined_at) })) + '</p></div></div>' +
      '<p class="fine" style="margin-top:20px">' + esc(MV.t('dash.found.note', 'The first 10,000 confirmed contributors are recorded as Founding Contributors. It is recognition of being early — it carries no financial rights.')) + '</p></section>' +
      '<section class="dcard glass w4 rv" style="--d:1"><h3>' + esc(MV.t('dash.country', 'Your country')) + '</h3><div class="cflag flag" style="font-size:54px;margin:14px 0 6px">' + MV.flag(c.code) + '</div><div class="display" style="font-size:30px">' + esc(c.name) + '</div>' +
      '<div class="kv"><div><b>' + MV.num(c.contributors) + '</b><span>Contributors</span></div><div><b>' + (c.rank ? '#' + c.rank : '—') + '</b><span>Country position</span></div></div>' +
      '<a class="link" href="/countries/' + esc(c.slug) + '">' + esc(MV.t('dash.country.link', 'Visit your country community')) + ' →</a></section>' +
      '<section class="dcard glass w4 rv"><h3>' + esc(MV.t('dash.global', 'The movement')) + '</h3><p class="sub">' + esc(MV.t('dash.global.d', 'Real registrations, right now.')) + '</p><div class="kv"><div><b>' + MV.num(d.global.contributors) + '</b><span>Contributors</span></div><div><b>' + MV.num(d.global.countries) + '</b><span>Countries</span></div></div></section>' +
      '<section class="dcard glass w4 rv" style="--d:1"><h3>' + esc(MV.t('dash.votes', 'Your vote')) + '</h3>' + (d.my_vote ? '<p class="sub">' + esc(MV.t('dash.voted', 'Cast on {d}', { d: ago(d.my_vote.voted_at) })) + '</p><div class="display" style="font-size:24px;line-height:1.15">' + esc(d.my_vote.title) + '</div>' : '<p class="sub">' + esc(MV.t('dash.novote', 'You have not voted yet. One vote per round.')) + '</p><a class="btn btn-gold btn-sm" href="/#priorities">' + esc(MV.t('dash.vote.go', 'Choose a priority')) + '</a>') + '</section>' +
      '<section class="dcard glass w4 rv" style="--d:2"><h3>' + esc(MV.t('dash.ideas', 'Your ideas')) + '</h3>' + (d.my_ideas.length ? '<ul class="alist" style="margin-top:14px">' + d.my_ideas.map(function (i) { return '<li><b>' + esc(i.title) + '</b>' + (pill[i.status] || '') + (i.status === 'live' ? '<time>' + MV.num(i.votes) + ' votes</time>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="sub">' + esc(MV.t('dash.noideas', 'You have not suggested a priority yet.')) + '</p><a class="btn btn-ghost btn-sm" href="/#priorities">' + esc(MV.t('dash.idea.go', 'Suggest one')) + '</a>') + '</section>' +

      '<section class="dcard glass w12 rv" id="invite"><div class="spread"><div><span class="kicker">' + esc(MV.t('spread.k', 'Spread the movement')) + '</span><h3 style="margin:14px 0 8px;font-size:clamp(26px,3vw,38px)">' + esc(MV.t('dash.ref.t', 'Your invitation link')) + '</h3>' +
      '<p class="muted">' + esc(MV.t('dash.ref.d', 'Everyone who joins through it is credited to you — a number on your dashboard, nothing more. There are no rewards for recruiting.')) + '</p>' +
      '<div class="linkbox"><input id="ref-link" readonly value="' + esc(url) + '" aria-label="Your invitation link"><button class="btn btn-gold btn-sm" type="button" id="ref-copy">' + esc(MV.t('share.copy', 'Copy link')) + '</button></div>' +
      '<div class="refstats"><div><b data-r="invites">' + MV.num(r.invites) + '</b><span>Invitations shared</span></div><div><b>' + MV.num(r.successful) + '</b><span>Joined via you</span></div><div><b>' + (r.rank ? '#' + r.rank : '—') + '</b><span>Your referral position</span></div></div>' +
      (r.by_country.length ? '<p class="small muted">' + esc(MV.t('dash.ref.by', 'Joined from:')) + ' ' + r.by_country.map(function (x) { return '<span class="flag">' + MV.flag(x.code) + '</span> ' + esc(x.name) + ' ×' + x.n; }).join(' · ') + '</p>' : '<p class="small muted">' + esc(MV.t('dash.ref.none', 'No one has joined through your link yet.')) + '</p>') +
      '<div class="shares" id="share-btns" style="margin-top:18px"></div></div>' +
      '<div><div class="cardprev glass" id="card-slot"><canvas id="card-canvas" width="1080" height="1350" aria-hidden="true"></canvas></div><div class="row-actions" style="justify-content:center"><button class="btn btn-ghost btn-sm" type="button" id="card-dl">' + esc(MV.t('card.dl', 'Download image')) + '</button><button class="btn btn-ghost btn-sm" type="button" id="card-share">' + esc(MV.t('card.share', 'Share image')) + '</button></div></div></div></section>' +

      '<section class="dcard glass w8 rv"><h3>' + esc(MV.t('dash.ann', 'Movement announcements')) + '</h3>' + (d.announcements.length ? '<ul class="alist" style="margin-top:14px">' + d.announcements.map(announcement).join('') + '</ul>' : '<p class="sub">' + esc(MV.t('dash.ann.none', 'Nothing yet. Announcements and genuine milestones — the first 100 contributors, for one — will appear here when they happen.')) + '</p>') + '</section>' +
      '<section class="dcard glass w4 rv" style="--d:1"><h3>' + esc(MV.t('dash.account', 'Account')) + '</h3><p class="sub">' + esc(MV.t('dash.account.d', 'Your data, under your control.')) + '</p><div class="row-actions" style="flex-direction:column;align-items:stretch"><button class="btn btn-ghost btn-sm" type="button" id="export">' + esc(MV.t('dash.export', 'Download my data')) + '</button><button class="btn btn-ghost btn-sm" type="button" id="signout">' + esc(MV.t('join.out', 'Sign out')) + '</button></div></section>' +

      '<section class="dcard glass w6 rv"><h3>' + esc(MV.t('dash.settings', 'Profile settings')) + '</h3><div class="msg" id="smsg" role="alert" style="margin-top:14px"></div><form id="settings" novalidate style="margin-top:16px">' +
      '<div class="fld"><label for="s-fn">' + esc(MV.t('f.name', 'Full name')) + '</label><input id="s-fn" maxlength="80" value="' + esc(p.full_name) + '"></div>' +
      '<div class="fld"><label for="s-dn">' + esc(MV.t('f.display', 'Display name')) + ' <small>' + esc(MV.t('f.opt', 'optional')) + '</small></label><input id="s-dn" maxlength="40" value="' + esc(p.display_name || '') + '"></div>' +
      '<div class="fld"><label for="s-co">' + esc(MV.t('f.country', 'Your country')) + '</label><select id="s-co"></select></div>' +
      '<label class="chk"><input type="checkbox" id="s-mk"' + (p.marketing_consent ? ' checked' : '') + '><span>' + esc(MV.t('f.marketing.s', 'Send me occasional movement updates by email.')) + '</span></label>' +
      '<button class="btn btn-gold btn-sm" type="submit">' + esc(MV.t('dash.save', 'Save changes')) + '</button></form></section>' +
      '<section class="dcard glass danger w6 rv" style="--d:1"><h3>' + esc(MV.t('dash.delete', 'Delete my account')) + '</h3><p class="sub">' + esc(MV.t('dash.delete.d', 'Erases your profile, votes, invitations and unpublished ideas and removes your login. Counts update immediately. This cannot be undone.')) + '</p>' +
      '<div class="msg" id="dmsg" role="alert"></div><div class="fld"><label for="d-c">' + esc(MV.t('dash.delete.c', 'Type DELETE to confirm')) + '</label><input id="d-c" autocomplete="off"></div><button class="btn btn-danger btn-sm" type="button" id="delete">' + esc(MV.t('dash.delete.go', 'Permanently delete')) + '</button></section></div>';
    MV.reveal(root); bind(d, url);
  }

  function bind(d, url) {
    MV.countries().then(function (list) {
      var sel = $('#s-co'); sel.innerHTML = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return '<option value="' + c.code + '">' + esc(c.name) + '</option>'; }).join(''); sel.value = d.profile.country_code;
    });
    MV.bindShare($('#share-btns'), { url: url, kind: 'referral', onLog: function (n) { var e = $('[data-r="invites"]'); if (e) e.textContent = MV.num(n); } });
    $('#ref-copy').onclick = function () { MV.copy(url); MV.rpc('mv_log_invite', { p_channel: 'copy' }, { auth: true }).catch(function () {}); };
    var tag = (d.profile.is_founding ? 'Founding Contributor' : 'Contributor') + (d.profile.founding_number ? ' Nº ' + MV.pad(d.profile.founding_number) : '');
    MV.board().then(function (rows) { return rows.filter(function (r) { return r.code === d.country.code; })[0] || {}; }).catch(function () { return {}; }).then(function (r) {
      return window.MVShare.card({ tag: tag, countryCode: d.country.code, lat: r.lat, lng: r.lng });
    }).then(function (cv) {
      cv.id = 'card-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Your Trillion Euro share graphic'); $('#card-canvas').replaceWith(cv);
      $('#card-dl').onclick = function () { window.MVShare.download(cv, 'trillion-euro.png'); MV.rpc('mv_log_invite', { p_channel: 'card' }, { auth: true }).catch(function () {}); };
      $('#card-share').onclick = function () { window.MVShare.shareFile(cv, MV.shareText(), url).catch(function () {}); };
    });
    $('#signout').onclick = function () { MV.signOut().then(function () { location.href = '/'; }); };
    $('#export').onclick = function () {
      MV.rpc('mv_export_my_data', {}, { auth: true }).then(function (j) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })); a.download = 'trillion-euro-my-data.json'; document.body.appendChild(a); a.click(); a.remove();
      }).catch(function (e) { MV.toast(e.message); });
    };
    $('#settings').addEventListener('submit', function (e) {
      e.preventDefault(); var m = $('#smsg'); m.className = 'msg';
      MV.rpc('mv_update_profile', { p_full_name: $('#s-fn').value, p_display_name: $('#s-dn').value, p_country: $('#s-co').value, p_marketing: $('#s-mk').checked }, { auth: true })
        .then(function (nd) { m.className = 'msg ok show'; m.textContent = MV.t('dash.saved', 'Saved.'); render(nd); }).catch(function (err) { m.className = 'msg err show'; m.textContent = err.message; });
    });
    $('#delete').onclick = function () {
      var m = $('#dmsg'); m.className = 'msg';
      if ($('#d-c').value.trim() !== 'DELETE') { m.className = 'msg err show'; m.textContent = MV.t('dash.delete.type', 'Type DELETE in capitals to confirm.'); return; }
      MV.rpc('mv_delete_account', {}, { auth: true }).then(function () { return MV.signOut(); }).then(function () { location.href = '/?deleted=1'; }).catch(function (err) { m.className = 'msg err show'; m.textContent = err.message; });
    };
  }

  // Accounts that exist without a contributor profile (e.g. created for another Trillion products) can complete one here.
  function completeProfile() {
    root.innerHTML = '<div class="gate glass" style="text-align:left"><h2 style="font-size:clamp(28px,4vw,42px);text-align:center">' + esc(MV.t('dash.complete', 'Complete your profile')) + '</h2><p class="muted" style="text-align:center;margin:14px 0 26px">' + esc(MV.t('dash.complete.d', 'You are signed in but have not joined the movement yet.')) + '</p>' +
      '<div class="msg" id="cmsg" role="alert"></div><form id="cf" novalidate><div class="fld"><label for="c-fn">' + esc(MV.t('f.name', 'Full name')) + '</label><input id="c-fn" maxlength="80"></div><div class="fld"><label for="c-dn">' + esc(MV.t('f.display', 'Display name')) + ' <small>' + esc(MV.t('f.opt', 'optional')) + '</small></label><input id="c-dn" maxlength="40"></div>' +
      '<div class="fld"><label for="c-co">' + esc(MV.t('f.country', 'Your country')) + '</label><select id="c-co"><option value="">' + esc(MV.t('f.country.ph', 'Choose your country…')) + '</option></select></div>' +
      '<label class="chk"><input type="checkbox" id="c-t"><span>' + MV.t('f.terms', 'I am 16 or over and I accept the <a href="/terms" target="_blank" rel="noopener">terms</a> and have read the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.') + '</span></label>' +
      '<label class="chk"><input type="checkbox" id="c-m"><span>' + esc(MV.t('f.marketing.s', 'Send me occasional movement updates by email.')) + '</span></label><button class="btn btn-gold" type="submit" style="width:100%">' + esc(MV.t('join.go', 'Become a founding contributor')) + '</button></form></div>';
    MV.countries().then(function (list) { $('#c-co').insertAdjacentHTML('beforeend', list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return '<option value="' + c.code + '">' + esc(c.name) + '</option>'; }).join('')); });
    $('#cf').addEventListener('submit', function (e) {
      e.preventDefault(); var m = $('#cmsg'); m.className = 'msg';
      MV.rpc('mv_join', { p_full_name: $('#c-fn').value, p_display_name: $('#c-dn').value, p_country: $('#c-co').value, p_marketing: $('#c-m').checked, p_ref: MV.getRef(), p_terms: $('#c-t').checked }, { auth: true })
        .then(function (d) { render(d); }).catch(function (err) { m.className = 'msg err show'; m.textContent = err.message; });
    });
  }

  MV.dashboard().then(function (d) { if (!d.has_profile) completeProfile(); else render(d); }).catch(function (err) {
    if (err.code === 'AUTH_REQUIRED' || err.status === 401) gate(MV.t('dash.expired', 'Please sign in again'), MV.t('dash.expired.d', 'Your session has ended.'), '<a class="btn btn-gold" href="/join?mode=signin">' + esc(MV.t('join.signin', 'Sign in')) + '</a>');
    else gate(MV.t('dash.err', 'The dashboard could not be loaded'), err.message, '<button class="btn btn-gold" onclick="location.reload()">Try again</button>');
  });
})();
