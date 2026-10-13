/* Founder dashboard. Every action calls a te_admin_* function that re-checks admin status
   on the server; the UI hiding things is convenience, not security. All output escaped. */
(function () {
  'use strict';
  var T = window.TE, E = T.esc;
  var sb = window.supabase.createClient(T.SUPABASE_URL, T.KEY, { auth: { persistSession: true, storageKey: 'te-admin-auth' } });
  var token = null, tab = 'overview';
  function call(fn, args) { return T.rpc(fn, args || {}, { token: token }); }
  function show(id) { ['login', 'denied', 'app'].forEach(function (x) { T.$('#' + x).hidden = x !== id; }); }

  sb.auth.onAuthStateChange(function (_e, s) { boot(s); });
  sb.auth.getSession().then(function (r) { boot(r.data.session); });
  var booted = null;
  function boot(s) {
    if (!s) { token = null; show('login'); return; }
    if (booted === s.access_token) return; booted = s.access_token; token = s.access_token;
    call('te_is_admin').then(function (ok) {
      if (!ok) return show('denied');
      T.$('#who').textContent = s.user.email; show('app'); render();
    }).catch(function () { show('denied'); });
  }
  T.$('#lf').addEventListener('submit', function (e) {
    e.preventDefault();
    var em = T.$('#le').value.trim(), pw = T.$('#lp').value, out = T.$('#lerr'); out.textContent = '';
    var p = pw ? sb.auth.signInWithPassword({ email: em, password: pw })
      : sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + '/admin', shouldCreateUser: false } });
    p.then(function (r) {
      if (r.error) out.textContent = r.error.message;
      else if (!pw) out.textContent = 'Check your email for a sign-in link.';
    });
  });
  function signOut() { sb.auth.signOut().then(function () { booted = null; show('login'); }); }
  T.$('#so').onclick = signOut; T.$('#so2').onclick = signOut;
  T.$$('.tabs button').forEach(function (b) {
    b.onclick = function () { T.$$('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); tab = b.getAttribute('data-t'); render(); };
  });
  var P = function () { return T.$('#panel'); };
  function fail(e) { P().innerHTML = '<div class="notice warn">' + E(e.message) + '</div>'; }
  function done(msg) { T.toast(msg || 'Saved'); render(); }
  function errToast(e) { T.toast(e.message); }

  function render() {
    P().innerHTML = '<span class="skeleton" style="display:block;height:160px"></span>';
    ({ overview: overview, entries: entries, queue: queue, journal: journal, milestones: milestones, metrics: metrics, settings: settingsTab, countries: countriesTab, audit: audit })[tab]();
  }

  function overview() {
    call('te_admin_overview').then(function (o) {
      var k = [['Active entries', o.entries_active], ['Awaiting moderation', o.entries_pending_moderation], ['Refunded', o.entries_refunded],
        ['Revenue (active)', T.money(o.revenue_cents, o.settings.currency)], ['Drafts (7d)', o.drafts_7d], ['Checkouts started (7d)', o.checkouts_7d],
        ['Waitlist', o.waitlist], ['Open reports', o.open_reports], ['Open privacy requests', o.open_privacy], ['Open messages', o.open_messages],
        ['Referral visits counted', o.ref_clicks_valid], ['Referral visits flagged', o.ref_clicks_flagged]];
      P().innerHTML = '<div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">' + k.map(function (x) {
        return '<div class="stat" style="border-left:0;padding-left:0"><div class="v num" style="font-size:34px">' + E(x[1]) + '</div><div class="l">' + E(x[0]) + '</div></div>'; }).join('') + '</div>' +
        '<p class="small muted" style="margin-top:16px">Payments: <strong>' + (o.settings.payments_enabled ? 'ENABLED in database' : 'disabled') + '</strong>. Checkout also requires the server environment gate (TE_PAYMENTS_LIVE and Stripe keys).</p>';
    }).catch(fail);
  }

  function entries(q, st) {
    q = q || ''; st = st || '';
    call('te_admin_entries', { p_q: q || null, p_status: st || null, p_limit: 100, p_offset: 0 }).then(function (rows) {
      P().innerHTML = '<form id="ef" class="toolbar"><div class="q"><input id="eq" type="search" placeholder="Nickname, email or number" value="' + E(q) + '" aria-label="Search entries"></div>' +
        '<div><select id="es" aria-label="Filter"><option value="">All</option><option value="pending">Awaiting moderation</option><option value="approved">Approved</option><option value="hidden">Hidden</option><option value="refunded">Refunded</option><option value="removed">Removed</option></select></div><div><button class="btn btn-line btn-sm" type="submit">Search</button></div></form>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Nº</th><th>Entry</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          return '<tr><td class="num">' + r.entry_number + '</td><td><strong>' + E(r.nickname) + '</strong> · ' + E(r.country) + '<br><span class="small muted">' + E(r.email) +
            (r.real_name ? ' · real name: ' + E(r.real_name) + (r.show_real_name ? ' (public)' : ' (private)') : '') + '</span>' +
            (r.message ? '<br><span class="small">“' + E(r.message) + '”' + (r.message_hidden ? ' (hidden)' : '') + '</span>' : '') + '</td>' +
            '<td class="small">' + E(r.status) + '<br>' + E(r.moderation) + '<br>' + T.money(r.amount_cents, r.currency) + '</td><td>' +
            ['approve', 'hide', 'hide_message', 'show_message', 'hide_real_name', 'remove', 'erase_personal'].map(function (a) {
              return '<button class="btn btn-line btn-sm" style="margin:2px" data-a="' + a + '" data-n="' + r.entry_number + '">' + a.replace(/_/g, ' ') + '</button>'; }).join('') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="muted">No entries match.</td></tr>') + '</tbody></table></div>';
      T.$('#es').value = st;
      T.$('#ef').onsubmit = function (e) { e.preventDefault(); entries(T.$('#eq').value.trim(), T.$('#es').value); };
      P().onclick = function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return;
        var a = b.getAttribute('data-a'), n = b.getAttribute('data-n');
        if ((a === 'remove' || a === 'erase_personal') && !confirm(a.replace('_', ' ') + ' entry ' + n + '? This cannot be undone from the dashboard.')) return;
        var note = a === 'remove' || a === 'erase_personal' || a === 'hide' ? prompt('Note for the audit log (reason):') : null;
        call('te_admin_moderate', { p_entry: Number(n), p_action: a, p_note: note }).then(function () { T.toast('Done'); entries(q, st); }).catch(errToast);
      };
    }).catch(fail);
  }

  function queue() {
    call('te_admin_queue').then(function (d) {
      function tbl(kind, rows, cols) {
        return '<h3 style="margin:28px 0 12px">' + E(kind[0].toUpperCase() + kind.slice(1)) + 's</h3><div class="table-wrap"><table class="data"><tbody>' + (rows.length ? rows.map(function (r) {
          return '<tr><td class="small">' + E(T.date(r.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + cols(r) + '</td><td class="small">' + E(r.status) + '</td><td>' +
            (r.status === 'open' ? (kind === 'message' ? '<button class="btn btn-line btn-sm" data-k="message" data-id="' + r.id + '" data-s="closed">Close</button>'
              : '<button class="btn btn-line btn-sm" data-k="' + kind + '" data-id="' + r.id + '" data-s="' + (kind === 'report' ? 'actioned' : 'completed') + '">Resolve</button> <button class="btn btn-line btn-sm" data-k="' + kind + '" data-id="' + r.id + '" data-s="' + (kind === 'report' ? 'dismissed' : 'rejected') + '">' + (kind === 'report' ? 'Dismiss' : 'Reject') + '</button>') : E(r.resolution || '')) + '</td></tr>';
        }).join('') : '<tr><td class="muted">Nothing here.</td></tr>') + '</tbody></table></div>';
      }
      P().innerHTML = tbl('report', d.reports, function (r) { return 'Entry ' + E(r.entry_number) + ' · <strong>' + E(r.reason) + '</strong><br><span class="small">' + E(r.details || '') + '</span>' + (r.email ? '<br><span class="small muted">' + E(r.email) + '</span>' : ''); }) +
        tbl('privacy', d.privacy, function (r) { return '<strong>' + E(r.kind) + '</strong> · entry ' + E(r.entry_number || '?') + ' · ' + E(r.email) + '<br><span class="small">' + E(r.details || '') + '</span><br><span class="small muted">Verify the email matches the entry before acting (Entries tab search by email).</span>'; }) +
        tbl('message', d.messages, function (r) { return '<strong>' + E(r.topic) + '</strong> · ' + E(r.name || '') + ' &lt;' + E(r.email) + '&gt;<br><span class="small">' + E(r.body) + '</span>'; });
      P().onclick = function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        var res = b.getAttribute('data-k') === 'message' ? null : prompt('Resolution note:');
        call('te_admin_resolve', { p_kind: b.getAttribute('data-k'), p_id: Number(b.getAttribute('data-id')), p_status: b.getAttribute('data-s'), p_resolution: res }).then(function () { done('Updated'); }).catch(errToast);
      };
    }).catch(fail);
  }

  var cache = null;
  function loadAll() { return call('te_admin_journal_all').then(function (d) { cache = d; return d; }); }
  function journal() {
    loadAll().then(function (d) {
      P().innerHTML = '<div class="grid2"><div><h3 style="margin-bottom:12px">Updates</h3><ul class="list-x" style="list-style:none">' + (d.journal.length ? d.journal.map(function (j) {
        return '<li><a href="#" data-j="' + j.id + '">' + E(j.title) + '</a> <span class="small muted">· ' + E(j.status) + (j.publish_at ? ' · ' + E(T.date(j.publish_at)) : '') + '</span></li>'; }).join('') : '<li class="muted">No updates yet.</li>') +
        '</ul><button class="btn btn-gold btn-sm" id="jn" style="margin-top:16px">New update</button></div><div id="jed"></div></div>';
      T.$('#jn').onclick = function () { editor({}); };
      P().querySelectorAll('[data-j]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); editor(d.journal.filter(function (j) { return j.id === a.getAttribute('data-j'); })[0]); }; });
    }).catch(fail);
  }
  function editor(j) {
    var pa = j.publish_at ? new Date(j.publish_at) : null;
    T.$('#jed').innerHTML = '<form id="jf" class="card">' +
      fld('Title', '<input id="jt" required maxlength="140" value="' + E(j.title || '') + '">') +
      fld('Slug (a-z, 0-9, hyphens)', '<input id="js" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" value="' + E(j.slug || '') + '">') +
      fld('Excerpt', '<textarea id="jx" maxlength="300" style="min-height:70px">' + E(j.excerpt || '') + '</textarea>') +
      fld('Body (blank line = paragraph, **bold**, “## ” heading)', '<textarea id="jb" style="min-height:260px">' + E(j.body || '') + '</textarea>') +
      fld('Cover image URL (https, optional)', '<input id="jc" type="url" value="' + E(j.cover_url || '') + '">') +
      fld('Categories (comma-separated)', '<input id="jk" value="' + E((j.categories || []).join(', ')) + '">') +
      '<div class="grid2">' + fld('Status', '<select id="jst"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select>') +
      fld('Publish at (scheduled)', '<input id="jp" type="datetime-local" value="' + (pa ? new Date(pa - pa.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '') + '">') + '</div>' +
      '<button class="btn btn-gold btn-sm" type="submit">Save</button> ' + (j.id ? '<button class="btn btn-line btn-sm" type="button" id="jdel">Delete</button>' : '') + '</form>';
    T.$('#jst').value = j.status || 'draft';
    T.$('#jt').oninput = function () { if (!j.id) T.$('#js').value = T.$('#jt').value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); };
    T.$('#jf').onsubmit = function (e) {
      e.preventDefault();
      call('te_admin_journal_save', { p_id: j.id || null, p_slug: T.$('#js').value.trim(), p_title: T.$('#jt').value.trim(), p_excerpt: T.$('#jx').value.trim(), p_body: T.$('#jb').value,
        p_cover_url: T.$('#jc').value.trim(), p_categories: T.$('#jk').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        p_status: T.$('#jst').value, p_publish_at: T.$('#jp').value ? new Date(T.$('#jp').value).toISOString() : null }).then(function () { done(); }).catch(errToast);
    };
    if (j.id) T.$('#jdel').onclick = function () { if (confirm('Delete this update?')) call('te_admin_journal_delete', { p_id: j.id }).then(function () { done('Deleted'); }).catch(errToast); };
  }
  function fld(l, input) { var id = (input.match(/id="([^"]+)"/) || [])[1]; return '<div class="field"><label for="' + id + '">' + l + '</label>' + input + '</div>'; }

  function milestones() {
    loadAll().then(function (d) {
      P().innerHTML = '<div class="grid2"><div><ul class="timeline">' + (d.milestones.length ? d.milestones.map(function (m) {
        return '<li class="' + E(m.kind) + '"><time>' + E(m.occurred_on) + '</time><h3><a href="#" data-m="' + m.id + '">' + E(m.title) + '</a></h3><span class="small muted">' + E(m.kind) + (m.verified ? ' · verified' : '') + (m.published ? ' · published' : ' · draft') + '</span></li>'; }).join('') : '<li class="muted">None yet.</li>') +
        '</ul><button class="btn btn-gold btn-sm" id="mn">New milestone</button></div><div id="med"></div></div>';
      function ed(m) {
        T.$('#med').innerHTML = '<form id="mf" class="card">' + fld('Date it happened', '<input id="md" type="date" required value="' + E(m.occurred_on || '') + '">') +
          fld('Title', '<input id="mt" required maxlength="140" value="' + E(m.title || '') + '">') + fld('Detail', '<textarea id="mx" maxlength="1000">' + E(m.detail || '') + '</textarea>') +
          fld('Kind', '<select id="mk"><option value="launch">Launch</option><option value="milestone">Milestone</option><option value="setback">Setback</option><option value="update">Update</option></select>') +
          fld('Evidence URL (https, optional)', '<input id="mu" type="url" value="' + E(m.source_url || '') + '">') + fld('Related journal slug (optional)', '<input id="mj" value="' + E(m.journal_slug || '') + '">') +
          '<label class="check"><input type="checkbox" id="mv"' + (m.verified ? ' checked' : '') + '> <span>Verified by evidence (not just founder-reported)</span></label>' +
          '<label class="check"><input type="checkbox" id="mp"' + (m.published ? ' checked' : '') + '> <span>Published</span></label>' +
          '<button class="btn btn-gold btn-sm" type="submit">Save</button> ' + (m.id ? '<button class="btn btn-line btn-sm" type="button" id="mdel">Delete</button>' : '') + '</form>';
        T.$('#mk').value = m.kind || 'milestone';
        T.$('#mf').onsubmit = function (e) {
          e.preventDefault();
          call('te_admin_milestone_save', { p_id: m.id || null, p_occurred_on: T.$('#md').value, p_title: T.$('#mt').value.trim(), p_detail: T.$('#mx').value.trim(), p_kind: T.$('#mk').value,
            p_verified: T.$('#mv').checked, p_source_url: T.$('#mu').value.trim(), p_journal_slug: T.$('#mj').value.trim(), p_published: T.$('#mp').checked }).then(function () { done(); }).catch(errToast);
        };
        if (m.id) T.$('#mdel').onclick = function () { if (confirm('Delete?')) call('te_admin_delete', { p_kind: 'milestone', p_id: m.id }).then(function () { done('Deleted'); }).catch(errToast); };
      }
      T.$('#mn').onclick = function () { ed({}); };
      P().querySelectorAll('[data-m]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); ed(d.milestones.filter(function (m) { return m.id === a.getAttribute('data-m'); })[0]); }; });
    }).catch(fail);
  }

  function metrics() {
    loadAll().then(function (d) {
      P().innerHTML = '<div class="notice" style="margin-bottom:20px"><strong>Keep measures separate.</strong> Only “personal net worth” drives the homepage progress bar. Never enter a company’s headline valuation as personal net worth — record your owned share, valued conservatively, and explain the method.</div>' +
        '<div class="grid2"><div><div class="table-wrap"><table class="data"><tbody>' + (d.metrics.length ? d.metrics.map(function (m) {
          return '<tr><td><a href="#" data-x="' + m.id + '">' + E(m.kind.replace(/_/g, ' ')) + '</a><br><span class="small muted">' + E(m.label) + '</span></td><td class="r">' + E(m.amount) + ' ' + E(m.currency) + '</td><td class="small">' + E(m.as_of) + (m.published ? '' : ' · draft') + '</td></tr>'; }).join('') : '<tr><td class="muted">No metrics yet.</td></tr>') +
        '</tbody></table></div><button class="btn btn-gold btn-sm" id="xn" style="margin-top:16px">New metric</button></div><div id="xed"></div></div>';
      function ed(m) {
        T.$('#xed').innerHTML = '<form id="xf" class="card">' + fld('Measure', '<select id="xk"><option value="personal_net_worth">Personal net worth</option><option value="company_equity_value">Company equity value</option><option value="company_revenue">Company revenue</option><option value="cash_holdings">Cash holdings</option><option value="other">Other</option></select>') +
          fld('Label', '<input id="xl" required maxlength="120" value="' + E(m.label || '') + '">') + '<div class="grid2">' + fld('Amount', '<input id="xa" type="number" step="0.01" required value="' + E(m.amount == null ? '' : m.amount) + '">') +
          fld('Currency', '<input id="xc" maxlength="3" required value="' + E(m.currency || 'EUR') + '">') + '</div>' + fld('As of date', '<input id="xd" type="date" required value="' + E(m.as_of || '') + '">') +
          fld('Source (what evidence?)', '<textarea id="xs" required minlength="3" maxlength="500">' + E(m.source || '') + '</textarea>') + fld('Methodology', '<textarea id="xm" required minlength="10" maxlength="4000">' + E(m.methodology || '') + '</textarea>') +
          '<label class="check"><input type="checkbox" id="xp"' + (m.published ? ' checked' : '') + '> <span>Published</span></label><button class="btn btn-gold btn-sm" type="submit">Save</button> ' + (m.id ? '<button class="btn btn-line btn-sm" type="button" id="xdel">Delete</button>' : '') + '</form>';
        T.$('#xk').value = m.kind || 'personal_net_worth';
        T.$('#xf').onsubmit = function (e) {
          e.preventDefault();
          call('te_admin_metric_save', { p_id: m.id || null, p_kind: T.$('#xk').value, p_label: T.$('#xl').value.trim(), p_amount: Number(T.$('#xa').value), p_currency: T.$('#xc').value.trim().toUpperCase(),
            p_as_of: T.$('#xd').value, p_source: T.$('#xs').value.trim(), p_methodology: T.$('#xm').value.trim(), p_published: T.$('#xp').checked }).then(function () { done(); }).catch(errToast);
        };
        if (m.id) T.$('#xdel').onclick = function () { if (confirm('Delete?')) call('te_admin_delete', { p_kind: 'metric', p_id: m.id }).then(function () { done('Deleted'); }).catch(errToast); };
      }
      T.$('#xn').onclick = function () { ed({}); };
      P().querySelectorAll('[data-x]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); ed(d.metrics.filter(function (m) { return m.id === a.getAttribute('data-x'); })[0]); }; });
    }).catch(fail);
  }

  function settingsTab() {
    call('te_admin_overview').then(function (o) {
      var s = o.settings;
      P().innerHTML = '<div class="grid2"><form id="sf" class="card">' +
        fld('Operator legal name (required before payments)', '<input id="s-on" maxlength="300" value="' + E(s.operator_name || '') + '">') +
        fld('Operator geographic address (required before payments)', '<input id="s-oa" maxlength="300" value="' + E(s.operator_address || '') + '">') +
        fld('Operator contact email', '<input id="s-oe" type="email" maxlength="300" value="' + E(s.operator_email || '') + '">') +
        fld('Challenge start date (leave blank until real)', '<input id="s-sd" type="date" value="' + E(s.challenge_started_on || '') + '">') +
        '<div class="grid2">' + fld('Price (cents)', '<input id="s-pc" type="number" min="100" max="100000" value="' + E(s.price_cents) + '">') + fld('Currency', '<input id="s-cu" maxlength="3" value="' + E(s.currency) + '">') + '</div>' +
        '<label class="check"><input type="checkbox" id="s-wl"' + (s.waitlist_enabled ? ' checked' : '') + '> <span>Waitlist enabled</span></label>' +
        '<button class="btn btn-gold btn-sm" type="submit">Save settings</button></form>' +
        '<div class="card"><h3>Payments</h3><p class="small">Database flag: <strong>' + (s.payments_enabled ? 'ON' : 'OFF') + '</strong></p>' +
        '<p class="small muted">Turning this on is necessary but not sufficient: the server also needs TE_PAYMENTS_LIVE=true, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and SUPABASE_SECRET_KEY. Only enable after legal review and Stripe approval — see docs/compliance/trillioneuro-launch.md.</p>' +
        '<button class="btn ' + (s.payments_enabled ? 'btn-line' : 'btn-gold') + ' btn-sm" id="s-pay">' + (s.payments_enabled ? 'Disable payments' : 'Enable payments') + '</button></div></div>';
      T.$('#sf').onsubmit = function (e) {
        e.preventDefault();
        var str = function (v) { v = v.trim(); return v ? v : null; };
        var pairs = [['operator_name', str(T.$('#s-on').value)], ['operator_address', str(T.$('#s-oa').value)], ['operator_email', str(T.$('#s-oe').value)],
          ['challenge_started_on', T.$('#s-sd').value || null], ['price_cents', Number(T.$('#s-pc').value)], ['currency', T.$('#s-cu').value.trim().toLowerCase()], ['waitlist_enabled', T.$('#s-wl').checked]];
        pairs.reduce(function (p, kv) { return p.then(function () { return JSON.stringify(s[kv[0]]) === JSON.stringify(kv[1]) ? null : call('te_admin_set_setting', { p_key: kv[0], p_value: kv[1] }); }); }, Promise.resolve())
          .then(function () { done(); }).catch(errToast);
      };
      T.$('#s-pay').onclick = function () {
        var on = !s.payments_enabled;
        if (on && !confirm('Enable paid entries? Confirm legal review is complete and Stripe has approved the account.')) return;
        call('te_admin_set_setting', { p_key: 'payments_enabled', p_value: on }).then(function () { done(on ? 'Payments enabled' : 'Payments disabled'); }).catch(errToast);
      };
    }).catch(fail);
  }

  function countriesTab() {
    call('te_country_stats').then(function (rows) {
      P().innerHTML = '<p class="small muted">Edit sourced population figures. Always give the year and source.</p><input id="cf" type="search" placeholder="Filter" aria-label="Filter countries" style="margin:12px 0">' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Country</th><th class="r">Entries</th><th>Population</th><th>Year</th><th>Source</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr data-row="' + E(r.name.toLowerCase()) + '"><td>' + T.flag(r.code) + ' ' + E(r.name) + '</td><td class="r">' + r.entries + '</td><td><input data-f="pop" type="number" value="' + E(r.population || '') + '" style="padding:6px;min-width:120px"></td>' +
            '<td><input data-f="yr" type="number" value="' + E(r.population_year || '') + '" style="padding:6px;width:80px"></td><td><input data-f="src" value="' + E(r.population_source || '') + '" style="padding:6px;min-width:200px"></td>' +
            '<td><button class="btn btn-line btn-sm" data-c="' + r.code + '">Save</button></td></tr>'; }).join('') + '</tbody></table></div>';
      T.$('#cf').oninput = function () { var q = this.value.toLowerCase(); P().querySelectorAll('[data-row]').forEach(function (tr) { tr.hidden = tr.getAttribute('data-row').indexOf(q) < 0; }); };
      P().onclick = function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return; var tr = b.closest('tr');
        call('te_admin_country_save', { p_code: b.getAttribute('data-c'), p_population: Number(tr.querySelector('[data-f=pop]').value) || null,
          p_year: Number(tr.querySelector('[data-f=yr]').value) || null, p_source: tr.querySelector('[data-f=src]').value, p_active: true }).then(function () { T.toast('Saved'); }).catch(errToast);
      };
    }).catch(fail);
  }

  function audit() {
    call('te_admin_audit', { p_limit: 200 }).then(function (rows) {
      P().innerHTML = '<div class="share-row" style="margin:0 0 20px"><button class="btn btn-gold btn-sm" id="ex">Export public archive (JSON)</button><button class="btn btn-line btn-sm" id="exc">Export public archive (CSV)</button></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>' +
        rows.map(function (a) { return '<tr><td class="small">' + E(new Date(a.created_at).toLocaleString('en-IE')) + '</td><td class="small">' + E(String(a.actor).slice(0, 8)) + '</td><td>' + E(a.action) + '</td><td>' + E(a.target || '') + '</td><td class="small">' + E(a.detail ? JSON.stringify(a.detail) : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
      function dl(name, type, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; a.click(); }
      T.$('#ex').onclick = function () { call('te_admin_export').then(function (d) { dl('founders-record-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json', JSON.stringify(d, null, 2)); }).catch(errToast); };
      T.$('#exc').onclick = function () {
        call('te_admin_export').then(function (d) {
          var cols = ['entry_number', 'nickname', 'real_name', 'country', 'message', 'entered_at'];
          var csv = cols.join(',') + '\n' + d.entries.map(function (e) { return cols.map(function (c) { var v = e[c] == null ? '' : String(e[c]); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
          dl('founders-record-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv', csv);
        }).catch(errToast);
      };
    }).catch(fail);
  }
})();
