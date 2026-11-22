# Buttons & actions

Import from `@primer/react`.

## Button

```tsx
import {Button} from "@primer/react"
import {PlusIcon, DownloadIcon, TrashIcon} from "@primer/octicons-react"

<Button variant="primary" leadingVisual={PlusIcon}>New repository</Button>
<Button leadingVisual={DownloadIcon}>Clone</Button>
<Button variant="danger" leadingVisual={TrashIcon}>Delete</Button>
<Button variant="invisible">Cancel</Button>
<Button variant="primary" loading loadingAnnouncement="Saving…">Save</Button>
```

**Key props** (verified in `components.json`):

- `variant`: `"default" | "primary" | "danger" | "invisible" | "link"`.
- `size`: `"small" | "medium" | "large"`.
- `leadingVisual` / `trailingVisual`: an icon component (`PlusIcon`) — pass the component itself, not `<PlusIcon />`.
- `trailingAction`: element rendered at the far end (e.g. a dropdown caret icon).
- `block`: full-width.
- `count`: number badge (for `variant="default"` trailing counters).
- `loading` + `loadingAnnouncement`: built-in spinner + a11y announcement.
- `inactive`, `disabled`, `as`, `href` (renders an anchor).

## IconButton

Icon-only button — **`aria-label` is required** for accessibility.

```tsx
import { IconButton } from '@primer/react'
import { HeartIcon } from '@primer/octicons-react'
;<IconButton icon={HeartIcon} aria-label="Sponsor" variant="default" />
```

- `icon`: the icon component (required).
- `aria-label`: required.
- `variant`, `size`: same scales as `Button`.
- `tooltipDirection`: `"n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"` — IconButton shows a tooltip from the `aria-label`.

## Accessibility

- Always give `IconButton` an `aria-label`.
- Use `variant="danger"` for destructive actions, `"primary"` for the single main action per view.
- `loading` buttons announce via `loadingAnnouncement`; provide it.

## Source

- `node_modules/@primer/react/generated/components.json` → `button`, `icon_button`
- Repo: `packages/react/src/Button/`, `packages/react/src/IconButton/`

## Common mistakes / never do

- Don't render `leadingVisual={<PlusIcon />}` — pass the component reference `leadingVisual={PlusIcon}`.
- Don't omit `aria-label` on `IconButton`.
- Don't invent variants (no `"secondary"`, `"outline"`, etc.) — only the five listed exist.
