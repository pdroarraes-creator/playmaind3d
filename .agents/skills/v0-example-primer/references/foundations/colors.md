# Colors & color mode

Primer color comes entirely from `@primer/primitives` CSS custom properties. **Never hardcode hex / rgb.** Use a token (`var(--fgColor-muted)`) or a component prop (`variant`, `scheme`).

## How theming works

The primitive theme CSS files key every token off attribute selectors like
`[data-color-mode="light"][data-light-theme="light"]` and
`[data-color-mode="dark"][data-dark-theme="dark"]`. Those attributes are set on `<html>` in `app/layout.tsx`, and `ThemeProvider` in `components/providers.tsx` is given a matching `colorMode`.

**These two must agree.** If `<html data-color-mode="dark">` but `ThemeProvider colorMode="day"`, styled-components and CSS tokens disagree and you get the "dark card on a light page" bug. To switch the whole app's theme, change **both**:

```tsx
// app/layout.tsx
<html lang="en" data-color-mode="dark" data-light-theme="light" data-dark-theme="dark">

// components/providers.tsx
<ThemeProvider colorMode="night" dayScheme="light" nightScheme="dark" preventSSRMismatch>
```

`colorMode` values: `"day"`, `"night"`, `"auto"`. Avoid `"auto"` for a deterministic starter — it follows the OS preference, which makes screenshots/previews unpredictable. Pin `day` or `night`.

The document background comes from `body { background-color: var(--bgColor-default) }` in `app/globals.css`; because the theme attributes live on `<html>`, that token resolves correctly.

## Role tokens (semantic — prefer these)

Each role has `-emphasis` (solid/strong), `-muted` (subtle background), and a foreground form.

| Role                    | Foreground            | Solid bg                       | Muted bg                    |
| ----------------------- | --------------------- | ------------------------------ | --------------------------- |
| Accent (links, primary) | `--fgColor-accent`    | `--bgColor-accent-emphasis`    | `--bgColor-accent-muted`    |
| Success                 | `--fgColor-success`   | `--bgColor-success-emphasis`   | `--bgColor-success-muted`   |
| Attention               | `--fgColor-attention` | `--bgColor-attention-emphasis` | `--bgColor-attention-muted` |
| Severe                  | `--fgColor-severe`    | `--bgColor-severe-emphasis`    | `--bgColor-severe-muted`    |
| Danger                  | `--fgColor-danger`    | `--bgColor-danger-emphasis`    | `--bgColor-danger-muted`    |
| Done                    | `--fgColor-done`      | `--bgColor-done-emphasis`      | `--bgColor-done-muted`      |
| Sponsors                | `--fgColor-sponsors`  | `--bgColor-sponsors-emphasis`  | `--bgColor-sponsors-muted`  |
| Neutral                 | `--fgColor-neutral`   | `--bgColor-neutral-emphasis`   | `--bgColor-neutral-muted`   |

## Surface & text tokens

- Surfaces: `--bgColor-default`, `--bgColor-muted`, `--bgColor-inset`, `--bgColor-emphasis`, `--bgColor-inverse`.
- Foreground: `--fgColor-default`, `--fgColor-muted`, `--fgColor-onEmphasis` (text on a solid emphasis bg), `--fgColor-disabled`, `--fgColor-link`.
- Borders: `--borderColor-default`, `--borderColor-muted`, `--borderColor-emphasis`, plus role borders (`--borderColor-accent-emphasis`, …).

## Usage

Prefer component props that already map to roles:

```tsx
<Label variant="success">approved</Label>
<Button variant="danger">Delete</Button>
<Flash variant="warning">Heads up</Flash>
```

Only drop to raw tokens for custom containers, and even then use the variable, not the value:

```tsx
<div
  style={{
    backgroundColor: 'var(--bgColor-default)',
    border: '1px solid var(--borderColor-default)',
    color: 'var(--fgColor-default)',
  }}
/>
```

## Source

- Token definitions: `node_modules/@primer/primitives/dist/css/functional/themes/{light,dark}.css`
- Color usage guidance: https://primer.style/foundations/color-usage/

## Common mistakes / never do

- Don't set `colorMode` and `data-color-mode` to different modes.
- Don't hardcode `#0969da` etc. — use `--fgColor-accent` / `--bgColor-accent-emphasis`.
- Don't put light text on `--bgColor-default`; use `--fgColor-onEmphasis` only on emphasis backgrounds.
