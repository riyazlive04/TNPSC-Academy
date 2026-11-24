# web-page-kit — the archive's page building blocks, in React

## Purpose
Give every page the same few website parts (breadcrumbs, content + sidebar grid, section blocks, tiles) so 54 pages are converted by composition, not by copying CSS from `render.mjs`.

## Architecture (as built)
`src/components/Site/PageKit.tsx` (token classes only, web look behind `web:`/`IS_WEB`):
- `PageGrid` — native keeps `nativeWidth` (default `max-w-2xl`); web widens to `max-w-6xl` and, with `aside`, a `1fr + 300px` grid ≥1024px (sticky aside). Aside is web-only.
- `Crumbs` — pill breadcrumbs (archive `.crumbs`), router `Link`s, last = `aria-current="page"`. Renders nothing natively.
- `SectionBlock` — archive `.sec-block` card on web; plain `<section>` natively.
- No `Tile`: `ChoiceCard` already is one; it gets the web padding/hover.
Web variants on existing primitives (no new props): `List` → boxed `.rows`; `ListRow` → padded rows with hover; `SectionHeader` → 21px bold; `ChoiceGrid` → 3 columns from `sm`; `ChoiceCard` → 18px padding, brand hover border; `StatStrip` → archive `.stats` pills.
- Rule: don't nest `List` inside `SectionBlock` (card in card) — use `SectionHeader` + `List`.

## Impact map
- `ListRow`, `SectionHeader`, `ChoiceCard`, `StatStrip`, `PillSection` → ~20 pages change look on web at once. Native unchanged via `web:` variant.
- `PickerPage` (layout) — gains Crumbs + PageGrid.
- No API, DB, or route changes.

## Edge cases / failure modes
- Long Tamil titles in a crumb → ellipsis at `32ch`, full text in `title`.
- Empty aside → grid collapses to one column (no empty 300px gutter).
- Disabled/locked `ListRow` (premium lock, credit wall) keeps its lock state + click handler as a tile.
- Tile grids with 1 item don't stretch full width awkwardly.

## Acceptance criteria
- AC1 Each kit part has a vitest render test (web + native class).
- AC2 Native: shared primitives' classes unchanged once `web:` tokens are stripped.
- AC3 Crumbs are keyboard reachable and announced as a breadcrumb `nav`.
- AC4 PageGrid: 2 columns at 1280px, 1 at 768px (Playwright).
