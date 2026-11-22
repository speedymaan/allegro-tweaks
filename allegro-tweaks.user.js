// ==UserScript==
// @name         Allegro.hu tweaks
// @namespace    https://github.com/speedymaan/allegro-tweaks
// @version      2.2.0
// @description  Hides "Szponzorált" ads, adds a real unit-price sort for filtered allegro.hu result lists, and shows seller rating details on product pages.
// @homepageURL  https://github.com/speedymaan/allegro-tweaks
// @updateURL    https://raw.githubusercontent.com/speedymaan/allegro-tweaks/main/allegro-tweaks.user.js
// @downloadURL  https://raw.githubusercontent.com/speedymaan/allegro-tweaks/main/allegro-tweaks.user.js
// @match        https://allegro.hu/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ───────────── Part 1: hide ads ─────────────
  // Allegro's class names are generated and change often, so nothing relies on them.
  // Ads are recognised by their label button ("Szponzorált tipp megjelenítése"),
  // with the visible label text as a fallback.
  // "Reklámozott" items are NOT hidden: in price-sorted lists they are real offers in price order,
  // often including the cheapest one. Only "Szponzorált" items are inserted out of order.
  const AD_WORDS = ['Szponzorált'];
  const ON_CLASS = 'ahs-on';     // set on <html> while on a search/category page
  const HIDE_CLASS = 'ahs-hide'; // set on each list item we hide

  // The site navigates without full reloads, so this is re-checked constantly.
  const isListingPage = () => /^\/(kereses|kategoria\/)/.test(location.pathname);

  const labelSel = AD_WORDS.map(w => `button[aria-label^="${w}"]`);
  const style = document.createElement('style');
  style.textContent =
    labelSel.map(s => `html.${ON_CLASS} li:has(> article ${s})`).join(',\n') +
    `,\nhtml.${ON_CLASS} .${HIDE_CLASS} { display: none !important; }
    #aus-btn { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; padding: 10px 14px;
      border: 0; border-radius: 8px; background: #ff5a00; color: #fff; font: 600 14px sans-serif; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    html:not(.${ON_CLASS}) #aus-btn { display: none; }
    #aus-panel { position: fixed; inset: 4vh 4vw; z-index: 2147483001; background: #fff; color: #222;
      border-radius: 10px; box-shadow: 0 4px 30px rgba(0,0,0,.4); display: flex; flex-direction: column; font: 14px sans-serif; }
    #aus-panel header { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #ddd; }
    #aus-panel header strong { font-size: 16px; }
    #aus-panel header span { flex: 1; color: #555; }
    #aus-panel header button { border: 0; background: none; font-size: 22px; cursor: pointer; color: #222; }
    #aus-panel .aus-body { overflow: auto; padding: 0 16px 16px; }
    #aus-panel h3 { margin: 16px 0 6px; font-size: 15px; }
    #aus-panel a.aus-row { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: center;
      padding: 6px 0; border-bottom: 1px solid #eee; color: inherit; text-decoration: none; }
    #aus-panel a.aus-row:hover { background: #f6f6f6; }
    #aus-panel img { width: 56px; height: 56px; object-fit: contain; }
    #aus-panel .aus-ppu { font-weight: 700; text-align: right; white-space: nowrap; }
    #aus-panel .aus-price { color: #555; font-weight: 400; display: block; }
    #aus-panel .aus-bad { color: #b00; }
    .ats-seller { margin: 8px 0; font-size: 14px; }
    .ats-seller:empty { display: none; }`;
  (document.head || document.documentElement).appendChild(style);

  function isAdArticle(article) {
    if (article.querySelector(labelSel.join(','))) return true;
    for (const el of article.querySelectorAll('p, span, div')) {
      if (el.childElementCount === 0 && AD_WORDS.includes(el.textContent.trim())) return true;
    }
    return false;
  }

  function collectHidden() {
    const hide = new Set();
    for (const article of document.querySelectorAll('article')) {
      if (isAdArticle(article)) hide.add(article.closest('li') || article);
    }
    return hide;
  }

  function update() {
    if (isProductPage()) addSellerInfo();
    const on = isListingPage();
    document.documentElement.classList.toggle(ON_CLASS, on);
    if (!on) return;
    if (document.body && !document.getElementById('aus-btn')) addSortButton();
    const hide = collectHidden();
    // Re-sync every time: the site may reuse an element for a different offer.
    for (const el of document.querySelectorAll('.' + HIDE_CLASS)) {
      if (!hide.has(el)) el.classList.remove(HIDE_CLASS);
    }
    for (const el of hide) el.classList.add(HIDE_CLASS);
  }

  // ───────────── Part 2: seller details on product pages ─────────────
  // The seller's ratings page (/felhasznalo/<login>/ertekeles) has the numbers behind Allegro's
  // "Ajánlja 98,7%" under stable data-testid names. One fetch per seller per page load.
  const isProductPage = () => location.pathname.startsWith('/termek/');
  const sellerCache = new Map(); // ratings URL → Promise<line text>

  // get(testid) → that element's text or null. Returns '' when the page has no rating counts.
  function sellerLine(get) {
    const pos = get('recommended-total'), neg = get('not-recommended-total');
    if (!pos || !neg) return '';
    const parts = [`👍 ${pos}`, `👎 ${neg}`];
    const age = get('account-details')?.replace(/^az Allegrón\s*/, '');
    if (age) parts.push(`${age} az Allegrón`);
    const rem = get('removed-and-excluded-ratings-detailed') || '';
    const removed = rem.match(/(\d+) eltávolított/), comp = rem.match(/ebből (\d+) kompenzáció/);
    if (removed) parts.push(`${removed[1]} eltávolított értékelés` + (comp ? ` (${comp[1]} kompenzáció után)` : ''));
    return parts.join(' · ');
  }
  const T = o => id => o[id] ?? null;
  console.assert(sellerLine(T({ 'recommended-total': '50302', 'not-recommended-total': '669',
    'account-details': 'az Allegrón9 év és 4 hónap felett',
    'removed-and-excluded-ratings-detailed': '150 eltávolított értékelés (3 az Allegro által, 147 a vevők által, ebből 49 kompenzációt követően)Az Allegro…520 kizárt értékelés' }))
    === '👍 50302 · 👎 669 · 9 év és 4 hónap felett az Allegrón · 150 eltávolított értékelés (49 kompenzáció után)', 'sellerLine full');
  console.assert(sellerLine(T({ 'recommended-total': '3', 'not-recommended-total': '0' })) === '👍 3 · 👎 0', 'sellerLine minimal');
  console.assert(sellerLine(T({})) === '', 'sellerLine no data');

  function addSellerInfo() {
    const box = document.querySelector('[data-box-name="Seller summary container"]');
    const link = box?.querySelector('a[href*="/felhasznalo/"]');
    if (!link) return;
    const url = link.pathname.split('/').slice(0, 3).join('/') + '/ertekeles'; // "/felhasznalo/<login>/…" → ratings page
    if (box.querySelector('.ats-seller')?.dataset.url === url) return;
    box.querySelector('.ats-seller')?.remove();
    const el = document.createElement('p');
    el.className = 'ats-seller';
    el.dataset.url = url;
    const hr = box.querySelector('aside > hr'); // divider under the seller name, inside the white card
    hr ? hr.before(el) : box.append(el);
    if (!sellerCache.has(url)) {
      sellerCache.set(url, fetch(url, { credentials: 'include' }).then(r => r.text()).then(html => {
        const d = new DOMParser().parseFromString(html, 'text/html');
        return sellerLine(id => d.querySelector(`[data-testid="${id}"]`)?.textContent.replace(/\s+/g, ' ').trim() || null);
      }).catch(() => '')); // on any failure show nothing rather than break the product page
    }
    sellerCache.get(url).then(text => { el.textContent = text; });
  }

  // ───────────── Part 3: real unit-price sort ─────────────
  // Loads every page of the current (filtered) result list and sorts by unit price.
  // Complete or nothing: above MAX_PAGES it refuses instead of sorting a partial list.
  const MAX_PAGES = 10;
  const UNIT_NAMES = { kg: 'Ft/kg', l: 'Ft/l', egység: 'Ft/db' };

  // "669 Ft/100 g" → {v: 6690, u: 'kg'}; "1 610 Ft/kg" → {v: 1610, u: 'kg'}; "81 Ft/egység" → {v: 81, u: 'egység'}
  function parseUnit(label) {
    const m = String(label || '').replace(/\s/g, '').match(/^([\d.,]+)Ft\/(\d*)(kg|g|l|ml|egység)$/i);
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.'));
    const q = m[2] ? +m[2] : 1;
    const u = m[3].toLowerCase();
    if (u === 'g') return { v: v * 1000 / q, u: 'kg' };
    if (u === 'ml') return { v: v * 1000 / q, u: 'l' };
    return { v: v / q, u };
  }
  console.assert(parseUnit('669 Ft/100 g')?.v === 6690 && parseUnit('669 Ft/100 g').u === 'kg', 'parseUnit 100 g');
  console.assert(parseUnit('1 610 Ft/kg')?.v === 1610, 'parseUnit kg');
  console.assert(parseUnit('5067 Ft/100 ml')?.v === 50670 && parseUnit('5067 Ft/100 ml').u === 'l', 'parseUnit 100 ml');
  console.assert(parseUnit('81 Ft/egység')?.u === 'egység', 'parseUnit egység');
  console.assert(parseUnit('ingyen') === null && parseUnit(undefined) === null, 'parseUnit junk');

  // Total size from the item's own parameters ("Termék tömege=6 kg", "Űrtartalom=1000 ml" × "Darabszám a csomagban"),
  // in the same base unit (kg or l) as the unit price, or null.
  function paramQty(params, base) {
    let qty = null, count = 1;
    for (const p of params || []) {
      const val = String((p.values || [])[0] || '');
      if (/^(Termék tömege|Tömeg|Tömeg \(g\)|Űrtartalom)$/.test(p.name)) {
        const m = val.replace(',', '.').match(/^([\d.]+)\s*(kg|g|l|ml)$/i);
        if (!m) continue;
        const u = m[2].toLowerCase();
        if ((u === 'kg' || u === 'g' ? 'kg' : 'l') === base) qty = (u === 'g' || u === 'ml') ? m[1] / 1000 : +m[1];
      }
      if (p.name === 'Darabszám a csomagban' && parseInt(val) > 0) count = parseInt(val);
    }
    return qty ? qty * count : null;
  }

  // Total size written in the title: "2x900ml", "75MLX2", "330 ml - 24 db", "6x Purina … 1,4 kg", "1 kg … x 2".
  // shortcut: only these common patterns; anything else returns null and the parameters decide.
  function titleQty(title, base) {
    const s = String(title || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
    const U = '(kg|g|l|ml)(?![a-wyzáéíóöőúüű])'; // unit not followed by a letter, except "x" ("75mlx2")
    const toBase = (n, u) => ((u === 'kg' || u === 'g' ? 'kg' : 'l') === base ? ((u === 'g' || u === 'ml') ? n / 1000 : n) : null);
    let m = s.match(new RegExp('(\\d+)\\s*[x×*]\\s*(\\d+(?:\\.\\d+)?)\\s*' + U));
    if (m) return toBase(+m[2], m[3]) && toBase(+m[2], m[3]) * m[1];
    m = s.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U + '\\s*[x×*]\\s*(\\d+)'));
    if (m) return toBase(+m[1], m[2]) && toBase(+m[1], m[2]) * m[3];
    m = s.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U));
    const size = m && toBase(+m[1], m[2]);
    if (!size) return null;
    const c = s.match(/(?:^|\s)[x×]\s*(\d+)\b|\b(\d+)\s*(?:db|darab)\b|(?:^|\s)(\d+)\s*[x×]\s+(?=\D)/);
    return size * (c ? +(c[1] || c[2] || c[3]) : 1);
  }

  const near = (a, b) => a && b && Math.abs(a / b - 1) <= 0.2;

  // Sellers sometimes enter wrong sizes (1500 ml dish soap shown as "2 Ft/l", a 6 kg pack as 48 kg).
  // The title is the tie-breaker because per-bag parameters on multipacks are normal.
  // Returns null if Allegro's unit price looks right, the size-based price if not, NaN if absurd but unknown.
  function suspicious(price, unit, params, title) {
    if (unit.u === 'egység') return null; // piece counts in parameters are too often wrong to judge by
    const implied = price / unit.v;       // pack size Allegro's unit price implies
    const tq = titleQty(title, unit.u), pq = paramQty(params, unit.u);
    if (tq) return near(implied, tq) ? null : price / tq;
    if (pq && !near(implied, pq)) return price / pq;
    return implied > 100 ? NaN : null;    // >100 kg/l for a consumer pack
  }
  const W = v => [{ name: 'Termék tömege', values: [v] }];
  console.assert(paramQty(W('6 kg'), 'kg') === 6, 'paramQty kg');
  console.assert(Math.abs(paramQty([{ name: 'Űrtartalom', values: ['330 ml'] }, { name: 'Darabszám a csomagban', values: ['24 db'] }], 'l') - 7.92) < 1e-9, 'paramQty multipack');
  console.assert(paramQty([{ name: 'Űrtartalom', values: ['1 l'] }], 'kg') === null, 'paramQty other unit');
  for (const [t, b, want] of [['Fairy Folyadék Lemon 2x900ml', 'l', 1.8], ['FOGKRÉM ELMEX 75MLX2', 'l', 0.15],
    ['Cisowianka víz 330 ml - 24 db', 'l', 7.92], ['Lavazza Suerte 1 kg szemes kávé x 2', 'kg', 2], ['Mosogatószer0,9 l', 'l', 0.9],
    ['6x Purina One száraztáp 1,4 kg', 'kg', 8.4], ['Persil Color 4,4 kg 80 mosás', 'kg', 4.4], ['Laptop 15 col', 'kg', null]]) {
    const got = titleQty(t, b);
    console.assert(want === null ? got === null : near(got, want), 'titleQty: ' + t + ' → ' + got);
  }
  console.assert(Math.round(suspicious(26140, { v: 545, u: 'kg' }, W('6 kg'), 'Purina ONE Junior 8x750 g')) === 4357, 'suspicious: seller multiplied pack');
  console.assert(suspicious(13185, { v: 2198, u: 'kg' }, W('750 g'), 'PURINA ONE NATURAL DEFENSE 8x750g') === null, 'suspicious: multipack is fine');
  console.assert(suspicious(15700, { v: 1610, u: 'kg' }, W('9.75 kg'), 'Purina One Sterilcat 9,75kg') === null, 'suspicious: correct');
  console.assert(Math.round(suspicious(2425, { v: 2, u: 'l' }, [], 'Fairy Original Lemon 1500 ml')) === 1617, 'suspicious: absurd, title size');
  console.assert(Number.isNaN(suspicious(2425, { v: 2, u: 'l' }, [], 'Fairy')), 'suspicious: absurd, no size');

  async function loadPage(n) {
    const url = new URL(location.href);
    url.searchParams.set('p', n);
    const html = await (await fetch(url, { credentials: 'include' })).text();
    const m = html.match(/<script[^>]*>(\{"__listing_StoreState".*?)<\/script>/s);
    if (!m) throw new Error('Allegro nem adott találati adatot (captcha vagy hiba). Töltsd újra az oldalt, és próbáld újra.');
    return JSON.parse(m[1]).__listing_StoreState.items;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const safeUrl = (u, prefix) => (typeof u === 'string' && u.startsWith(prefix) ? u : '');
  const fmt = n => Math.round(n).toLocaleString('hu-HU');

  function addSortButton() {
    const btn = document.createElement('button');
    btn.id = 'aus-btn';
    btn.type = 'button';
    btn.textContent = 'Egységár ↑ (valódi)';
    btn.addEventListener('click', runSort);
    document.body.appendChild(btn);
  }

  function openPanel() {
    document.getElementById('aus-panel')?.remove();
    const panel = document.createElement('div');
    panel.id = 'aus-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Valódi egységár szerinti lista');
    panel.innerHTML = '<header><strong>Egységár szerint</strong><span aria-live="polite"></span>' +
      '<button type="button" aria-label="Bezárás">✕</button></header><div class="aus-body"></div>';
    const close = () => { panel.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    panel.querySelector('header button').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(panel);
    panel.querySelector('header button').focus();
    return { status: t => { panel.querySelector('header span').textContent = t; }, body: panel.querySelector('.aus-body') };
  }

  async function runSort() {
    const ui = openPanel();
    try {
      ui.status('Betöltés: 1. oldal…');
      const first = await loadPage(1);
      const meta = first.searchMeta || {};
      const pages = meta.lastAvailablePage || 1;
      if (pages > MAX_PAGES) {
        ui.status(`Túl sok találat: ${pages} oldal (${fmt(meta.availableCount || 0)} termék). ` +
          `Szűkítsd a szűrőkkel legfeljebb ${MAX_PAGES} oldalra, hogy a lista teljes legyen.`);
        return;
      }
      const elements = [...first.elements];
      for (let p = 2; p <= pages; p++) {
        ui.status(`Betöltés: ${p}/${pages}. oldal…`);
        await new Promise(r => setTimeout(r, 300)); // be gentle, avoids Allegro's bot check
        elements.push(...(await loadPage(p)).elements);
      }
      render(ui, elements, pages);
    } catch (err) {
      ui.status(err.message);
    }
  }

  function render(ui, elements, pages) {
    const seen = new Set();
    const groups = {};
    let noUnit = 0, ads = 0;
    for (const e of elements) {
      if (!e.offerId || seen.has(e.offerId)) continue;
      seen.add(e.offerId);
      if (e.isSponsored || e.context === 'SPONSORED') { ads++; continue; } // "Reklámozott" (PROMOTED) stays: real offers
      const price = parseFloat(e.price?.mainPrice?.amount);
      const unit = parseUnit(e.pricePerUnit?.[0]?.labelParts?.map(p => p.text).join(''));
      if (!unit || !price) { noUnit++; continue; }
      const alt = suspicious(price, unit, e.parameters, e.title?.text);
      (groups[unit.u] ||= []).push({ e, price, unit, bad: alt !== null, alt });
    }
    const total = seen.size - ads;
    ui.status(`Teljes lista: ${total} termék ${pages} oldalról. Hirdetések kihagyva: ${ads}. Egységár nélkül: ${noUnit}.`);
    const units = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    if (!units.length) { ui.body.innerHTML = '<p>Ennél a listánál az Allegro nem ad egységárat.</p>'; return; }
    ui.body.innerHTML = units.map(u => {
      // Wrong-looking unit prices sort by the size-based value; unknown ones (NaN) go last.
      const key = r => (r.bad ? (Number.isNaN(r.alt) ? Infinity : r.alt) : r.unit.v);
      const rows = groups[u].sort((a, b) => key(a) - key(b));
      const unitName = UNIT_NAMES[u];
      return `<h3>${unitName} (${rows.length})</h3>` + rows.map(({ e, price, unit, bad, alt }) => `
        <a class="aus-row" href="${esc(safeUrl(e.url, 'https://allegro.hu/'))}" target="_blank" rel="noopener">
          <img src="${esc(safeUrl(e.mainThumbnail, 'https://'))}" alt="" loading="lazy">
          <span>${esc(e.title?.text)}</span>
          <span class="aus-ppu${bad ? ' aus-bad' : ''}">${!bad ? `${fmt(unit.v)} ${unitName}`
            : Number.isNaN(alt) ? `⚠ ${fmt(unit.v)} ${unitName} (hibás?)`
            : `⚠ ${fmt(alt)} ${unitName}<span class="aus-price">Allegro szerint ${fmt(unit.v)}</span>`}
            <span class="aus-price">${fmt(price)} Ft</span></span>
        </a>`).join('');
    }).join('');
  }

  // ───────────── wiring ─────────────
  // Batch bursts of DOM changes into one update. A microtask (not
  // requestAnimationFrame) so it also runs in background tabs.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      update();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  update();
})();
