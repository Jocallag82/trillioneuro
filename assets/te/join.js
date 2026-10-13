(function () {
  'use strict';
  var T = window.TE, TERMS_VERSION = '2026-10-14';
  var form = T.$('#join'), steps = T.$$('.step', form), N = steps.length;
  var back = T.$('#back'), next = T.$('#next'), label = T.$('#step-label');
  var KEY = 'te_join', st = {};
  try { st = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) {}
  var cur = 1, settings = null, countryNames = {};

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function val(id) { return T.$('#' + id).value.trim(); }
  function strip(s) { return s.replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function len(s) { return Array.from(s).length; }

  // restore
  ['nickname', 'real_name', 'country', 'message', 'email'].forEach(function (k) { if (st[k]) T.$('#' + k).value = st[k]; });
  T.$('#show_real_name').checked = !!st.show_real_name;
  var qc = (T.qs('country') || '').toUpperCase();

  T.countries().then(function (cs) {
    cs.forEach(function (c) { countryNames[c.code] = c.name; });
    T.$('#country').insertAdjacentHTML('beforeend', cs.map(function (c) { return '<option value="' + c.code + '">' + T.esc(c.name) + '</option>'; }).join(''));
    T.$('#country').value = st.country || (countryNames[qc] ? qc : '');
    live();
  });
  T.settings().then(function (s) { settings = s; T.$('#price').textContent = T.money(s.price_cents, s.currency); setNextLabel(); })
    .catch(function () { T.$('#price').textContent = 'Price unavailable'; });

  function counters() {
    T.$$('.counter').forEach(function (c) {
      var f = T.$('#' + c.getAttribute('data-for'));
      c.textContent = len(f.value) + ' / ' + f.maxLength;
    });
  }
  function current() {
    return {
      nickname: strip(val('nickname')), real_name: strip(val('real_name')) || null,
      show_real_name: T.$('#show_real_name').checked && !!strip(val('real_name')),
      country: T.$('#country').value, country_name: countryNames[T.$('#country').value] || '',
      message: strip(val('message')) || null
    };
  }
  function live() {
    var e = current(); e.nickname = e.nickname || 'Your nickname';
    if (!e.show_real_name) e.real_name = null;
    T.$('#live-cert').innerHTML = window.TECert.html(e, { preview: true });
    counters();
  }
  form.addEventListener('input', function () {
    st.nickname = val('nickname'); st.real_name = val('real_name'); st.show_real_name = T.$('#show_real_name').checked;
    st.country = T.$('#country').value; st.message = val('message'); st.email = val('email');
    st.draft_id = null; save(); live();
  });

  function err(id, msg, field) {
    T.$('#' + id).textContent = msg || '';
    if (field) T.$('#' + field).setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && field) T.$('#' + field).focus();
    return !msg;
  }
  function validate(step) {
    var e = current();
    if (step === 2) return err('nick-err', len(e.nickname) < 2 || len(e.nickname) > 32 ? 'Your nickname needs 2–32 characters (angle brackets are removed).' : '', 'nickname');
    if (step === 3) return err('real-err', e.real_name && (len(e.real_name) < 2 || len(e.real_name) > 60) ? 'Real name must be 2–60 characters, or leave it blank.' : '', 'real_name');
    if (step === 4) return err('country-err', !e.country ? 'Choose a country from the list.' : '', 'country');
    if (step === 5) return err('msg-err', e.message && len(e.message) > 280 ? 'Keep your message to 280 characters.' : '', 'message');
    if (step === 7) {
      var email = val('email');
      if (!err('email-err', /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email) && email.length <= 254 ? '' : 'Enter a valid email address.', 'email')) return false;
      var ok = T.$('#ack_invest').checked && T.$('#ack_terms').checked && T.$('#ack_supply').checked;
      return err('ack-err', ok ? '' : 'Please confirm all three statements to continue.');
    }
    return true;
  }
  function setNextLabel() {
    if (cur === 1) next.textContent = 'Begin →';
    else if (cur < N) next.textContent = cur === 6 ? 'Looks right →' : 'Continue →';
    else next.textContent = settings && settings.payments_enabled ? 'Pay ' + T.money(settings.price_cents, settings.currency) + ' securely →' : 'Save my preview →';
  }
  function show(n, focus) {
    cur = Math.max(1, Math.min(N, n));
    steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== cur; });
    T.$$('#steps li').forEach(function (li, i) { li.className = i + 1 < cur ? 'done' : i + 1 === cur ? 'now' : ''; });
    label.textContent = 'Step ' + cur + ' of ' + N;
    back.hidden = cur === 1; setNextLabel();
    if (cur === 6) {
      var e = current(); if (!e.show_real_name) e.real_name = null;
      e.entry_number = 0;
      T.$('#preview-card').innerHTML = T.entryCard({ entry_number: 0, nickname: e.nickname, real_name: e.real_name, message: e.message, country: e.country, country_name: e.country_name, entered_at: new Date().toISOString() })
        .replace('href="/record/0"', 'aria-label="Entry preview"').replace(/^<a /, '<div ').replace(/<\/a>$/, '</div>').replace(T.no(0), 'Nº ______');
    }
    if (cur === 7) {
      var c = current();
      T.$('#pub-real').textContent = c.show_real_name ? ', and your real name (you chose to show it)' : '';
      T.$('#priv-real').textContent = c.real_name && !c.show_real_name ? ', your real name' : '';
    }
    history.replaceState(null, '', '#step-' + cur);
    if (focus) {
      var f = steps[cur - 1].querySelector('input:not([type=checkbox]), select, textarea');
      if (f) f.focus(); else { var h = steps[cur - 1].querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus(); }
    }
  }
  back.addEventListener('click', function () { show(cur - 1, true); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(cur)) return;
    if (cur < N) {
      // never let someone skip required steps via the hash
      for (var i = 2; i <= cur; i++) if (!validate(i)) { show(i, true); return; }
      show(cur + 1, true); return;
    }
    for (var j = 2; j <= 5; j++) if (!validate(j)) { show(j, true); return; }
    finish();
  });

  function busy(on, text) { next.disabled = on; next.setAttribute('aria-busy', on ? 'true' : 'false'); if (text) next.textContent = text; }

  function createDraft() {
    if (st.draft_id) return Promise.resolve(st.draft_id);
    var e = current();
    return T.rpc('te_create_draft', {
      p_nickname: e.nickname, p_country: e.country, p_email: val('email'), p_real_name: e.real_name,
      p_show_real_name: e.show_real_name, p_message: e.message, p_ref: T.getRef(),
      p_accept_terms: true, p_terms_version: TERMS_VERSION
    }).then(function (d) { st.draft_id = d.draft_id; save(); return d.draft_id; });
  }

  function finish() {
    var box = T.$('#pay-state'); box.innerHTML = '';
    busy(true, 'Saving…');
    T.rpc('te_public_settings').then(function (s) {
      settings = s;
      return createDraft().then(function (id) {
        if (!s.payments_enabled) return waitlist(id);
        busy(true, 'Opening secure checkout…');
        return fetch('/api/te-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft_id: id }) })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (x) {
            if (x.ok && x.d.url && /^https:\/\/checkout\.stripe\.com\//.test(x.d.url)) { T.track('checkout_start', {}); location.href = x.d.url; return; }
            if (x.d.error === 'PAYMENTS_DISABLED') return waitlist(id);
            if (x.d.error === 'PRICE_CHANGED' || x.d.error === 'DRAFT_EXPIRED') { st.draft_id = null; save(); throw new Error('The price or your session changed. Please review the price and press pay again.'); }
            throw new Error(x.d.message || 'Checkout could not be opened. Nothing was charged.');
          });
      });
    }).catch(function (e) {
      busy(false); setNextLabel();
      box.innerHTML = '<div class="notice warn" role="alert" style="margin-top:18px">' + T.esc(e.message) + '</div>';
    });
  }

  function waitlist(id) {
    busy(false); setNextLabel();
    form.hidden = true; T.$('#steps').hidden = true; label.hidden = true;
    var done = T.$('#done'); done.hidden = false;
    done.innerHTML = '<p class="kicker">Preview saved</p><h2 style="margin:12px 0 18px">Paid entries are not open yet.</h2>' +
      '<div class="notice" role="status"><strong>No payment was taken and no entry number has been assigned.</strong> The record opens for payment once the payment provider and the legal review have signed off.</div>' +
      '<p style="margin-top:24px">Want a heads-up the moment it opens? We’ll email <strong>' + T.esc(val('email')) + '</strong> once — no marketing list.</p>' +
      '<div class="share-row"><button class="btn btn-gold" type="button" id="wl">Notify me when entries open</button><button class="btn btn-line" type="button" id="edit">Edit my preview</button></div>' +
      '<div id="wl-msg" aria-live="polite"></div>';
    T.$('#wl').onclick = function () {
      this.disabled = true;
      T.rpc('te_join_waitlist', { p_email: val('email'), p_draft: id }).then(function () {
        T.$('#wl-msg').innerHTML = '<p class="notice ok" style="margin-top:18px">You’re on the list. One email when the record opens — that’s it.</p>'; T.track('waitlist_join', {});
      }).catch(function (e) { T.$('#wl').disabled = false; T.$('#wl-msg').innerHTML = '<p class="err">' + T.esc(e.message) + '</p>'; });
    };
    T.$('#edit').onclick = function () { done.hidden = true; form.hidden = false; T.$('#steps').hidden = false; label.hidden = false; show(2, true); };
    done.setAttribute('tabindex', '-1'); done.focus();
  }

  var m = location.hash.match(/^#step-(\d)$/);
  var start = m ? parseInt(m[1], 10) : 1;
  // resume only as far as the saved data is valid
  var ok = 1; for (var i = 2; i <= Math.min(start, 6); i++) { if (validateSilent(i)) ok = i; else break; }
  show(start > 1 ? Math.min(start, ok + 1, N) : 1, false);
  function validateSilent(i) {
    var e = current();
    if (i === 2) return len(e.nickname) >= 2 && len(e.nickname) <= 32;
    if (i === 4) return !!e.country || !!st.country;
    return true;
  }
  live();
})();
