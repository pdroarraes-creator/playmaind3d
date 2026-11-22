# Typography

Primer ships base typography through `BaseStyles` (mounted in `components/providers.tsx`) and exposes type via the `Heading` and `Text` components plus `@primer/primitives` type tokens. Don't set arbitrary `font-size` / `font-weight` in px.

## Heading

```tsx
import {Heading} from "@primer/react"

<Heading as="h1" variant="large">Display heading</Heading>
<Heading as="h2" variant="medium">Section heading</Heading>
<Heading as="h3" variant="small">Subsection heading</Heading>
```

- `variant`: `"large" | "medium" | "small"`. Controls the visual size.
- `as`: the semantic element (`h1`–`h6`). Set this for correct document outline independently of `variant`.

## Text

```tsx
import {Text} from "@primer/react"

<Text>Body copy</Text>
<Text size="medium" weight="semibold">Emphasis</Text>
<Text size="small" sx={{color: "var(--fgColor-muted)"}}>Caption</Text>
```

- `size`: `"large" | "medium" | "small"`.
- `weight`: `"light" | "normal" | "medium" | "semibold"`.
- `as`: render as `span` (default), `p`, `label`, etc.
- `whiteSpace`: `"pre" | "normal" | "nowrap" | "pre-wrap" | "pre-line"`.

For muted/secondary text, combine `Text` with the `--fgColor-muted` token rather than a gray hex.

## Type tokens

When you need raw values (e.g. a custom element), use primitive tokens, not px:

- Font stacks: `--fontStack-sansSerif`, `--fontStack-system`, `--fontStack-monospace`, `--fontStack-sansSerifDisplay`.
- Roles: `--text-display-size`/`-weight`, `--text-title-size`, `--text-subtitle-size`, `--text-body-size`, `--text-caption-size`, `--text-codeInline-size`, `--text-codeBlock-size`.

```tsx
<code
  style={{
    fontFamily: 'var(--fontStack-monospace)',
    fontSize: 'var(--text-codeInline-size)',
  }}
>
  npm i @primer/react
</code>
```

## Source

- Type tokens: `node_modules/@primer/primitives/dist/css/base/typography/typography.css` and `functional/typography/typography.css`
- Heading / Text props: `node_modules/@primer/react/generated/components.json`

## Common mistakes / never do

- Don't use raw heading tags styled by hand — use `Heading` with `variant` + `as`.
- Don't set gray text with a hex; use `--fgColor-muted`.
- Don't invent `variant`/`size`/`weight` values beyond those listed.
