# Spacing, layout, radius & shadow

Use Primer layout primitives and scale words instead of arbitrary px. The two main layout tools are `Stack` (flex stacks) and `PageLayout` (page regions).

## Stack — the default layout primitive

```tsx
import {Stack} from "@primer/react"

<Stack direction="vertical" gap="normal" padding="normal">
  <Stack.Item>…</Stack.Item>
</Stack>

<Stack direction="horizontal" gap="condensed" align="center" justify="space-between">
  …
</Stack>
```

- `direction`: `"vertical" | "horizontal"` (responsive object allowed).
- `gap` / `padding` / `paddingBlock` / `paddingInline`: `"none" | "tight" | "condensed" | "cozy" | "normal" | "spacious"` (responsive allowed).
- `align`: `"stretch" | "start" | "center" | "end" | "baseline"`.
- `justify`: `"start" | "center" | "end" | "space-between" | "space-evenly"`.
- `wrap`: `"wrap" | "nowrap"`.

Prefer `Stack` over flex `<div>`s; prefer scale words (`gap="normal"`) over px.

## PageLayout — page regions

```tsx
import { PageLayout } from '@primer/react'
;<PageLayout containerWidth="large" padding="normal">
  <PageLayout.Header>…</PageLayout.Header>
  <PageLayout.Content>…</PageLayout.Content>
  <PageLayout.Pane>…</PageLayout.Pane>
  <PageLayout.Footer>…</PageLayout.Footer>
</PageLayout>
```

- `containerWidth`: `"full" | "medium" | "large" | "xlarge"`.
- `padding` / `columnGap` / `rowGap`: `"none" | "condensed" | "normal"`.

## Spacing tokens

The base scale is `--base-size-4`, `--base-size-8`, `--base-size-12`, `--base-size-16`, `--base-size-20`, `--base-size-24`, `--base-size-28`, `--base-size-32`, … (px steps). There are also semantic `--stack-gap-{condensed,normal,spacious}` and `--stack-padding-*` tokens. Use these only for custom elements that aren't a `Stack`.

## Radius

`--borderRadius-small`, `--borderRadius-medium`, `--borderRadius-default`, `--borderRadius-large`, `--borderRadius-full`.

## Shadow / elevation

- Resting (cards, surfaces): `--shadow-resting-xsmall`, `--shadow-resting-small`, `--shadow-resting-medium`.
- Floating (overlays, menus): `--shadow-floating-small`, `--shadow-floating-medium`, `--shadow-floating-large`, `--shadow-floating-xlarge`.
- Inset: `--shadow-inset`.

## Custom container pattern

When no Primer container fits, a token-styled `<div>` is acceptable:

```tsx
<div
  style={{
    backgroundColor: 'var(--bgColor-default)',
    border: '1px solid var(--borderColor-default)',
    borderRadius: 'var(--borderRadius-large)',
    boxShadow: 'var(--shadow-resting-medium)',
  }}
>
  <Stack direction="vertical" gap="normal" padding="normal">
    …
  </Stack>
</div>
```

## Source

- Size tokens: `node_modules/@primer/primitives/dist/css/base/size/size.css`, `functional/size/size.css`, `functional/size/border.css`
- Stack / PageLayout props: `node_modules/@primer/react/generated/components.json`

## Common mistakes / never do

- Don't use raw `gap: 16px` — use `Stack gap="normal"` or `--base-size-16`.
- Don't invent gap/padding words beyond the scale above.
- Don't reach for a styled `<div>` when `Stack`/`PageLayout` would do.
