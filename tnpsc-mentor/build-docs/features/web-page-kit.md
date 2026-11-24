# web-page-kit — the archive's page building blocks, in React

## Purpose
Give every page the same few website parts (breadcrumbs, content + sidebar grid, section blocks, tiles) so 54 pages are converted by composition, not by copying CSS from `render.mjs`.

## Architecture
New in `src/components/site/` (each ~20–40 lines, token classes only):
- `Crumbs` — pill breadcrumbs (archive `.crumbs`); last pill = current page, `aria-current`. Web only; renders nothing on native.
- `PageGrid` — `main` + optional `aside` (300px, ≥1024px side by side, stacked below). Native: renders only `main` unless the page opts the aside in.
- `SectionBlock` — titled card section (archive `.sec-block`).
- `Tile` — linked card with title, meta pill, short line (archive `.tile`). Used for choosers.
Web variants on existing primitives (no new props): `ListRow`/`List` → tile grid on web; `SectionHeader` → archive section label; `ChoiceCard` → archive tile proportions; `StatStrip` → archive `.stats`.

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
- AC2 `ListRow` on native: DOM classes unchanged vs current (snapshot).
- AC3 Crumbs are keyboard reachable and announced as a breadcrumb `nav`.
- AC4 PageGrid: 2 columns at 1280px, 1 at 768px (Playwright).
