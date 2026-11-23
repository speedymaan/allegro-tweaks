# CLAUDE.md

Guidance for Claude (and humans) working on this repo.

## Rule: keep the docs in sync

**Every change to this repo must also update `CLAUDE.md` and `README.md`** when the change affects what they describe (features, behaviour, limits, file names, how it works, how to test). Also bump `@version` in the userscript header for every change to the script, or Tampermonkey won't auto-update.

## What this is

`allegro-tweaks.user.js` is a single Tampermonkey userscript for allegro.hu (repo: https://github.com/speedymaan/allegro-tweaks). It has no build step and no dependencies. Tampermonkey auto-updates from the raw GitHub URL in `@updateURL`.

The repo is worked on from both Windows and macOS. `.gitattributes` (`* text=auto eol=lf`) keeps every text file LF in the repo and in the working copy on both, whatever each machine's `core.autocrlf` says.

It runs on all `https://allegro.hu/*` pages. Parts 1 and 3 are active only on search (`/kereses…`), category (`/kategoria/…`) and seller-shop category (`/felhasznalo/<login>/<category>`, assumed to use the same listing JSON; unverified, Allegro returns 403 to non-browser clients) paths, Part 2 only on product pages, which come in two URL forms with the same seller card: `/termek/…?offerId=…` and `/ajanlat/…`. Allegro navigates without full reloads, so a `MutationObserver` re-checks the page after every DOM change, batched with `queueMicrotask`. Don't use `requestAnimationFrame`: it doesn't fire in background tabs.

### Part 1: hide ads

- Only **"Szponzorált"** items are ads. They are detected by the label button `button[aria-label^="Szponzorált"]` inside each `<article>`, with the exact visible label text as a fallback. **Never rely on Allegro's class names**; they are generated and change often.
- **Do not hide "Reklámozott" items** (JSON `context: "PROMOTED"`). They are real offers that sellers pay to move up. In price-sorted category lists, Allegro puts all of them first in a "Reklámozott termékek" block sorted by price, then the normal items ("Termékek", `context: "REGULAR"`) sorted by price. The Reklámozott block can fill several pages and often holds the cheapest offer (checked on the 1 kg coffee-bean filter: cheapest Reklámozott 3320 Ft on page 1, cheapest normal 3590 Ft on page 6). Versions before 2.1.0 hid them, which was a bug.
- A CSS `li:has(> article …)` rule hides ads instantly (no flash), scoped by the `ahs-on` class on `<html>`. JS also adds `ahs-hide` to ad `<li>`s.

### Part 2: seller details on product pages

- Finds the seller card by `[data-box-name="Seller summary container"]`, takes the login from its `a[href*="/felhasznalo/"]` link, fetches `/felhasznalo/<login>/ertekeles` (server-rendered) and reads these `data-testid`s: `recommended-total`, `not-recommended-total`, `account-details` ("az Allegrón" + age), `removed-and-excluded-ratings-detailed` (removed-rating count, and how many of those the buyer removed after the seller compensated them).
- `sellerInfo()` reads them into `{pos, neg, details}`. `sellerHtml()` renders a green thumb-up count and a red thumb-down count (inline SVG), and below them a muted line, e.g. `9 év és 4 hónap felett az Allegrón · 150 eltávolított értékelés, ebből 49 kompenzáció után`. Text goes through `esc()`.
- The line is appended to the card's `aside > div` (the block with the seller name), so it inherits Allegro's font and padding. Muted text uses `opacity`, not a fixed colour, so it also works on a dark background.
- One fetch per seller per page load (`sellerCache`). On any failure, or if the counts are missing, the line stays empty and hidden.

### Part 3: real unit-price sort

- The button loads `?p=1..N` of the current URL with `fetch` and reads the JSON in `<script>{"__listing_StoreState"…}</script>`: `items.elements[]` (`offerId`, `title.text`, `url`, `mainThumbnail`, `price.mainPrice.amount`, `pricePerUnit[0].labelParts[].text`, `parameters[]`, `isSponsored` / `context === "SPONSORED"` for ads; `compliance.label` is also set on "Reklámozott" items, so don't use it) and `items.searchMeta.lastAvailablePage`.
- **Complete or nothing:** if `lastAvailablePage > MAX_PAGES` (10), it refuses and asks the user to narrow the filters. Pages beyond the last one return page 1 again, so always use `lastAvailablePage`.
- Unit labels: `Ft/kg`, `Ft/100 g`, `Ft/l`, `Ft/100 ml`, `Ft/egység`, normalised by `parseUnit` to kg / l / egység.
- Bad seller data is common. `suspicious()` compares the pack size implied by Allegro's unit price with the size in the title (`titleQty`, which takes priority because per-bag parameters on multipacks are normal) or else the parameters (`paramQty`). If they differ by more than 20%, the item shows ⚠ and sorts by the size-based price. If it's absurd (>100 kg/l) with no size to correct it, it shows "(hibás?)" and goes last. `egység` (per-piece) prices are not checked.
- Seller-provided strings go into `innerHTML`, so always pass them through `esc()`, and URLs through `safeUrl()`.

## Testing

- The script runs `console.assert` self-checks for `sellerInfo`, `parseUnit`, `paramQty`, `titleQty` and `suspicious` on load. Run them outside the browser with:

  ```sh
  node -e "const s=require('fs').readFileSync('allegro-tweaks.user.js','utf8');new Function(s);let f=0;console.assert=(c,m)=>{if(!c){f++;console.log('FAIL',m)}};eval(s.slice(s.indexOf('function sellerInfo'),s.indexOf('async function loadPage')));console.log('failed:',f)"
  ```

- Manual check in the browser with Tampermonkey:
  - The "Szponzorált" ads are gone on a category page, page 2 (loaded in place) and a `/kereses` search.
  - On `https://allegro.hu/kategoria/kave-szemes-kave-74035?csomagolas-merete=1000%20g&allegro-smart-standard=1&order=p`, page 1 shows its ~60 "Reklámozott" offers and hides only the 4 "Szponzorált" ones.
  - The sort on `https://allegro.hu/kategoria/allateledel-szaraz-tap-90040?marka=Purina&marka=Purina%20ONE&order=ppu` (2 pages) puts the 9.75 kg Purina One bags (≈1610 Ft/kg) near the top, and the "Purina ONE Junior 8x750 g" with wrong data gets ⚠.
  - A broad search (e.g. `ásványvíz`, 12 pages) is refused.
  - On `https://allegro.hu/termek/sodastream-terra-feketeviz-szodakeszito-gep-fuse-1l-palack-gaz-db336b60-1528-42c7-becb-074fbf8a2b4f?offerId=12908146605` the seller card shows the green 👍 / red 👎 counts and the muted details line under "Ajánlja …%", in the card's own font, matching `https://allegro.hu/felhasznalo/esiteo_pl/ertekeles`. Also check an `/ajanlat/` page, e.g. `https://allegro.hu/ajanlat/purina-one-sterilcat-beef-wheat-szaraz-macskaeledel-9-75kg-marhahus-18678856831`.
