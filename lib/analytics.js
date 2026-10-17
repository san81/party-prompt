// Google Analytics 4, switched on by GA_MEASUREMENT_ID. The server serves /analytics.js,
// which every page loads in <head>. It always defines window.track(name, params) so pages
// can log game events; without an ID it's a no-op and nothing is sent to Google.
// Many players are children, so Google signals and ad personalisation stay off.
import { config } from './config.js';

export const analyticsConfigured = () => /^G-[A-Z0-9]{4,20}$/.test(config.gaId);

export function analyticsScript() {
  if (!analyticsConfigured()) return 'window.track = function () {};\n';
  const id = JSON.stringify(config.gaId);
  return `(function () {
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ${id};
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  var kids = function () { try { return localStorage.getItem('pg-kids') === '1'; } catch (e) { return false; } };
  var lang = function () { try { return localStorage.getItem('pg-lang') || 'en-US'; } catch (e) { return 'en-US'; } };
  gtag('js', new Date());
  gtag('config', ${id}, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    kid_mode: kids() ? 'on' : 'off',
    game_lang: lang(),
  });
  // Every event carries the current kid mode and language so reports can be split by them.
  window.track = function (name, params) {
    try { gtag('event', name, Object.assign({ kid_mode: kids() ? 'on' : 'off', game_lang: lang() }, params || {})); } catch (e) {}
  };
})();
`;
}
