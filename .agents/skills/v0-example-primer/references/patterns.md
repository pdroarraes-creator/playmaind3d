# Screen-level patterns

Cross-cutting guidance for composing whole screens with Primer. For component specifics, see `components/`.

## Page structure

- Wrap top-level screens in `PageLayout` (`containerWidth="large"` for app content, `"xlarge"` for wide dashboards). Use `PageLayout.Header` + `PageHeader` for the title row, `PageLayout.Content` for the body, and `PageLayout.Pane` for a sidebar.
- Within a region, lay out with `Stack` (`direction`, `gap`, `align`, `justify`) rather than flex `<div>`s.
- Section spacing uses Primer scale words (`gap="spacious"` between major sections, `"normal"` within).

## Cards / surfaces

Primer's general-purpose `Card` is experimental and purpose-shaped (image + heading). For a generic padded surface, use a token-styled container around a `Stack`:

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

Use `--bgColor-muted` / `--bgColor-inset` for nested or recessed surfaces.

## Forms

- One `FormControl` per field; group with a vertical `Stack gap="normal"`.
- Put the primary action in a right-aligned `Stack direction="horizontal" justify="end"` footer: `Cancel` (`variant="invisible"` or `"default"`) then the primary `Button variant="primary"`.
- Show top-of-form context in a `Flash variant="default"`.

## Status & metadata

- Use `Label` (with role `variant`) for statuses, `CounterLabel` for counts, `Token` for removable chips/tags.
- Destructive actions: `Button variant="danger"` and `ActionList.Item variant="danger"`.

## Color mode

The starter ships pinned to one mode. To flip the whole app, change `data-color-mode` on `<html>` **and** `colorMode` on `ThemeProvider` together — never hand-darken components (see `foundations/colors.md`).

## Client vs server

Pages are Server Components by default. Any file using state, event handlers, or overlays (`Dialog`, `ActionMenu`, `AnchoredOverlay`) needs `"use client"` at the top.
