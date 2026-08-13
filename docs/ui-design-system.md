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

Surface hierarchy is deliberate: `canvas` is the page field, `surface` is the
default content layer, `surface-raised` is a readable working layer, and
`surface-interactive` is reserved for hover and focus response. Borders are
quiet by default; strong borders are reserved for controls and overlay edges.
The dark palette uses separate forest tones for each of these layers rather
than treating every surface as black.

## Elevation and geometry

- Controls use the compact control radius.
- Panels, tables and compositional surfaces use the surface radius.
- Drawers and dialogs use the large-surface radius only where their edges are
  visible.
- Raised surfaces use a near-flat shadow; floating menus use a larger shadow;
  viewport overlays use the modal shadow. Dark shadows deepen contrast without
  becoming a haze.

## Motion

- Instant feedback: 110ms.
- Standard hover and state transition: 180ms.
- Emphasised surface transition: 280ms.
- Overlay entrance: 360ms with a decelerating curve.

Motion uses transform and opacity. Buttons can lift by one pixel and compress
on press; dense table rows change surface without shifting layout. Every
decorative transition is effectively disabled for reduced-motion preferences.

## Overlays

All create/edit surfaces use the shared portal-rendered drawer. It is attached
to the viewport rather than a scrolling content column, sits above the shell,
locks background scrolling without a width jump, supports backdrop and Escape
dismissal, traps keyboard focus, returns focus to its trigger, and moves to a
bottom-sheet treatment on small screens. Command search follows the same
backdrop, focus, elevation and motion rules.

Destructive confirmations use a dedicated `alertdialog` treatment: a clear
consequence statement, an explicit destructive action, a non-destructive
cancel action, Escape support, focus trap and focus return. Native browser
confirmation prompts are not used in the product UI.

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
