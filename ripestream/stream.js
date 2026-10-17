/* RipeStream app — stream, communities, profiles and feed controls.
   Identity is the member key kept by the member page (rs_member_key). Every
   rule — who may read or post, rate limits, ownership, mutes — is enforced
   by the rsp_* functions in the database; this file only renders what they
   return. All user text goes in through textContent, never innerHTML. */
(function () {
  'use strict';

  var RPC = 'https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/';
  var FN = 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var STORE = 'rs_member_key';
  var main = document.getElementById('main');
  var nav = document.getElementById('nav');
  var me = null, key = null;

  try { key = localStorage.getItem(STORE); } catch (e) {}

  function track(name, data) { try { if (window.va) window.va('event', data ? { name: name, data: data } : { name: name }); } catch (e) {} }

  function rpc(name, args) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    var body = { p_key: key };
    for (var k in args) body[k] = args[k];
    return fetch(RPC + name, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      return res.json().catch(function () { return null; }).then(function (b) {
        if (res.ok) return b;
        var err = new Error((b && b.message) || 'HTTP ' + res.status);
        err.code = b && b.code;
        throw err;
      });
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function upload(f) {
    var fd = new FormData(); fd.append('key', key); fd.append('file', f);
    return fetch(FN + 'rsp-media', { method: 'POST', headers: { 'apikey': KEY }, body: fd }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) {
        if (res.ok && b && b.path) return b;
        throw new Error((b && b.message) || 'UPLOAD_FAILED: try again');
      });
    });
  }

  // Server messages look like "CODE: human text"; show the human part.
  function human(err) {
    var m = String(err && err.message || '');
    if (err && err.name === 'AbortError') return 'That took too long. Check your connection and try again.';
    if (err instanceof TypeError) return "Couldn't reach RipeStream. Check your connection.";
    var i = m.indexOf(': ');
    return /^[A-Z_]+: /.test(m) ? m.slice(i + 2).replace(/^./, function (c) { return c.toUpperCase(); }) + '.' : 'Something went wrong. Please try again.';
  }

  /* ── tiny DOM builder ── */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      var v = attrs[a];
      if (v == null || v === false) continue;
      if (a === 'text') el.textContent = v;
      else if (a.slice(0, 2) === 'on') el.addEventListener(a.slice(2), v);
      else el.setAttribute(a, v === true ? '' : v);
    }
    [].concat(kids || []).forEach(function (k) { if (k != null && k !== false) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return el;
  }
  function render(nodes) { main.replaceChildren.apply(main, [].concat(nodes)); }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  // Post text → DOM: @handles link to profiles, http(s) links open safely.
  function rich(text, cls) {
    var p = h('p', { class: cls || 'body' });
    var re = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})|(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g, last = 0, m;
    while ((m = re.exec(text))) {
      var start = m.index + (m[1] ? m[1].length : 0);
      if (start > last) p.appendChild(document.createTextNode(text.slice(last, start)));
      if (m[2]) p.appendChild(h('a', { href: '#/u/' + m[2].toLowerCase(), class: 'mention', text: '@' + m[2] }));
      else p.appendChild(h('a', { href: m[3], target: '_blank', rel: 'noopener noreferrer nofollow ugc', text: m[3] }));
      last = re.lastIndex;
    }
    if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)));
    return p;
  }

  var WHY = { yours: 'Your post', following: 'You follow them', community: 'From a community you joined', everyone: 'Everyone · newest first' };

  function busy(btn, on) { if (btn) { btn.disabled = on; btn.classList.toggle('busy', on); } }

  /* ── gates ── */
  function noKey() {
    nav.hidden = true;
    render(h('div', { class: 'card stack' }, [
      h('h1', { class: 'display', text: 'Open your member link first.' }),
      h('p', { class: 'lede', text: 'RipeStream uses the personal link we email you instead of a password. Open it on this device and you’ll come straight here.' }),
      h('p', {}, [h('a', { class: 'btn', href: '/member' }, 'Get my member link')]),
      h('p', { class: 'meta' }, ['Not a member yet? ', h('a', { href: '/#join' }, 'Join RipeStream'), '.'])
    ]));
  }
  function gateError(err) {
    var m = String(err && err.message || '');
    if (m.indexOf('INVALID_KEY') === 0) { try { localStorage.removeItem(STORE); } catch (e) {} key = null; return noKey(); }
    nav.hidden = true;
    render(h('div', { class: 'card stack' }, [
      h('h1', { class: 'display', text: m.indexOf('NOT_MEMBER') === 0 ? 'Your place isn’t confirmed yet.' : 'We couldn’t load your stream.' }),
      h('p', { class: 'lede', text: m.indexOf('NOT_MEMBER') === 0 ? 'Open the confirmation link in your email, or join with an invitation from a member.' : human(err) }),
      h('p', {}, [h('a', { class: 'btn', href: '/member' }, 'Go to my membership')])
    ]));
  }

  /* ── onboarding: choose a handle ── */
  function profileForm(intro) {
    var p = (me && me.profile) || {};
    var suggestion = p.handle || String(me && me.first_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    var hIn = h('input', { id: 'pf-h', value: suggestion, maxlength: 20, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', required: true, pattern: '[A-Za-z0-9_]{3,20}' });
    var nIn = h('input', { id: 'pf-n', value: p.name || (me && me.first_name) || '', maxlength: 40 });
    var bIn = h('textarea', { id: 'pf-b', maxlength: 280 }); bIn.value = p.bio || '';
    var err = h('p', { class: 'err' });
    var btn = h('button', { class: 'btn sm', type: 'submit', text: p.handle ? 'Save profile' : 'Start my stream' });
    return h('form', { class: intro ? 'card stack' : 'panel', onsubmit: function (e) {
      e.preventDefault(); err.textContent = ''; busy(btn, true);
      rpc('rsp_set_profile', { p_handle: hIn.value, p_name: nIn.value, p_bio: bIn.value }).then(function (r) {
        var first = !me.profile; me = r; busy(btn, false);
        if (first) { track('profile_created'); location.hash = '#/communities'; route(); } else toast('Profile saved');
      }).catch(function (x) { busy(btn, false); err.textContent = human(x); });
    } }, [
      intro ? h('h1', { class: 'display', text: 'Pick your handle.' }) : h('h2', { text: 'Profile' }),
      intro ? h('p', { class: 'lede', text: 'This is how people find and mention you. You can change it later.' }) : null,
      h('div', { class: 'field' }, [h('label', { for: 'pf-h' }, ['Handle', h('span', { text: '3–20 letters, numbers or _' })]), hIn]),
      h('div', { class: 'field' }, [h('label', { for: 'pf-n' }, ['Display name', h('span', { text: 'Optional' })]), nIn]),
      h('div', { class: 'field' }, [h('label', { for: 'pf-b' }, ['Bio', h('span', { text: 'Optional' })]), bIn]),
      err, h('div', { class: 'row' }, [btn])
    ]);
  }

  /* ── posts ── */
  function authorBits(a) {
    a = a || { handle: '?', name: 'Unknown' };
    return [
      h('span', { class: 'av', 'aria-hidden': 'true', text: initials(a.name) }),
      h('a', { class: 'nm', href: '#/u/' + a.handle, text: a.name }),
      h('span', { class: 'h', text: '@' + a.handle }),
      a.founding ? h('span', { class: 'fm', title: 'Founding Member #' + a.founding, text: 'Founding' }) : null
    ];
  }

  function postEl(p, ctx) {
    var thread = h('div', { class: 'thread', hidden: true });
    var cBtn = h('button', { type: 'button', 'aria-expanded': 'false', text: p.comments ? p.comments + (p.comments === 1 ? ' reply' : ' replies') : 'Reply' });
    var li = h('li', { class: 'post' }, [
      h('div', { class: 'ph' }, authorBits(p.author).concat([
        h('span', { class: 't', text: '· ' + ago(p.at), title: new Date(p.at).toLocaleString('en-GB') }),
        p.community ? h('a', { class: 't', href: '#/c/' + p.community.slug, text: 'in ' + p.community.name }) : null
      ])),
      rich(p.body),
      p.image ? h('a', { href: p.image, target: '_blank', rel: 'noopener', class: 'pimg' }, [h('img', { src: p.image, alt: 'Image shared by ' + ((p.author && p.author.name) || 'a member'), loading: 'lazy', decoding: 'async' })]) : null,
      h('div', { class: 'pf' }, [
        ctx !== 'single' ? h('a', { href: '#/p/' + p.id, text: 'Link', title: 'Open this post' }) : null,
        cBtn,
        ctx === 'feed' ? h('span', { class: 'why', title: 'Why you’re seeing this', text: WHY[p.why] || '' }) : null,
        p.mine ? h('button', { type: 'button', text: 'Delete', onclick: function () {
          if (!confirm('Delete this post?')) return;
          rpc('rsp_delete', { p_kind: 'post', p_id: p.id }).then(function () { li.remove(); toast('Post deleted'); }).catch(function (x) { toast(human(x)); });
        } }) : h('button', { type: 'button', text: 'Report', onclick: function () { report('post', p.id); } })
      ]),
      thread
    ]);
    cBtn.addEventListener('click', function () {
      var open = thread.hidden;
      thread.hidden = !open; cBtn.setAttribute('aria-expanded', String(open));
      if (open) loadThread(p, thread, cBtn);
    });
    return li;
  }

  function loadThread(p, box, cBtn) {
    box.replaceChildren(h('span', { class: 'skel', style: 'height:18px;width:40%' }));
    rpc('rsp_comments', { p_post: p.id }).then(function (list) { drawThread(p, box, list, cBtn); })
      .catch(function (x) { box.replaceChildren(h('p', { class: 'err', text: human(x) })); });
  }
  function drawThread(p, box, list, cBtn) {
    var ta = h('textarea', { maxlength: 1000, 'aria-label': 'Write a reply', placeholder: 'Write a reply' });
    var btn = h('button', { class: 'btn sm', type: 'submit', text: 'Reply' });
    var err = h('p', { class: 'err' });
    box.replaceChildren.apply(box, list.map(function (c) {
      var row = h('div', { class: 'cm' }, [
        h('div', { class: 'ph' }, authorBits(c.author).concat([h('span', { class: 't', text: '· ' + ago(c.at) }),
          c.mine ? h('button', { type: 'button', class: 't', text: 'Delete', onclick: function () {
            rpc('rsp_delete', { p_kind: 'comment', p_id: c.id }).then(function () { row.remove(); }).catch(function (x) { toast(human(x)); });
          } }) : h('button', { type: 'button', class: 't', text: 'Report', onclick: function () { report('comment', c.id); } })])),
        rich(c.body)
      ]);
      return row;
    }).concat([h('form', { class: 'reply', onsubmit: function (e) {
      e.preventDefault(); if (!ta.value.trim()) return; err.textContent = ''; busy(btn, true);
      rpc('rsp_comment', { p_post: p.id, p_body: ta.value }).then(function (l) {
        track('comment_created'); p.comments = l.length;
        cBtn.textContent = l.length + (l.length === 1 ? ' reply' : ' replies');
        drawThread(p, box, l, cBtn);
      }).catch(function (x) { busy(btn, false); err.textContent = human(x); });
    } }, [ta, err, h('div', { class: 'row' }, [btn])])]));
  }

  function report(kind, id) {
    var why = prompt('What’s wrong with this ' + kind + '? (spam, abuse, something else)');
    if (why === null) return;
    rpc('rsp_report', { p_kind: kind, p_id: id, p_reason: why }).then(function () { toast('Reported. Thanks — we review every report.'); }).catch(function (x) { toast(human(x)); });
  }

  function composer(list, community) {
    var ta = h('textarea', { maxlength: 2000, 'aria-label': 'Write a post', placeholder: community ? 'Post in ' + community.name : 'What’s worth sharing?' });
    var count = h('span', { class: 'count', text: '0 / 2000' });
    ta.addEventListener('input', function () { count.textContent = ta.value.length + ' / 2000'; });
    var sel = null;
    if (!community) {
      sel = h('select', { 'aria-label': 'Where to post' }, [h('option', { value: '', text: 'Everyone' })].concat(
        (me.communities || []).map(function (c) { return h('option', { value: c.slug, text: c.name }); })));
    }
    var btn = h('button', { class: 'btn sm', type: 'submit', text: 'Post' });
    var err = h('p', { class: 'err' });
    var image = null, preview = h('div', { class: 'prev', hidden: true });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/gif,image/webp', class: 'sr', id: 'img-' + Math.random().toString(36).slice(2) });
    var pick = h('label', { class: 'btn quiet', for: file.id, text: 'Add image' });
    function clearImage() { image = null; preview.hidden = true; preview.replaceChildren(); file.value = ''; }
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { err.textContent = 'Images can be up to 5 MB.'; file.value = ''; return; }
      err.textContent = ''; busy(btn, true); pick.textContent = 'Uploading\u2026';
      upload(f).then(function (r) {
        image = r.path; busy(btn, false); pick.textContent = 'Add image';
        preview.replaceChildren(h('img', { src: r.url, alt: 'Image to post' }), h('button', { type: 'button', class: 'btn quiet', text: 'Remove image', onclick: clearImage }));
        preview.hidden = false;
      }).catch(function (x) { busy(btn, false); pick.textContent = 'Add image'; file.value = ''; err.textContent = human(x); });
    });
    return h('form', { class: 'panel compose', onsubmit: function (e) {
      e.preventDefault(); if (!ta.value.trim()) { err.textContent = image ? 'Add a caption to go with your image.' : ''; return; } err.textContent = ''; busy(btn, true);
      rpc('rsp_post', { p_body: ta.value, p_community: community ? community.slug : (sel.value || null), p_image: image }).then(function (p) {
        busy(btn, false); ta.value = ''; count.textContent = '0 / 2000'; clearImage();
        track('post_created', { in_community: !!p.community });
        var empty = list.querySelector('.empty'); if (empty) empty.remove();
        list.insertBefore(postEl(p, community ? 'community' : 'feed'), list.firstChild);
      }).catch(function (x) { busy(btn, false); err.textContent = human(x); });
    } }, [ta, preview, err, h('div', { class: 'row' }, [file, pick, sel, h('span', { class: 'grow' }), count, btn])]);
  }

  function feedList(args, ctx, emptyMsg) {
    var list = h('ul', { class: 'posts' }, [h('li', {}, [h('span', { class: 'skel', style: 'height:120px' })])]);
    var more = h('button', { class: 'btn quiet more', type: 'button', text: 'Older posts', hidden: true });
    var oldest = null;
    function load(first) {
      busy(more, true);
      var a = {}; for (var k in args) a[k] = args[k]; a.p_before = oldest;
      rpc('rsp_feed', a).then(function (posts) {
        if (first) list.replaceChildren();
        posts.forEach(function (p) { list.appendChild(postEl(p, ctx)); oldest = p.id; });
        if (first && !posts.length) list.appendChild(h('li', { class: 'empty' }, emptyMsg));
        more.hidden = posts.length < 30; busy(more, false);
      }).catch(function (x) { busy(more, false); if (first) list.replaceChildren(h('li', { class: 'empty', text: human(x) })); else toast(human(x)); });
    }
    more.addEventListener('click', function () { load(false); });
    load(true);
    return { list: list, more: more };
  }

  /* ── views ── */
  function modePanel() {
    var modes = [['following', 'Following'], ['communities', 'Communities'], ['all', 'Everyone']];
    var cur = me.prefs.mode;
    var DESC = { following: 'Only people you follow, plus your own posts.', communities: 'Only communities you’ve joined.', all: 'Every member’s posts.' };
    return h('section', { class: 'panel', 'aria-labelledby': 'mode-h' }, [
      h('h2', { id: 'mode-h', text: 'Your feed, your rules' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Feed source' }, modes.map(function (m) {
        return h('button', { type: 'button', 'aria-pressed': String(cur === m[0]), text: m[1], onclick: function () {
          rpc('rsp_set_prefs', { p_mode: m[0], p_muted_words: me.prefs.muted_words }).then(function (r) {
            me = r; track('feed_mode_changed', { mode: m[0] }); route();
          }).catch(function (x) { toast(human(x)); });
        } });
      })),
      h('p', { style: 'margin-top:10px', text: DESC[cur] + ' Always newest first — no ranking, no engagement bait.' }),
      h('p', { style: 'margin-top:8px' }, [h('a', { href: '#/settings', text: 'Muted words & people' }),
        me.prefs.muted_words.length ? ' · ' + me.prefs.muted_words.length + ' muted' : ''])
    ]);
  }

  function viewStream() {
    var f = feedList({}, 'feed', emptyFeed());
    var side = h('aside', { class: 'side' }, [modePanel(),
      h('section', { class: 'panel' }, [h('h2', { text: 'Your communities' }),
        me.communities.length ? h('div', { class: 'tags' }, me.communities.map(function (c) { return h('a', { class: 'tag', href: '#/c/' + c.slug, text: c.name }); }))
          : h('p', {}, ['You haven’t joined any yet. ', h('a', { href: '#/communities', text: 'Find your people' }), '.'])]),
      h('section', { class: 'panel' }, [h('h2', { text: 'Bring someone' }), h('p', {}, ['RipeStream is better with people you know. ', h('a', { href: '/member', text: 'Send an invitation' }), '.'])])
    ]);
    render(h('div', { class: 'layout' }, [h('div', {}, [composer(f.list, null), f.list, f.more]), side]));
  }
  function emptyFeed() {
    var m = me.prefs.mode;
    if (m === 'following') return ['Nothing from people you follow yet. Follow members from their posts, or ', h('a', { href: '#/settings', text: 'widen your feed' }), '.'];
    if (m === 'communities') return ['Nothing in your communities yet. ', h('a', { href: '#/communities', text: 'Join a few' }), ' or start the conversation.'];
    return ['It’s quiet — you’re early. Say hello in ', h('a', { href: '#/c/introductions', text: 'Introductions' }), ' or share what you’re into.'];
  }

  function viewCommunities() {
    var list = h('ul', { class: 'comms' }, [h('li', {}, [h('span', { class: 'skel', style: 'height:70px' })])]);
    function draw(cs) {
      list.replaceChildren.apply(list, cs.map(function (c) {
        var b = h('button', { class: 'btn ' + (c.joined ? 'quiet' : 'sm'), type: 'button', text: c.joined ? 'Joined' : 'Join', 'aria-pressed': String(c.joined) });
        b.addEventListener('click', function () {
          busy(b, true);
          rpc('rsp_join', { p_slug: c.slug, p_on: !c.joined }).then(function (r) {
            if (!c.joined) track('community_joined');
            return rpc('rsp_me', {}).then(function (m) { me = m; draw(r); });
          }).catch(function (x) { busy(b, false); toast(human(x)); });
        });
        return h('li', { class: 'comm' }, [h('div', {}, [h('a', { href: '#/c/' + c.slug, text: c.name }),
          h('p', { text: (c.description ? c.description + ' · ' : '') + c.members + (c.members === 1 ? ' member' : ' members') })]), b]);
      }));
    }
    rpc('rsp_communities', {}).then(draw).catch(function (x) { list.replaceChildren(h('li', { class: 'empty', text: human(x) })); });

    var sIn = h('input', { id: 'cc-s', maxlength: 30, placeholder: 'e.g. dublin-runners', autocapitalize: 'none', required: true });
    var nIn = h('input', { id: 'cc-n', maxlength: 50, required: true });
    var dIn = h('input', { id: 'cc-d', maxlength: 300 });
    nIn.addEventListener('input', function () { if (!sIn.dataset.touched) sIn.value = nIn.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); });
    sIn.addEventListener('input', function () { sIn.dataset.touched = '1'; });
    var err = h('p', { class: 'err' }), btn = h('button', { class: 'btn sm', type: 'submit', text: 'Create community' });
    var form = h('form', { class: 'panel', onsubmit: function (e) {
      e.preventDefault(); err.textContent = ''; busy(btn, true);
      rpc('rsp_create_community', { p_slug: sIn.value, p_name: nIn.value, p_description: dIn.value }).then(function () {
        track('community_created'); return rpc('rsp_me', {});
      }).then(function (m) { me = m; location.hash = '#/c/' + sIn.value.toLowerCase(); })
        .catch(function (x) { busy(btn, false); err.textContent = human(x); });
    } }, [h('h2', { text: 'Start a community' }), h('p', { text: 'Around an interest, a place or a group of friends.' }),
      h('div', { class: 'field' }, [h('label', { for: 'cc-n' }, 'Name'), nIn]),
      h('div', { class: 'field' }, [h('label', { for: 'cc-s' }, ['Address', h('span', { text: 'letters, numbers, dashes' })]), sIn]),
      h('div', { class: 'field' }, [h('label', { for: 'cc-d' }, ['What it’s about', h('span', { text: 'Optional' })]), dIn]),
      err, h('div', { class: 'row' }, [btn])]);
    render(h('div', { class: 'layout' }, [h('div', {}, [h('h1', { class: 'display', text: 'Communities' }),
      h('p', { class: 'lede', text: 'Join the ones you care about, then set your feed to Communities to see only them.' }), list]),
      h('aside', { class: 'side' }, [form])]));
  }

  function viewCommunity(slug) {
    rpc('rsp_communities', {}).then(function (cs) {
      var c = cs.filter(function (x) { return x.slug === slug; })[0];
      if (!c) return render(h('div', { class: 'empty', text: 'That community doesn’t exist.' }));
      var f = feedList({ p_community: slug }, 'community', c.joined ? 'No posts yet. Start the conversation.' : 'No posts yet.');
      var join = h('button', { class: 'btn ' + (c.joined ? 'quiet' : 'sm'), type: 'button', text: c.joined ? 'Leave' : 'Join community', onclick: function () {
        rpc('rsp_join', { p_slug: slug, p_on: !c.joined }).then(function () { if (!c.joined) track('community_joined'); return rpc('rsp_me', {}); })
          .then(function (m) { me = m; viewCommunity(slug); }).catch(function (x) { toast(human(x)); });
      } });
      render(h('div', { class: 'layout' }, [h('div', {}, [
        h('h1', { class: 'display', text: c.name }), h('p', { class: 'lede', text: c.description }),
        h('p', { class: 'meta', text: c.members + (c.members === 1 ? ' member' : ' members') }),
        c.joined ? composer(f.list, c) : null, f.list, f.more]),
        h('aside', { class: 'side' }, [h('section', { class: 'panel' }, [h('h2', { text: c.joined ? 'You’re in' : 'Join to post' }),
          h('p', { text: c.joined ? 'Posts here show in your stream when your feed is set to Communities or Everyone.' : 'Anyone can read. Members of the community can post.' }),
          h('div', { class: 'row' }, [join])])])]));
    }).catch(function (x) { render(h('div', { class: 'empty', text: human(x) })); });
  }

  function viewProfile(handle) {
    rpc('rsp_profile', { p_handle: handle }).then(function (p) {
      var f = feedList({ p_handle: handle }, 'profile', p.me ? 'You haven’t posted yet.' : 'No posts yet.');
      function rel(kind, on, label) {
        return h('button', { class: 'btn ' + (kind === 'follow' && !on ? 'sm' : 'quiet'), type: 'button', text: label, onclick: function () {
          rpc('rsp_relate', { p_handle: handle, p_kind: kind, p_on: !on }).then(function () {
            if (kind === 'follow' && !on) track('member_followed');
            return rpc('rsp_me', {});
          }).then(function (m) { me = m; viewProfile(handle); }).catch(function (x) { toast(human(x)); });
        } });
      }
      render(h('div', { class: 'layout' }, [h('div', {}, [
        h('div', { class: 'ph' }, [h('span', { class: 'av', style: 'width:56px;height:56px;font-size:20px', 'aria-hidden': 'true', text: initials(p.name) }),
          h('div', {}, [h('h1', { class: 'display', style: 'font-size:clamp(30px,5vw,48px);margin:0', text: p.name }),
            h('span', { class: 'h', text: '@' + p.handle }), p.founding ? h('span', { class: 'fm', style: 'margin-left:8px', text: 'Founding Member #' + p.founding }) : null])]),
        p.bio ? h('p', { class: 'lede', style: 'margin-top:14px', text: p.bio }) : null,
        h('p', { class: 'meta', text: p.followers + ' followers · ' + p.following + ' following' }),
        p.me ? h('div', { class: 'row' }, [h('a', { class: 'btn quiet', href: '#/settings', text: 'Edit profile' })])
          : h('div', { class: 'row' }, [rel('follow', p.i_follow, p.i_follow ? 'Following' : 'Follow'), rel('mute', p.i_mute, p.i_mute ? 'Unmute' : 'Mute')]),
        f.list, f.more]), h('aside', { class: 'side' }, [])]));
    }).catch(function (x) { render(h('div', { class: 'empty', text: human(x) })); });
  }

  function viewSettings() {
    var words = me.prefs.muted_words.slice();
    var tags = h('div', { class: 'tags' });
    function save(mode) {
      return rpc('rsp_set_prefs', { p_mode: mode || me.prefs.mode, p_muted_words: words }).then(function (r) { me = r; words = me.prefs.muted_words.slice(); drawTags(); });
    }
    function drawTags() {
      tags.replaceChildren.apply(tags, words.length ? words.map(function (w) {
        return h('span', { class: 'tag' }, [w, h('button', { type: 'button', 'aria-label': 'Unmute ' + w, text: '×', onclick: function () {
          words = words.filter(function (x) { return x !== w; }); save().catch(function (x) { toast(human(x)); });
        } })]);
      }) : [h('p', { text: 'No muted words.' })]);
    }
    drawTags();
    var wIn = h('input', { id: 'mw', maxlength: 40, placeholder: 'e.g. spoilers' });
    var wForm = h('form', { class: 'row', onsubmit: function (e) {
      e.preventDefault(); var w = wIn.value.trim().toLowerCase(); if (!w) return;
      if (words.indexOf(w) < 0) words.push(w);
      save().then(function () { wIn.value = ''; track('word_muted'); toast('Muted “' + w + '”'); }).catch(function (x) { toast(human(x)); });
    } }, [h('span', { class: 'field grow', style: 'margin:0' }, [h('label', { for: 'mw', class: 'sr', text: 'Word to mute' }), wIn]), h('button', { class: 'btn sm', type: 'submit', text: 'Mute' })]);
    render(h('div', { class: 'layout' }, [h('div', { class: 'stack' }, [
      h('h1', { class: 'display', text: 'Feed & profile' }),
      modePanel(),
      h('section', { class: 'panel' }, [h('h2', { text: 'Muted words' }), h('p', { text: 'Posts containing these never reach your stream. Nobody is told.' }), tags, wForm]),
      h('section', { class: 'panel' }, [h('h2', { text: 'Muted people' }), me.muted.length
        ? h('div', { class: 'tags' }, me.muted.map(function (m) { return h('a', { class: 'tag', href: '#/u/' + m, text: '@' + m }); }))
        : h('p', { text: 'Nobody. Mute someone from their profile — they won’t know.' })]),
      h('section', { class: 'panel' }, [h('h2', { text: 'Your data' }), h('p', {}, ['Delete posts and replies any time from the post itself. To see, export or delete everything, email ',
        h('a', { href: 'mailto:privacy@ripestream.com', text: 'privacy@ripestream.com' }), '.'])])
    ]), h('aside', { class: 'side' }, [profileForm(false)])]));
  }

  var NOTE = { reply: 'replied to your post', mention: 'mentioned you', follow: 'followed you' };
  function viewNotifications() {
    var list = h('ul', { class: 'comms' }, [h('li', {}, [h('span', { class: 'skel', style: 'height:70px' })])]);
    rpc('rsp_notifications', {}).then(function (ns) {
      setUnread(0);
      list.replaceChildren.apply(list, ns.length ? ns.map(function (n) {
        return h('li', { class: 'comm note-item' + (n.unread ? ' unread' : '') }, [h('div', {}, [
          h('div', { class: 'ph' }, authorBits(n.actor).concat([h('span', { class: 't', text: NOTE[n.kind] + ' \u00b7 ' + ago(n.at) })])),
          n.snippet ? h('p', { text: n.snippet }) : null]),
          h('a', { class: 'btn quiet', href: n.post ? '#/p/' + n.post : '#/u/' + (n.actor && n.actor.handle), text: n.post ? 'View' : 'Profile' })]);
      }) : [h('li', { class: 'empty', text: 'Nothing yet. Replies, mentions and new followers show up here.' })]);
    }).catch(function (x) { list.replaceChildren(h('li', { class: 'empty', text: human(x) })); });
    render(h('div', {}, [h('h1', { class: 'display', text: 'Notifications' }), list]));
  }

  function viewPost(id) {
    rpc('rsp_post_get', { p_id: id }).then(function (p) {
      var li = postEl(p, 'single'), list = h('ul', { class: 'posts' }, [li]);
      render(h('div', { class: 'layout' }, [h('div', {}, [list]), h('aside', { class: 'side' }, [])]));
      li.querySelector('.pf button').click();
    }).catch(function (x) { render(h('div', { class: 'empty', text: human(x) })); });
  }

  function viewAdmin() {
    var list = h('ul', { class: 'posts' }, [h('li', {}, [h('span', { class: 'skel', style: 'height:120px' })])]);
    function draw(rs) {
      list.replaceChildren.apply(list, rs.length ? rs.map(function (r) {
        var c = r.content;
        function act(a, label, cls) {
          return h('button', { class: 'btn ' + (cls || 'quiet'), type: 'button', text: label, onclick: function () {
            if (a !== 'dismiss' && !confirm(a === 'suspend' ? 'Remove this and suspend its author?' : 'Remove this ' + r.kind + '?')) return;
            rpc('rsp_admin_act', { p_kind: r.kind, p_target: r.target, p_action: a }).then(function (l) { toast('Done'); draw(l); }).catch(function (x) { toast(human(x)); });
          } });
        }
        return h('li', { class: 'post' }, [
          h('p', { class: 'k', text: r.kind + ' \u00b7 ' + r.reports + (r.reports === 1 ? ' report' : ' reports') }),
          c ? h('div', { class: 'ph', style: 'margin-top:10px' }, authorBits(c.author).concat([h('span', { class: 't', text: '\u00b7 ' + ago(c.at) })])) : h('p', { class: 'meta', text: 'Already deleted by its author.' }),
          c ? h('p', { class: 'body', text: c.body }) : null,
          c && c.image ? h('div', { class: 'pimg' }, [h('img', { src: c.image, alt: 'Reported image', loading: 'lazy' })]) : null,
          h('ul', { class: 'reasons' }, r.reasons.map(function (t) { return h('li', { text: t }); })),
          h('div', { class: 'row' }, [act('dismiss', 'Keep it'), c ? act('remove', 'Remove') : null, c ? act('suspend', 'Remove & suspend author', 'sm') : null])
        ]);
      }) : [h('li', { class: 'empty', text: 'No open reports.' })]);
    }
    rpc('rsp_admin_reports', {}).then(draw).catch(function (x) { list.replaceChildren(h('li', { class: 'empty', text: human(x) })); });
    render(h('div', {}, [h('h1', { class: 'display', text: 'Moderation' }), h('p', { class: 'lede', text: 'Open reports, newest first. Removing deletes the content for good.' }), list]));
  }

  /* ── unread badge ── */
  var badge = h('span', { class: 'badge', hidden: true });
  function setUnread(n) { badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n; badge.setAttribute('aria-label', n + ' unread'); }
  function pollUnread() { if (!document.hidden && me && me.profile) rpc('rsp_unread', {}).then(setUnread).catch(function () {}); }
  setInterval(pollUnread, 60000);
  document.addEventListener('visibilitychange', pollUnread);

  /* ── router ── */
  function route() {
    if (!me) return;
    if (!me.profile) { nav.hidden = true; return render(profileForm(true)); }
    nav.hidden = false;
    var hash = location.hash.replace(/^#\/?/, ''), parts = hash.split('/');
    if (!nav.querySelector('[href="#/notifications"]')) {
      nav.insertBefore(h('a', { href: '#/notifications' }, ['Notifications', badge]), nav.children[2]);
      if (me.admin) nav.insertBefore(h('a', { href: '#/admin', text: 'Moderation' }), nav.lastChild);
    }
    var cur = parts[0] === 'communities' || parts[0] === 'c' ? '#/communities' : parts[0] === '' ? '#/' : ['settings', 'notifications', 'admin'].indexOf(parts[0]) >= 0 ? '#/' + parts[0] : null;
    [].forEach.call(nav.querySelectorAll('a'), function (a) { if (a.getAttribute('href') === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    if (parts[0] === 'communities') viewCommunities();
    else if (parts[0] === 'c' && parts[1]) viewCommunity(decodeURIComponent(parts[1]).toLowerCase());
    else if (parts[0] === 'u' && parts[1]) viewProfile(decodeURIComponent(parts[1]).toLowerCase());
    else if (parts[0] === 'settings') viewSettings();
    else if (parts[0] === 'notifications') viewNotifications();
    else if (parts[0] === 'p' && /^\d+$/.test(parts[1] || '')) viewPost(Number(parts[1]));
    else if (parts[0] === 'admin' && me.admin) viewAdmin();
    else viewStream();
  }
  window.addEventListener('hashchange', route);

  if (!key) return noKey();
  render(h('span', { class: 'skel', style: 'height:220px' }));
  rpc('rsp_me', {}).then(function (m) { me = m; setUnread(m.unread || 0); track('app_open'); route(); }).catch(gateError);
})();
