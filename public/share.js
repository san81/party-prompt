// Shareable result card, shared by both games.
//   Share.mount(el, getCard)  renders a "Share result" button into el
//   getCard() returns { key, game, title, big?, small?, note?, chips?: [text], teams?: [{ name, score, color }], url, text }
// The card is drawn on a canvas in the current theme's colours (1080×1080, fits WhatsApp and
// Instagram). Phones get the system share sheet with the image; elsewhere a dialog offers
// download + WhatsApp. Only what's on the result screen is shared.
(() => {
  const STR = {
    'en-US': { btn: '📸 Share result', title: 'Share your result', save: 'Download image', wa: 'Send on WhatsApp', copy: 'Copy link', copied: 'Copied!', close: 'Close', footer: 'Can you beat this? Play free:' },
    'te-IN': { btn: '📸 ఫలితం షేర్ చేయండి', title: 'మీ ఫలితం షేర్ చేయండి', save: 'చిత్రం డౌన్‌లోడ్', wa: 'వాట్సాప్‌లో పంపండి', copy: 'లింక్ కాపీ', copied: 'కాపీ అయింది!', close: 'మూసివేయి', footer: 'మీరు దీన్ని దాటగలరా? ఉచితంగా ఆడండి:' },
  };
  const T = () => STR[window.Shell ? Shell.getLang() : 'en-US'] || STR['en-US'];
  const SIZE = 1080;
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const fontStack = (v) => css(v, 'sans-serif');
  // Trim by grapheme, never by code point, so Telugu letters stay whole.
  const trim = (s, n) => { const g = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map(x => x.segment); return g.length > n ? g.slice(0, n - 1).join('') + '…' : s; };

  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // Largest font size (≤ max) at which text fits maxW.
  function fit(g, text, weight, family, max, maxW) {
    let s = max;
    for (; s > 18; s -= 2) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; }
    return s;
  }

  async function draw(card) {
    const display = fontStack('--display'), body = fontStack('--body');
    try { await Promise.all([document.fonts.load(`80px ${display}`, card.title), document.fonts.load(`700 40px ${body}`, card.small || 'a')]); } catch {}
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const stage = css('--stage', '#1a0b2e'), panel = css('--panel', '#2b1450'), line = css('--line', '#4a2b7a');
    const ink = css('--ink', '#fff'), muted = css('--muted', '#ccc'), brass = css('--brass', '#ffd23f'), brassInk = css('--brass-ink', '#000'), coral = css('--coral', '#ff4d8d');

    const bg = g.createRadialGradient(SIZE * 0.2, 0, 50, SIZE * 0.5, SIZE * 0.4, SIZE);
    bg.addColorStop(0, panel); bg.addColorStop(1, stage);
    g.fillStyle = bg; g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = coral; g.fillRect(0, 0, SIZE, 14);
    g.fillStyle = brass; g.fillRect(0, 14, SIZE, 6);

    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const cx = SIZE / 2, W = SIZE - 140;
    // Lay the blocks out first, then centre the stack between the top bar and the footer.
    const blocks = [];
    const text = (str, weight, family, max, color, h) => blocks.push({ h, draw: (y) => {
      g.fillStyle = color; g.font = `${weight} ${fit(g, str, weight, family, max, W)}px ${family}`; g.fillText(str, cx, y + h * 0.78);
    } });
    text(card.game, 400, display, 30, muted, 56);
    text(card.title, 400, display, 92, brass, 120);
    if (card.teams) {
      // Two team panels side by side, the winner outlined.
      const w = 400, h = 300, gap = 40, x0 = cx - w - gap / 2, best = Math.max(...card.teams.map(t => t.score));
      blocks.push({ h: h + 30, draw: (top) => card.teams.forEach((t, i) => {
        const x = x0 + i * (w + gap);
        g.fillStyle = panel; rrect(g, x, top + 15, w, h, 28); g.fill();
        g.lineWidth = t.score === best ? 8 : 3; g.strokeStyle = t.score === best ? t.color : line; g.stroke();
        g.fillStyle = t.color; g.font = `400 ${fit(g, t.name, 400, display, 48, w - 50)}px ${display}`;
        g.fillText(t.name, x + w / 2, top + 95);
        g.font = `400 150px ${display}`; g.fillText(String(t.score), x + w / 2, top + 265);
      }) });
    } else if (card.big) text(card.big, 400, display, 150, ink, 170);
    if (card.small) text(card.small, 700, body, 44, ink, 70);
    if (card.note) text(card.note, 500, body, 34, muted, 52);
    // Found answers as chips, centred rows (at most 3 rows).
    if (card.chips?.length) {
      g.font = `700 32px ${body}`;
      const rows = [[]]; let rowW = 0;
      for (const raw of card.chips.slice(0, 9)) {
        const label = trim(raw, 34), w = g.measureText(label).width + 48;
        if (rowW + w > W && rows.at(-1).length) { rows.push([]); rowW = 0; }
        rows.at(-1).push({ label, w }); rowW += w + 16;
      }
      const shown = rows.slice(0, 3);
      blocks.push({ h: 30 + shown.length * 78, draw: (y) => {
        let ry = y + 30;
        g.font = `700 32px ${body}`;
        for (const row of shown) {
          let x = cx - (row.reduce((sum, c) => sum + c.w, 0) + 16 * (row.length - 1)) / 2;
          for (const chip of row) {
            g.fillStyle = brass; rrect(g, x, ry, chip.w, 62, 31); g.fill();
            g.fillStyle = brassInk; g.textAlign = 'left'; g.fillText(chip.label, x + 24, ry + 42); g.textAlign = 'center';
            x += chip.w + 16;
          }
          ry += 78;
        }
      } });
    }
    const top = 20, bottom = SIZE - 190, total = blocks.reduce((sum, b) => sum + b.h, 0);
    let y = top + Math.max(30, (bottom - top - total) / 2);
    for (const b of blocks) { b.draw(y); y += b.h; }
    // Footer: the invite.
    g.fillStyle = panel; g.fillRect(0, SIZE - 190, SIZE, 190);
    g.fillStyle = line; g.fillRect(0, SIZE - 190, SIZE, 3);
    g.fillStyle = ink; g.font = `700 ${fit(g, T().footer, 700, body, 38, W)}px ${body}`;
    g.fillText(T().footer, cx, SIZE - 115);
    const host = card.url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    g.fillStyle = brass; g.font = `400 ${fit(g, host, 400, display, 46, W)}px ${display}`;
    g.fillText(host, cx, SIZE - 50);
    return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  }

  /* ---------- fallback dialog (desktop) ---------- */
  let dlg = null;
  function dialog(blob, card) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'fb-dialog share-dialog';
      dlg.innerHTML = `<form method="dialog" class="fb-form"><h2 class="fb-title"></h2><img class="share-img" alt="">
        <div class="fb-actions share-actions"><a class="fb-btn share-save" download="party-games-result.png"></a><a class="fb-btn share-wa" target="_blank" rel="noopener"></a><button type="button" class="fb-btn share-copy"></button><button type="button" class="fb-btn share-close"></button></div></form>`;
      document.body.appendChild(dlg);
      dlg.querySelector('.share-close').onclick = () => dlg.close();
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => { const img = dlg.querySelector('.share-img'); if (img.src) URL.revokeObjectURL(img.src); });
    }
    const t = T(), q = (s) => dlg.querySelector(s), src = URL.createObjectURL(blob);
    q('.fb-title').textContent = t.title;
    q('.share-img').src = src; q('.share-save').href = src; q('.share-save').textContent = t.save;
    q('.share-wa').href = `https://wa.me/?text=${encodeURIComponent(`${card.text} ${card.url}`)}`; q('.share-wa').textContent = t.wa;
    q('.share-copy').textContent = t.copy;
    q('.share-copy').onclick = async (e) => { try { await navigator.clipboard.writeText(card.url); e.currentTarget.textContent = t.copied; } catch {} };
    q('.share-close').textContent = t.close;
    q('.share-save').onclick = () => window.track?.('share', { game: card.key, method: 'download' });
    q('.share-wa').onclick = () => window.track?.('share', { game: card.key, method: 'whatsapp' });
    dlg.showModal();
  }

  async function share(getCard, btn) {
    btn.disabled = true;
    try {
      const card = getCard();
      const blob = await draw(card);
      const file = new File([blob], 'party-games-result.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
        try {
          await navigator.share({ files: [file], text: `${card.text} ${card.url}` });
          window.track?.('share', { game: card.key, method: 'native' });
        } catch (e) { if (e.name !== 'AbortError') dialog(blob, card); }
      } else dialog(blob, card);
    } finally { btn.disabled = false; }
  }

  function mount(el, getCard) {
    if (!el) return;
    const render = () => {
      el.innerHTML = `<button type="button" class="share-btn"></button>`;
      const b = el.firstChild; b.textContent = T().btn;
      b.onclick = () => share(getCard, b);
    };
    render();
    window.addEventListener('langchange', render);
  }

  window.Share = { mount, draw };
})();
