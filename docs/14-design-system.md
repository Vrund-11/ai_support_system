# Design System and Accessibility

## Principles

Fast and calm (dense but readable), consistent states, keyboard-first for agents, accessible by default, one source of tokens for web, widget and mobile.

## Tokens (packages/ui-tokens, exported as CSS variables and a TS object)

- Colour roles: `bg`, `surface`, `surface-2`, `border`, `text`, `text-muted`, `primary`, `primary-contrast`, `success`, `warning`, `danger`, `info`. Light and dark values; tenant brand colour overrides `primary` in the widget only after a contrast check.
- Priority colours: LOW slate, MEDIUM blue, HIGH amber, URGENT red (always paired with an icon or label, never colour alone).
- Status chips: NEW, OPEN, PENDING_CUSTOMER, ON_HOLD, RESOLVED, CLOSED with fixed colour and label.
- Typography: system font stack or Inter; scale 12, 14, 16, 18, 20, 24, 32; line heights 1.4 to 1.6.
- Spacing 4-point scale (4, 8, 12, 16, 24, 32, 48). Radius 6 and 12. Elevation: 2 levels. Motion: 120 to 200 ms ease-out; disabled under reduced-motion.

## Component inventory (shared where possible)

Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, Switch, Radio, Tabs, Table (virtualised variant), Badge/Chip, Avatar, Tooltip, Popover, Dropdown menu, Modal, Drawer/Sheet, Toast, Banner, Skeleton, Spinner, Progress, EmptyState, ErrorState, Pagination/InfiniteLoader, DateRangePicker, FilterBar, CommandPalette (P2), MessageBubble, Composer, CitationChip, ConfidenceBar, SlaTimer, StatCard, Charts wrapper.
Build with Radix primitives and Tailwind; document in Storybook with states (default, hover, focus, disabled, loading, error) and accessibility checks.

## Interaction patterns

- Loading: skeleton matching final layout; spinners only inside buttons.
- Mutations: optimistic where safe; show pending, success or rollback.
- Forms: inline validation on blur, summary on submit, preserve input on error.
- Tables: sticky header, column visibility, saved views.
- Toasts: success 3 s, error persistent until dismissed with action.
- Confirmations: only for destructive actions, with undo when feasible.

## Accessibility (WCAG 2.1 AA)

Colour contrast at least 4.5:1 text; focus ring visible; full keyboard navigation and focus trap in modals; ARIA roles for chat log (`role="log"`, `aria-live="polite"`); labelled form fields; skip link; announce new messages and status changes; touch targets 44 px; zoom to 200% without loss; reduced motion respected. Automated axe checks in Cypress and Storybook; manual screen-reader pass per sprint.

## Responsive breakpoints

360 (mobile web), 768 (tablet), 1024 (laptop), 1440 (desktop). Inbox collapses to single column below 768; ticket detail right panel becomes a drawer.

## Performance budgets

Dashboard initial JS under 250 KB gzipped, route chunks under 100 KB each; widget loader under 3 KB and chat bundle under 80 KB; LCP under 2.5 s on throttled 4G; INP under 200 ms; CLS under 0.1. Enforce with bundle-size checks in CI and Lighthouse CI.

## Internationalisation (later)

Keep strings in a message catalogue from day one (i18next); dates and numbers through `Intl`.
