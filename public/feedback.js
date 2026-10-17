// "High-five the developer" + feedback, shared by the landing and both games.
//   Feedback.mount(el, getContext, { made })  renders the 🙌 / 💌 row into el
//   getContext() returns extra short strings (game, category, result) sent with each message.
// Posts to /api/feedback; the server forwards to Discord. Kid mode hides the contact field
// so children are never asked for personal details.
(() => {
  const STR = {
    'en-US': {
      ask: 'Enjoyed it?', made: 'Made with ❤️ and way too much chai by a weekend coder',
      hi: '🙌 High-five', hiSent: '🙌 Thanks!', open: '💌 Send feedback',
      title: 'Say hi to the developer 👋', sub: 'A quick high-five makes my day. Ideas, bugs or wishes — I read every one.',
      or: 'or tell me more', rateQ: 'How was it?', rate: ['Not fun', 'Meh', 'Okay', 'Fun', 'Loved it'],
      msgPh: 'What should I add or fix?', contactPh: 'Email or phone, if you want a reply (optional)',
      send: 'Send', close: 'Close', sending: 'Sending…', thanks: 'Thank you! 💛', wait: 'Got it already — thank you!',
      fail: "Couldn't send right now. Please try again later.", need: 'Pick a face or write a message.',
      kids: { title: 'Say thank you! 🙌', sub: 'Tap the high-five, or tell us what you liked!', msgPh: 'What was the most fun?' },
    },
    'te-IN': {
      ask: 'నచ్చిందా?', made: '❤️ తో, బోలెడు ఛాయ్‌తో ఒక వీకెండ్ కోడర్ తయారు చేశారు',
      hi: '🙌 హై-ఫైవ్', hiSent: '🙌 థాంక్స్!', open: '💌 అభిప్రాయం పంపండి',
      title: 'డెవలపర్‌కి హాయ్ చెప్పండి 👋', sub: 'ఒక్క హై-ఫైవ్ చాలు, నాకు సంతోషం. ఐడియాలు, బగ్‌లు, కోరికలు — ప్రతిదీ చదువుతాను.',
      or: 'లేదా ఇంకా చెప్పండి', rateQ: 'ఎలా ఉంది?', rate: ['బాలేదు', 'పర్వాలేదు', 'ఓకే', 'సరదాగా ఉంది', 'చాలా నచ్చింది'],
      msgPh: 'ఏం జోడించాలి లేదా సరిచేయాలి?', contactPh: 'జవాబు కావాలంటే ఈమెయిల్ లేదా ఫోన్ (ఐచ్ఛికం)',
      send: 'పంపు', close: 'మూసివేయి', sending: 'పంపుతున్నాం…', thanks: 'ధన్యవాదాలు! 💛', wait: 'ఇప్పటికే అందింది — ధన్యవాదాలు!',
      fail: 'ఇప్పుడు పంపలేకపోయాం. తర్వాత మళ్ళీ ప్రయత్నించండి.', need: 'ఒక ముఖం ఎంచుకోండి లేదా సందేశం రాయండి.',
      kids: { title: 'థాంక్యూ చెప్పండి! 🙌', sub: 'హై-ఫైవ్ నొక్కండి, లేదా ఏది నచ్చిందో చెప్పండి!', msgPh: 'ఏది ఎక్కువ సరదాగా ఉంది?' },
    },
  };
  const FACES = ['😞', '🙁', '😐', '🙂', '😍'];
  const kids = () => (window.Shell ? Shell.getKids() : false);
  const T = () => {
    const base = STR[window.Shell ? Shell.getLang() : 'en-US'] || STR['en-US'];
    return kids() ? { ...base, ...base.kids } : base;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function baseContext() {
    return {
      page: location.pathname,
      lang: window.Shell ? Shell.getLang() : 'en-US',
      kids: String(kids()),
      theme: document.documentElement.dataset.theme || '',
      screen: `${innerWidth}x${innerHeight}`,
    };
  }
  async function post(body, getContext) {
    let extra = {};
    try { extra = (getContext && getContext()) || {}; } catch {}
    const context = { ...baseContext(), ...extra };
    for (const k of Object.keys(context)) context[k] = String(context[k] ?? '');
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, context }) });
      if (r.ok) window.track?.(body.kind === 'high-five' ? 'high_five' : 'feedback_sent', { rating: body.rating || undefined });
      return r.status === 429 ? 'wait' : r.ok ? 'ok' : 'fail';
    } catch { return 'fail'; }
  }

  async function highFive(btn, getContext) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.remove('fb-pop'); void btn.offsetWidth; btn.classList.add('fb-pop');
    const res = await post({ kind: 'high-five' }, getContext);
    btn.textContent = res === 'fail' ? T().hi : T().hiSent;
    if (res === 'fail') btn.disabled = false;
    else setTimeout(() => { btn.disabled = false; btn.textContent = T().hi; }, 15000);
  }

  /* ---------- dialog (built once, re-labelled on each open) ---------- */
  let dlg = null, ctxFn = null, rating = null;
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'fb-dialog';
    dlg.innerHTML = `
      <form method="dialog" class="fb-form" novalidate>
        <h2 class="fb-title"></h2>
        <p class="fb-sub"></p>
        <button type="button" class="fb-big fb-hi5"></button>
        <p class="fb-or"></p>
        <fieldset class="fb-rate"><legend></legend>${FACES.map((f, i) => `<button type="button" data-r="${i + 1}" aria-pressed="false">${f}</button>`).join('')}</fieldset>
        <textarea class="fb-msg" maxlength="1000" rows="3"></textarea>
        <input class="fb-contact" type="text" maxlength="120" autocomplete="email">
        <input class="fb-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="fb-status" role="status"></p>
        <div class="fb-actions"><button type="button" class="fb-close"></button><button type="button" class="fb-send"></button></div>
      </form>`;
    document.body.appendChild(dlg);
    const q = (s) => dlg.querySelector(s);
    q('.fb-hi5').onclick = (e) => highFive(e.currentTarget, ctxFn);
    q('.fb-rate').onclick = (e) => {
      const b = e.target.closest('button[data-r]'); if (!b) return;
      rating = Number(b.dataset.r) === rating ? null : Number(b.dataset.r);
      dlg.querySelectorAll('.fb-rate button').forEach((x) => x.setAttribute('aria-pressed', Number(x.dataset.r) === rating));
    };
    q('.fb-close').onclick = () => dlg.close();
    q('.fb-send').onclick = async () => {
      const t = T(), message = q('.fb-msg').value.trim();
      if (!rating && !message) { q('.fb-status').textContent = t.need; return; }
      q('.fb-send').disabled = true; q('.fb-status').textContent = t.sending;
      const res = await post({ kind: 'feedback', rating, message, contact: kids() ? '' : q('.fb-contact').value.trim(), website: q('.fb-trap').value }, ctxFn);
      q('.fb-send').disabled = false;
      q('.fb-status').textContent = res === 'ok' ? t.thanks : res === 'wait' ? t.wait : t.fail;
      if (res !== 'fail') {
        q('.fb-msg').value = ''; q('.fb-contact').value = ''; rating = null;
        dlg.querySelectorAll('.fb-rate button').forEach((x) => x.setAttribute('aria-pressed', 'false')); setTimeout(() => dlg.open && dlg.close(), 1600); }
    };
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click on the backdrop
  }
  function open(getContext) {
    if (!dlg) build();
    ctxFn = getContext;
    const t = T(), q = (s) => dlg.querySelector(s);
    q('.fb-title').textContent = t.title; q('.fb-sub').textContent = t.sub;
    q('.fb-hi5').textContent = t.hi; q('.fb-hi5').disabled = false;
    q('.fb-or').textContent = t.or; q('.fb-rate legend').textContent = t.rateQ;
    dlg.querySelectorAll('.fb-rate button').forEach((b, i) => { b.title = t.rate[i]; b.setAttribute('aria-label', t.rate[i]); });
    q('.fb-msg').placeholder = t.msgPh; q('.fb-msg').setAttribute('aria-label', t.msgPh);
    q('.fb-contact').placeholder = t.contactPh; q('.fb-contact').setAttribute('aria-label', t.contactPh);
    q('.fb-contact').hidden = kids();
    q('.fb-close').textContent = t.close; q('.fb-send').textContent = t.send;
    q('.fb-status').textContent = '';
    dlg.showModal();
  }

  /* ---------- the row placed on pages ---------- */
  function mount(el, getContext, { made = false } = {}) {
    if (!el) return;
    const render = () => {
      const t = T();
      el.classList.add('fb-row');
      el.innerHTML = `<span class="fb-ask">${esc(made ? t.made : t.ask)}</span>
        <button type="button" class="fb-btn fb-hi">${esc(t.hi)}</button>
        <button type="button" class="fb-btn fb-open">${esc(t.open)}</button>`;
      el.querySelector('.fb-hi').onclick = (e) => highFive(e.currentTarget, getContext);
      el.querySelector('.fb-open').onclick = () => open(getContext);
    };
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('kidschange', render);
  }

  window.Feedback = { mount, open };
})();
