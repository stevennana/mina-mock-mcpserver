# Product UI Primitives

## Source
This direction was decided with Stitch MCP for the `MCP Mock Server Product UI System` project.

| Stitch artifact | Value |
|---|---|
| Project | `projects/13976778818577409505` |
| Design system asset | `assets/a85a7013b4fe42268886cf7bc96a97b8` |
| Reference screen | `projects/13976778818577409505/screens/4fd4ee8ef5cd41a3a0a1c98e71714e66` |

## Product Tone
MCP Mock Server should feel like a protocol laboratory: calm, exact, operational, and productized without looking like a marketing site. The UI should help users understand live protocol state, auth modes, and evidence flows while keeping raw request and response details easy to inspect.

## Primitive-First Rule
All page work should start from shared primitives before designing individual screens.

- Use shared app shell, page header, panel, metric tile, action bar, table, form field, status pill, code row, empty state, loading state, and error state patterns.
- Avoid bespoke cards or local one-off spacing unless a page has a specific workflow need.
- Keep catalog pages focused on search, status, and navigation. Keep creation, editing, deletion, and protocol execution in focused pages.
- Do not nest cards inside cards. Use full-width panels, simple grids, and table shells instead.
- Keep border radius at 8px or less for product surfaces.
- Maintain touch targets of at least 44px.

## Visual Tokens
| Token | Value | Purpose |
|---|---|---|
| Background | `#f4f6f3` | Quiet app canvas |
| Surface | `#ffffff` | Main panel surface |
| Surface low | `#eef2ef` | Subtle grouped controls |
| Surface raised | `#f9faf7` | Inputs and low-emphasis rows |
| Text | `#1d2724` | Primary readable ink |
| Muted text | `#5d6a66` | Secondary descriptions |
| Hairline | `#d8e0dc` | Dividers and borders |
| Accent | `#2f6f64` | Primary actions and active states |
| Accent dark | `#214f49` | Hover and strong active text |
| Accent soft | `#dceee9` | Selected or enabled background |
| Warning | `#9a5b16` | Risk notices |
| Danger | `#a33d3d` | Destructive actions |
| Success | `#2e7354` | Healthy or enabled state |

## Layout Rules
- App content width is capped at `1240px`.
- Mobile page margins use `12px` to keep dense protocol tables usable at 390px.
- Desktop page rhythm should use 16px to 24px section gaps.
- Panels should use 16px to 22px padding depending on density.
- Tables may scroll horizontally inside a dedicated table shell; the page itself should not overflow horizontally.

## Primitive Inventory
The implementation should expose these reusable React primitives and matching CSS classes:

- `PageShell`: root app shell for admin pages.
- `PageHeader`: eyebrow, title, description, optional actions or summary.
- `Panel`: bordered operational surface.
- `MetricTile`: compact state/count tile.
- `ActionBar`: responsive action grouping.
- `StatusPill`: enabled, disabled, warning, danger, success, neutral states.
- `EmptyState`: consistent empty or unavailable state.

Existing pages may keep class-based markup during migration, but global class styles should map those existing classes to the same primitive system.

