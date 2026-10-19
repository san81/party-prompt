// Shared site shell: theme + global language + kid mode, used by the landing and both games.
// The active theme is also set by a tiny inline <head> script on each page (before this
// loads) to avoid a flash of the wrong theme. Both settings persist and are site-wide.

window.THEMES = {
  celebration: { label: '🎉 Celebration' },
  fall:        { label: '🍂 Fall' },
  midnight:    { label: '🌙 Midnight' },
  neon:        { label: '⚡ Neon' },
  daylight:    { label: '☀️ Daylight' },
  diwali:      { label: '🪔 Diwali' },
};
// Kid mode has its own bright palettes; the picker shows these instead while Kids is on,
// and each mode remembers its own choice.
window.KID_THEMES = {
  candy:  { label: '🍭 Candy' },
  jungle: { label: '🌴 Jungle' },
  space:  { label: '🚀 Space' },
  diwali: { label: '🪔 Diwali' },
};
// Fallback language labels; games can pass the server's LOCALES to fillLangSelect instead.
window.LOCALES_UI = { 'en-US': 'English', 'te-IN': 'తెలుగు' };

window.Shell = (() => {
  const THEME_KEY = 'pg-theme', KID_THEME_KEY = 'pg-kids-theme', LANG_KEY = 'pg-lang', KIDS_KEY = 'pg-kids';

  // The theme list, storage key and default for the current mode (grown-up or kids).
  const mode = () => (getKids() ? { list: KID_THEMES, key: KID_THEME_KEY, def: 'candy' } : { list: THEMES, key: THEME_KEY, def: 'celebration' });
  const getTheme = () => { const m = mode(); try { const t = localStorage.getItem(m.key); return m.list[t] ? t : m.def; } catch { return m.def; } };
  const applyTheme = (t) => { const m = mode(); document.documentElement.dataset.theme = m.list[t] ? t : m.def; };
  function setTheme(t) {
    const m = mode();
    if (!m.list[t]) return;
    applyTheme(t);
    try { localStorage.setItem(m.key, t); } catch {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }

  const getLang = () => { try { return localStorage.getItem(LANG_KEY) || 'en-US'; } catch { return 'en-US'; } };
  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    window.track?.('language_change');
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  }

  // Kid mode: every game switches to kid-friendly content, timers, hints, sounds and host lines.
  const getKids = () => { try { return localStorage.getItem(KIDS_KEY) === '1'; } catch { return false; } };
  const applyKids = (on) => { document.documentElement.dataset.kids = on ? 'on' : 'off'; };
  function setKids(on) {
    on = Boolean(on);
    applyKids(on);
    try { localStorage.setItem(KIDS_KEY, on ? '1' : '0'); } catch {}
    applyTheme(getTheme());          // switch to this mode's palette
    window.track?.('kid_mode_change');
    window.dispatchEvent(new CustomEvent('kidschange', { detail: on }));
    window.dispatchEvent(new CustomEvent('themechange', { detail: getTheme() }));
  }
  // A toggle button (aria-pressed) that flips kid mode and stays in sync with other tabs/pages.
  function bindKidsToggle(btn) {
    if (!btn) return;
    const sync = () => btn.setAttribute('aria-pressed', getKids());
    sync();
    btn.addEventListener('click', () => setKids(!getKids()));
    window.addEventListener('kidschange', sync);
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KIDS_KEY) { applyKids(getKids()); applyTheme(getTheme()); window.dispatchEvent(new CustomEvent('kidschange', { detail: getKids() })); window.dispatchEvent(new CustomEvent('themechange', { detail: getTheme() })); }
  });

  // Fills the picker with the current mode's themes and refills it when kid mode flips.
  function fillThemeSelect(sel) {
    if (!sel) return;
    const fill = () => {
      sel.innerHTML = Object.entries(mode().list).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
      sel.value = getTheme();
    };
    fill();
    sel.addEventListener('change', (e) => setTheme(e.target.value));
    window.addEventListener('kidschange', fill);
    window.addEventListener('themechange', () => { sel.value = getTheme(); });
  }
  // locales: optional map code -> label|{name}. Defaults to LOCALES_UI.
  function fillLangSelect(sel, locales) {
    if (!sel) return;
    const L = locales || LOCALES_UI;
    sel.innerHTML = Object.entries(L).map(([k, v]) => `<option value="${k}">${typeof v === 'string' ? v : (v.name || k)}</option>`).join('');
    const cur = getLang();
    sel.value = L[cur] ? cur : 'en-US';
    sel.addEventListener('change', (e) => setLang(e.target.value));
  }

  applyTheme(getTheme());
  applyKids(getKids());
  return { getTheme, setTheme, getLang, setLang, getKids, setKids, bindKidsToggle, fillThemeSelect, fillLangSelect, THEMES, KID_THEMES };
})();
