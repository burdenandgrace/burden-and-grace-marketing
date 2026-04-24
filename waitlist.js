/* Burden & Grace — pre-launch waitlist modal
 *
 * HOW IT WORKS
 *   Any element with data-waitlist="<source>" opens a modal when clicked.
 *   The modal collects an email, POSTs to Supabase, and stores
 *   { email, source, user_agent, referrer } in public.waitlist.
 *
 *   The anon key below is public by design (it's what ships in every
 *   Supabase-backed frontend). RLS on the waitlist table allows only
 *   INSERT — no SELECT — so the key can't be used to read signups.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://hycalmremlhqymgbmvlg.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Y2FsbXJlbWxocXltZ2JtdmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTg0ODgsImV4cCI6MjA5MTMzNDQ4OH0.awA2KnZVNaLW1tb7Pjgo5MoMUB3C81J9Ykeha9g8Ixw';

  // Human-friendly copy per CTA source. Keep headlines short.
  var COPY = {
    sign_in:      { title: 'Hold your spot.',     sub: 'Sign-in opens when the app launches. Drop your email and we\'ll tell you the day it\'s live.' },
    free_track:   { title: 'First dibs on the free track.', sub: 'The 10-day Silent Struggles track goes live with the app. We\'ll email you the moment it does — nothing before, nothing after.' },
    download_app: { title: 'Get the download link on launch day.', sub: 'The iOS app ships soon. Drop your email and we\'ll send the App Store link the day it\'s live.' },
    pricing:      { title: 'Founding member spot — save 50%.', sub: 'The first 300 lock in founding pricing ($1.99/mo or $17.99/yr). We\'ll email you when that door opens.' },
    about:        { title: 'Launch day note.',    sub: 'One email on the day Burden & Grace goes live. Nothing else.' },
    premium_track:{ title: 'First look at the full shelf.', sub: 'This track opens with membership on launch day. Drop your email and we\'ll tell you the moment the door opens.' }
  };

  // ---- CSS (injected once) ---------------------------------------------
  var css = [
    '.wl-overlay{position:fixed;inset:0;background:rgba(22,17,13,.72);display:none;align-items:center;justify-content:center;z-index:9999;padding:1rem;opacity:0;transition:opacity .2s ease}',
    '.wl-overlay.wl-open{display:flex;opacity:1}',
    '.wl-dialog{background:#FBF7F0;color:#2B211A;border-radius:14px;max-width:440px;width:100%;padding:2rem 1.75rem 1.75rem;box-shadow:0 24px 80px rgba(0,0,0,.45);font-family:"Inter",system-ui,-apple-system,sans-serif;position:relative}',
    '.wl-close{position:absolute;top:.5rem;right:.75rem;background:none;border:0;font-size:1.5rem;line-height:1;color:#6B5848;cursor:pointer;padding:.25rem .5rem;border-radius:6px}',
    '.wl-close:hover{color:#2B211A;background:rgba(0,0,0,.05)}',
    '.wl-title{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:1.75rem;line-height:1.15;margin:0 0 .5rem;color:#2B211A}',
    '.wl-sub{font-size:.95rem;line-height:1.5;color:#5C4A3C;margin:0 0 1.25rem}',
    '.wl-form{display:flex;flex-direction:column;gap:.75rem}',
    '.wl-input{font:inherit;padding:.75rem .875rem;border:1px solid #D8C9B5;border-radius:8px;background:#FFFDF9;color:#2B211A;outline:none;transition:border-color .15s}',
    '.wl-input:focus{border-color:#C9A84C;box-shadow:0 0 0 3px rgba(201,168,76,.2)}',
    '.wl-btn{font:inherit;font-weight:500;padding:.8rem 1.25rem;border:0;border-radius:8px;background:#2B211A;color:#FBF7F0;cursor:pointer;transition:background .15s}',
    '.wl-btn:hover:not(:disabled){background:#3D2E23}',
    '.wl-btn:disabled{opacity:.6;cursor:wait}',
    '.wl-fine{font-size:.75rem;color:#8A7665;margin:.75rem 0 0;line-height:1.4}',
    '.wl-msg{margin:.75rem 0 0;font-size:.9rem;line-height:1.4}',
    '.wl-msg.err{color:#9B2C2C}',
    '.wl-msg.ok{color:#2F6E3B}',
    '.wl-success{text-align:center;padding:1rem 0 .5rem}',
    '.wl-success .wl-title{margin-bottom:.75rem}',
    '.wl-success .wl-sub{margin:0}'
  ].join('');

  // ---- DOM helpers ------------------------------------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  var overlay, dialog, titleEl, subEl, form, emailInput, submitBtn, msgEl, currentSource, bodyContent;

  function buildModal() {
    var style = el('style', { type: 'text/css' });
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    overlay = el('div', { class: 'wl-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wl-title' });
    dialog = el('div', { class: 'wl-dialog' });

    var closeBtn = el('button', { class: 'wl-close', type: 'button', 'aria-label': 'Close' });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeModal);

    bodyContent = el('div');
    titleEl = el('h3', { class: 'wl-title', id: 'wl-title' });
    subEl = el('p', { class: 'wl-sub' });

    form = el('form', { class: 'wl-form', novalidate: 'novalidate' });
    emailInput = el('input', { class: 'wl-input', type: 'email', name: 'email', required: 'required', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' });
    submitBtn = el('button', { class: 'wl-btn', type: 'submit' }, ['Count me in']);
    msgEl = el('p', { class: 'wl-msg' });

    var fine = el('p', { class: 'wl-fine' }, ['One email on launch. No newsletter, no selling your email. Unsubscribe anytime.']);

    form.appendChild(emailInput);
    form.appendChild(submitBtn);
    form.addEventListener('submit', onSubmit);

    bodyContent.appendChild(titleEl);
    bodyContent.appendChild(subEl);
    bodyContent.appendChild(form);
    bodyContent.appendChild(msgEl);
    bodyContent.appendChild(fine);

    dialog.appendChild(closeBtn);
    dialog.appendChild(bodyContent);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Click outside closes
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    // Esc closes
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('wl-open')) closeModal(); });
  }

  function openModal(source) {
    if (!overlay) buildModal();
    currentSource = source;
    var copy = COPY[source] || COPY.sign_in;
    titleEl.textContent = copy.title;
    subEl.textContent = copy.sub;
    msgEl.textContent = '';
    msgEl.className = 'wl-msg';
    emailInput.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Count me in';
    // Restore form view in case previous interaction showed success state
    if (form.parentNode !== bodyContent) {
      bodyContent.innerHTML = '';
      bodyContent.appendChild(titleEl);
      bodyContent.appendChild(subEl);
      bodyContent.appendChild(form);
      bodyContent.appendChild(msgEl);
      bodyContent.appendChild(el('p', { class: 'wl-fine' }, ['One email on launch. No newsletter, no selling your email. Unsubscribe anytime.']));
    }
    overlay.classList.add('wl-open');
    setTimeout(function () { emailInput.focus(); }, 50);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('wl-open');
    document.body.style.overflow = '';
  }

  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s); }

  function showSuccess() {
    bodyContent.innerHTML = '';
    var wrap = el('div', { class: 'wl-success' });
    wrap.appendChild(el('h3', { class: 'wl-title', id: 'wl-title' }, ['You\'re on the list.']));
    wrap.appendChild(el('p', { class: 'wl-sub' }, ['One email on launch day. Nothing before, nothing after.']));
    bodyContent.appendChild(wrap);
  }

  function onSubmit(e) {
    e.preventDefault();
    var email = (emailInput.value || '').trim().toLowerCase();
    if (!validEmail(email)) {
      msgEl.textContent = 'That doesn\'t look like an email address.';
      msgEl.className = 'wl-msg err';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    msgEl.textContent = '';
    msgEl.className = 'wl-msg';

    var payload = {
      email: email,
      source: currentSource,
      user_agent: (navigator.userAgent || '').slice(0, 512),
      referrer: (document.referrer || '').slice(0, 512)
    };

    fetch(SUPABASE_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.ok || res.status === 201) {
        showSuccess();
        return;
      }
      // 409 = duplicate (already on waitlist for this source) — treat as success
      if (res.status === 409) {
        showSuccess();
        return;
      }
      return res.text().then(function (txt) {
        // eslint-disable-next-line no-console
        console.warn('[waitlist] insert failed', res.status, txt);
        msgEl.textContent = 'Something hiccuped. Try again in a moment.';
        msgEl.className = 'wl-msg err';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Count me in';
      });
    }).catch(function (err) {
      // eslint-disable-next-line no-console
      console.warn('[waitlist] network error', err);
      msgEl.textContent = 'Network error — check your connection and try again.';
      msgEl.className = 'wl-msg err';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Count me in';
    });
  }

  // ---- CTA binding (event delegation) ----------------------------------
  document.addEventListener('click', function (e) {
    var node = e.target;
    // Walk up to 5 levels looking for a [data-waitlist] ancestor
    for (var i = 0; node && i < 5; i++) {
      if (node.getAttribute && node.getAttribute('