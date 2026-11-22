# Overlays: Dialog, Overlay, Tooltip, AnchoredOverlay, Popover

Overlays are interactive — the files that use them need `"use client"`.

## Dialog (experimental — modal)

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@primer/react'
import { Dialog } from '@primer/react/experimental'

function Example() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      {open && (
        <Dialog
          title="Create a new repository"
          subtitle="A repository contains all project files."
          onClose={() => setOpen(false)}
          footerButtons={[
            {
              buttonType: 'default',
              content: 'Cancel',
              onClick: () => setOpen(false),
            },
            {
              buttonType: 'primary',
              content: 'Create repository',
              onClick: () => setOpen(false),
            },
          ]}
        >
          …body…
        </Dialog>
      )}
    </>
  )
}
```

- Import from `@primer/react/experimental` for the modern `Dialog`. Props: `title`, `subtitle`, `onClose`, `footerButtons`, `width`, `height`, `position`.
- The root `@primer/react` also exports a `Dialog` (older API with `isOpen`/`onDismiss`/`returnFocusRef`); prefer the experimental one for new code and verify the entrypoint.

## Tooltip

```tsx
import { Tooltip } from '@primer/react'
;<Tooltip text="Save changes" direction="n">
  <Button>Save</Button>
</Tooltip>
```

- `direction`: `"n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"`. (For icon-only buttons, `IconButton`'s `aria-label` already produces a tooltip.)

## AnchoredOverlay / Overlay / Popover

```tsx
'use client'
import { useRef, useState } from 'react'
import { AnchoredOverlay, Button } from '@primer/react'

function Menu() {
  const [open, setOpen] = useState(false)
  return (
    <AnchoredOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      renderAnchor={(props) => <Button {...props}>Open</Button>}
      width="medium"
    >
      …overlay content…
    </AnchoredOverlay>
  )
}
```

- `AnchoredOverlay` positions content relative to an anchor; provide `renderAnchor`, `open`, `onOpen`, `onClose`. `width`/`height` use named scales.
- `Overlay` is the lower-level primitive (`returnFocusRef`, `onClickOutside`, `onEscape` are required) — usually you want `AnchoredOverlay`, `ActionMenu`, or `Dialog` instead.
- `Popover` is a simple positioned container with a `caret` prop.

## Accessibility

- Overlays trap focus and restore it; pass the focus refs the API asks for.
- Provide a title/label so the dialog is announced.

## Source

- `components.json` → `dialog`, `overlay`, `tooltip`, `anchored_overlay`, `popover`; experimental `Dialog` in `dist/experimental`.

## Common mistakes / never do

- Don't use overlays in a Server Component — add `"use client"`.
- Don't hand-build a modal with a styled `<div>` + backdrop — use `Dialog`.
- Don't guess the `Dialog` entrypoint; verify root vs `/experimental`.
