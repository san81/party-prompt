# Build guidelines

## Golden rules

- **No dependencies, no build step, no framework.** Node ≥ 18, ES modules. `npm start` =
  `node server.js`. There is no bundler; pages are single self-contained HTML files with inline
  CSS/JS (plus the two shared files `theme.css` / `theme.js` and the generated `rapid/items.js`).
  Don't add `npm install` steps unless the user explicitly asks.
- **Match the surrounding style.** Comment density, naming, idioms. These pages favour terse,
  readable vanilla JS and a small `STR` i18n object per page.
- **Never hardcode colours.** Use the theme tokens (`var(--brass)` etc.). New visual elements
  must work in all four themes — check `daylight` (light) especially, since text/really needs
  contrast there.
- **New visible string → add it to `STR` for BOTH `en-US` and `te-IN`.** Both games must stay
  fully playable in both languages.
- **Secrets stay server-side.** The Jev key is only in `.env` / the host's env. Never ship it
  to the browser.

## Running locally

```bash
npm start                 # http://localhost:3000  (landing); /vibe and /rapid
npm run lint-topics       # after editing lib/topics/*.js — must print "No problems found."
npm run eval              # Vibe matcher scorecard (needs a key for the Jev path)
```

`.env` (git-ignored) for Jev via OpenRouter:

```
TYPESAFE_API_KEY=sk-or-...
TYPESAFE_URL=https://openrouter.ai/api/v1/systemone
JEV_MODEL=jev-1.13
```

## Deploying (Render)

`render.yaml` defines the web service. On the host set **all three** Jev env vars above
(not just the key) or Jev 401s / silently falls back to local. `/api/status` showing `jev:true`
only proves a key is present, not that it authenticates — test `/api/match-one` with a synonym.

## Regenerating Rapid Fire items

If you add/remove images under `public/rapid/items/<category>/`, regenerate the manifest:

```bash
node -e '
import("node:fs").then(fs=>{
  const dir="public/rapid/items", EXCLUDE=new Set(["missingPerson"]);
  const labels={alphabetPrior:{en:"Alphabet",te:"అక్షరమాల"},animals:{en:"Animals",te:"జంతువులు"},
    kitchenObject:{en:"Kitchen",te:"వంటగది వస్తువులు"},logo:{en:"Brand Logos",te:"బ్రాండ్ లోగోలు"},
    moviesNameFromPoster:{en:"Movie Posters",te:"సినిమా పోస్టర్లు"},seeds:{en:"Seeds",te:"విత్తనాలు"},
    usStates:{en:"US States",te:"అమెరికా రాష్ట్రాలు"}};
  const clean=f=>{let n=f.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").trim();
    return n.length<=2?n.toUpperCase():n[0].toUpperCase()+n.slice(1);};
  const cats=fs.readdirSync(dir).filter(c=>!EXCLUDE.has(c)&&fs.statSync(dir+"/"+c).isDirectory());
  const items={}; for(const c of cats){const files=fs.readdirSync(dir+"/"+c).filter(f=>/\.(png|jpe?g|gif|webp)$/i.test(f));
    items[c]=files.map(f=>({file:f,answer:clean(f)}));}
  const categories=cats.map(c=>({key:c,en:labels[c]?.en||c,te:labels[c]?.te||c,count:items[c].length}));
  fs.writeFileSync("public/rapid/items.js",
    "window.RAPID_CATEGORIES = "+JSON.stringify(categories,null,2)+";\nwindow.RAPID_ITEMS = "+JSON.stringify(items,null,2)+";\n");
  console.log("ok", categories.map(c=>c.key+"("+c.count+")").join(", "));
});'
```

Add a `labels` entry for any new category (English + Telugu) so the dropdown is translated.

## Adding a third game (pattern)

1. New `public/<game>.html` — copy the head block (theme head-script + fonts + theme.css),
   a top bar with `← Menu`, Jev pill, Sounds/Host toggles, `langSel`, `themeSel`.
2. Add a route in `server.js`'s `pretty` map and a card on the landing (`public/index.html`).
3. If it needs matching, add an endpoint + a function in `lib/matcher.js` reusing `askJev`.
4. Give it its own `STR` (en + te), wire `Shell.fillThemeSelect` / `fillLangSelect` and a
   `langchange` listener. Reuse the mic/`say()` pattern from an existing game verbatim.
