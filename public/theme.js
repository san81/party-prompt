// Shared site shell: theme + global language, used by the landing and both games.
// The active theme is also set by a tiny inline <head> script on each page (before this
// loads) to avoid a flash of the wrong theme. Both settings persist and are site-wide.

window.THEMES = {
  celebration: { label: '🎉 Celebration' },
  fall:        { label: '🍂 Fall' },
  midnight:    { label: '🌙 Midnight' },
  neon:        { label: '⚡ Neon' },
  daylight:    { label: '☀️ Daylight' },
};
// Fallback language labels; games can pass the server's LOCALES to fillLangSelect instead.
window.LOCALES_UI = { 'en-US': 'English', 'te-IN': 'తెలుగు' };

window.Shell = (() => {
  const THEME_KEY = 'pg-theme', LANG_KEY = 'pg-lang';

  const getTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return THEMES[t] ? t : 'celebration'; } catch { return 'celebration'; } };
  const applyTheme = (t) => { document.documentElement.dataset.theme = THEMES[t] ? t : 'celebration'; };
  function setTheme(t) {
    if (!THEMES[t]) return;
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }

  const getLang = () => { try { return localStorage.getItem(LANG_KEY) || 'en-US'; } catch { return 'en-US'; } };
  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  }

  function fillThemeSelect(sel) {
    if (!sel) return;
    sel.innerHTML = Object.entries(THEMES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    sel.value = getTheme();
    sel.addEventListener('change', (e) => setTheme(e.target.value));
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
  return { getTheme, setTheme, getLang, setLang, fillThemeSelect, fillLangSelect, THEMES };
})();
