# Feedback: Flash, Banner, Spinner, Label, Token, CounterLabel

## Flash (inline message)

```tsx
import {Flash} from "@primer/react"

<Flash variant="default">You are creating this repository in your personal account.</Flash>
<Flash variant="success">Changes saved.</Flash>
<Flash variant="warning">Your trial ends soon.</Flash>
<Flash variant="danger">Something went wrong.</Flash>
```

- `variant`: `"default" | "success" | "warning" | "danger"`.
- `full`: edge-to-edge (no border radius), for page-top banners.

## Banner (experimental — richer, dismissible)

```tsx
import { Banner } from '@primer/react/experimental'
;<Banner
  title="Heads up"
  description="Your account needs attention."
  variant="warning"
  onDismiss={() => {}}
/>
```

Use `Banner` (experimental) when you need a title + description + actions + dismiss; use `Flash` for a simple inline note.

## Spinner

```tsx
import { Spinner } from '@primer/react'
;<Spinner size="medium" srText="Loading" />
```

- `size`: `"small" | "medium" | "large"`.
- `srText`: screen-reader text (set to `null` to hide if redundant).

## Label (status pill)

```tsx
import { Label, LabelGroup } from '@primer/react'
;<LabelGroup>
  <Label variant="accent">enhancement</Label>
  <Label variant="success">approved</Label>
  <Label variant="attention">needs review</Label>
  <Label variant="danger">bug</Label>
  <Label variant="done">resolved</Label>
</LabelGroup>
```

- `variant`: `"default" | "primary" | "secondary" | "accent" | "success" | "attention" | "severe" | "danger" | "done" | "sponsors"`.
- `size`: `"small" | "large"`.
- `LabelGroup` handles overflow: `overflowStyle` (`"inline" | "overlay"`), `visibleChildCount` (`"auto" | number`).

## Token (removable chip)

```tsx
import { Token } from '@primer/react'
;<Token text="design" onRemove={() => {}} />
```

- `text` (required), `onRemove`, `hideRemoveButton`, `isSelected`, `size` (`"small" | "medium" | "large" | "xlarge"`), `leadingVisual`, `as` (`"button" | "a" | "span"`).

## CounterLabel (numeric badge)

```tsx
import {CounterLabel} from "@primer/react"

<CounterLabel>12</CounterLabel>
<CounterLabel scheme="primary">3</CounterLabel>
```

- `scheme`: `"primary" | "secondary"`.

## Source

- `components.json` → `flash`, `spinner`, `label`, `label_group`, `token`, `counter_label`; `banner` is in `dist/experimental`.

## Common mistakes / never do

- Don't invent `Flash variant="error"` — danger is the error variant; valid set is default/success/warning/danger.
- Don't build a custom colored pill — use `Label` with a `variant`.
- Don't omit `srText` on a standalone `Spinner`.
