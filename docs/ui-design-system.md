# GranthSetu V3 UI design system

## Character

GranthSetu should feel like a quiet, beautifully run reading room: trustworthy, generous, legible, and alive with useful detail. It avoids generic SaaS glass cards, decorative neon, noisy dashboards, and motion without meaning.

The recurring **page bridge**—two facing page edges joined by a small coral marker—connects the global gateway, public room, and operator shell.

## Typography

- **Instrument Sans**: navigation, controls, labels, tables, operational values.
- **Newsreader**: hero statements, room identity, titles, editorial moments.
- Use a clear heading order and sentence case. Operational labels are compact but never cryptic.

## Colour tokens

| Token | Light role | Dark role |
| --- | --- | --- |
| `--ink` | deep forest text | warm paper text |
| `--surface` | warm paper | charcoal forest |
| `--surface-raised` | white paper | lifted forest |
| `--accent` | coral action | brighter coral action |
| `--success` | available/complete | available/complete |
| `--warning` | limited/attention | limited/attention |
| `--danger` | overdue/destructive | overdue/destructive |

Availability always includes text or an icon in addition to colour.

## Structure

- Global gateway: open composition, single dominant room-code task, proof points below the fold.
- Public room: library masthead, catalogue search, asymmetrical editorial book grid, informative detail pages.
- Operator workspace: stable sidebar on desktop, compact top bar and bottom navigation on mobile, dense but readable tables, a split circulation workbench.
- Cards are reserved for discrete objects or metrics; page structure relies on bands, tables, lists, and whitespace.

## Interaction rules

- All interactive targets are at least 44px on touch layouts.
- Focus is visible with a high-contrast outline and offset.
- Hover never carries essential information.
- Theme preference persists locally and the first paint avoids a theme flash.
- Reduced-motion mode disables non-essential transitions and transforms.
- Loading, empty, success, failure, disabled, and unauthorized states use plain language and a clear recovery action.
- Dangerous actions require explicit confirmation; none are triggered by icon-only controls.

## Responsive rules

At `820px` the persistent operator sidebar becomes a mobile header and bottom navigation. Tables remain semantically intact and use bounded horizontal scrolling where column reduction would hide necessary facts. At `560px`, forms stack, catalogue layouts become single-column, and primary actions remain reachable without precision tapping.

## Accessibility acceptance

- Semantic landmarks and heading hierarchy
- Keyboard navigation and visible focus
- Labelled form controls and icon buttons
- Sufficient text/background contrast in both themes
- `prefers-reduced-motion` support
- No colour-only state
- Useful alternative text; decorative imagery excluded from the accessibility tree
