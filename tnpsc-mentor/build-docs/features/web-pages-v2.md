# Web app as web pages (v2) — feature designs

Browser only (`IS_WEB` / `web:`); Android output must not change except where decision A says so.

## 1. web-look-revert
- **Purpose:** keep the app's visual design on web; v1 changed it.
- **Architecture:** remove the visual `web:` tokens from List, ListRow, SectionHeader, ChoiceCard, ChoiceGrid gap, CardGrid/GridCard padding, StatStrip, `WEB_EYEBROW`, dashboard greeting pill, header nav text-only style (icons back). Keep `web:` for structure: header/footer, Crumbs, PageGrid width + aside, footer pinning, PickerPage crumbs.
- **Impact:** same files as v1; webPageKit.test AC2 still holds (native classes unchanged).
- **Edge:** Tamil nav fit (v1 fix used short labels; with icons back it needs re-measuring at 1536).
- **AC:** web screenshots match the native look per component; header/footer/crumbs/sidebar still present; Tamil nav one line at ≥1280.

## 2. web-menu
- **Purpose:** a phone browser gets a website menu, not an app tab bar.
- **Architecture:** AppLayout: on web below `lg`, a menu button in the header opens a drawer (focus-trapped, Esc/backdrop close, `aria-expanded`) listing the full nav (LEARNER_NAV / ADMIN_NAV with the same flag filters). Bottom tab bar not rendered on web; main/footer padding for it removed.
- **Impact:** AppLayout; `useFocusTrap` reused; onboarding tour anchors (`data-tour`) on bottom-nav items, if any.
- **Edge:** route change closes the drawer; body scroll locked while open; Tamil labels wrap inside the drawer; reports badge count shown.
- **AC:** 320–1023px web: no bottom bar, menu reachable by keyboard, every nav destination reachable; native unchanged.

## 3. web-links
- **Purpose:** navigation behaves like links — open in new tab, copy link, middle-click, visible URL.
- **Architecture:** ListRow / ChoiceCard / GridCard / header nav / PickerPage crumbs accept `to` → render router `Link` (same classes); pure-navigation `onClick={() => navigate(x)}` sites switch to `to`. Action handlers (start test, credit confirm, purchase, sheets) stay buttons. Web disables route cross-fade (AnimatedRoutes) and tap-scale.
- **Impact:** ~25 page files + 3 shared primitives + App.tsx AnimatedRoutes (App.tsx has someone else's uncommitted WIP — edit around it, stage only my hunk).
- **Edge:** `navigate(x, { state })` sites need `Link state`; locked/disabled items must not be links (keep button); prefetch on hover kept.
- **AC:** unit test: ListRow with `to` renders `<a href>`; without renders `<button>`. Manual: ctrl-click opens a new tab on dashboard, pickers, nav.

## 4. web-crumbs
- **Purpose:** website breadcrumbs instead of app back buttons.
- **Architecture:** the 19 back-button pages render `Crumbs` on web (`web:hidden` on the back button, as PickerPage does); trails derived from the route; step pages use decision A's URL steps for crumb links.
- **Edge:** deep-linked pages with no history still have a crumb home; long Tamil crumb labels truncate.
- **AC:** every non-quiz page on web shows crumbs; no back button on web; native unchanged.

## 5. web-sheets-to-pages
- **Purpose:** content/navigation sheets become pages on web.
- **Architecture:** web: CA hub card → link to `/test-arena/current-affairs`; Daily CA → `/ca/test`; Thirukkural → new `/thirukural` page (reuses ThirukuralModal's list/detail body); Upsell (402 / locked tap) → `/plans` page with the purchase cards (decision B); OfferSheet → disabled on web, cards inline at top of a locked series (decision C).
- **Impact:** TestArenaPage, CurrentAffairsHubSheet, DailyCaSheet, ThirukuralModal, upsellStore/UpsellModal, TestSeriesProductPanel, App.tsx routes (+2).
- **Edge:** `/plans` must honour payment sale switches (Payments tab) and owned plans; return path after purchase; `/thirukural` deep link to a kural number.
- **AC:** on web none of these sheets open; each destination is a URL; purchases still go through PurchaseConfirmModal → Razorpay.
