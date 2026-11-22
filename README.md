# allegro-tweaks

A Tampermonkey userscript that makes searching on [allegro.hu](https://allegro.hu) better:

1. **Hides ads.** Removes "Szponzorált" listings from search and category results. "Reklámozott" listings stay visible: they are real offers that sellers pay to move up, and in price-sorted lists they are in price order and often include the cheapest offer.
2. **Real unit-price sort.** Adds an **"Egységár ↑ (valódi)"** button to search and category pages. It loads *every* page of the current result list and sorts it by Ft/kg, Ft/l or Ft/db, in its own panel.
3. **Seller details.** On product pages, adds the details from the seller's "Értékelések és vélemények" page to the seller card: positive (green) and negative (red) rating counts, how long they've been on Allegro, and how many ratings were removed (and how many of those after the seller compensated the buyer). The "Ajánlja 98,7%" alone doesn't tell you whether that's 4 ratings or 50 000.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open [allegro-tweaks.user.js (raw)](https://raw.githubusercontent.com/speedymaan/allegro-tweaks/main/allegro-tweaks.user.js) and click **Install** in Tampermonkey.

Tampermonkey checks this URL for updates automatically.

## Using the unit-price sort

1. Search or open a category, then **narrow it with Allegro's filters** (brand, package size, etc.).
2. Click **Egységár ↑ (valódi)** in the bottom-right corner.

- **Complete or nothing.** If the list has more than 10 pages, the script refuses to sort and asks you to narrow the filters. A partially sorted list could miss the cheapest item.
- "Szponzorált" ads are left out; "Reklámozott" offers are included. Items with different units (kg, l, db) are listed in separate sections.
- **Lists with one fixed size** (e.g. the "Csomagolás mérete: 1000 g" filter) don't need this button, even above 10 pages: there the price *is* the unit price, so use Allegro's "ár: növekvő" sort. Allegro shows such lists in two blocks, both sorted by price: first all "Reklámozott" offers, then the normal ones under the "Termékek" heading (can start several pages later). The cheapest offer is the cheaper of the two blocks' first items.
- **⚠ marks a unit price that looks wrong.** Sellers sometimes enter wrong sizes (e.g. a 1500 ml dish soap listed at "2 Ft/l"). The script compares Allegro's unit price with the size in the title and in the item's parameters. If they disagree, it shows the size-based price with ⚠ and sorts by it. Unit prices that are absurd but can't be corrected are marked "(hibás?)" and listed last.
- Items Allegro gives no unit price for (e.g. WC paper, diapers) are only counted, not sorted.

## Limits

- It reads Allegro's internal page data, which can change without notice. If the sort stops working, the ads part keeps working independently. If the seller line can't be read, it simply doesn't appear.
- The seller line costs one extra page load per product page you open.
- The size check reads common title patterns ("2x900ml", "330 ml - 24 db", "6x … 1,4 kg"). Unusual titles can cause false ⚠ marks; they are shown, never hidden.
- Loading many pages quickly can trigger Allegro's captcha. Pages are loaded one at a time with a short pause; if a captcha appears, the script stops with a message.
