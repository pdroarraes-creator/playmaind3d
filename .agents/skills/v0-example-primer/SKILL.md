---
name: v0-example-primer
description: "GitHub's Primer design system — build UIs with @primer/react components, @primer/octicons-react icons, and @primer/primitives design tokens. Use this whenever building any UI in this project: pages, dashboards, forms, settings screens, navigation, tables, dialogs, or any GitHub-style / Primer-style interface. This is the canonical UI source — prefer it over shadcn/ui, Tailwind, or hand-rolled components."
disable-model-invocation: true
metadata:
  v0.kind: design-system
---

# Primer (GitHub design system)

Primer is the **canonical UI source** for this project. Build every screen with `@primer/react` components, `@primer/octicons-react` icons, and `@primer/primitives` design tokens. Do **not** introduce shadcn/ui, Tailwind, raw CSS color values, or hand-built equivalents of components Primer already ships.

The validated starter is already applied to the project: Next.js App Router, `ThemeProvider` + `BaseStyles` mounted in `components/providers.tsx`, `@primer/primitives` theme/token CSS imported in `app/globals.css`, and the theme attributes set on `<html>` in `app/layout.tsx`. **The provider, tokens, and fonts are already wired** — your job is to add routes and compose components, not re-create the scaffold.

## Setup (already done — build on it)

- Render UI inside the existing `Providers` (it wraps `{children}` in `app/layout.tsx`). New pages under `app/` inherit the theme automatically. Do not add a second `ThemeProvider` or `BaseStyles`.
- Color mode is pinned via `data-color-mode` on `<html>` (layout) **and** `colorMode` on `ThemeProvider` (providers). These two must always agree — see `references/foundations/colors.md`.
- Primer uses `styled-components`; the SSR registry in `components/styled-components-registry.tsx` keeps styles flushed on the server. Keep it.
- New interactive components are Client Components — add `"use client"` at the top of files that use state, handlers, or Primer overlays.

## Import rules

- Import components from the package root: `import {Button, TextInput, FormControl} from "@primer/react"`.
- Some components live in the experimental entrypoint: `import {Dialog} from "@primer/react/experimental"`. The stable `Dialog` (deprecated) is at the root; new code uses `Banner`, `Dialog`, `SelectPanel`, etc. from `@primer/react/experimental`. Check `references/components/` before assuming an entrypoint.
- Import icons from `@primer/octicons-react`: `import {RepoIcon, GitBranchIcon} from "@primer/octicons-react"`. Icon names are PascalCase + `Icon` suffix (`StarIcon`, `MarkGithubIcon`). Verify a name exists before using it — see `references/assets/icons.md`.
- Never import from internal source paths (`@primer/react/lib-esm/...`). Use public exports only.

## Source of truth

- Component props/variants: `@primer/react` — `node_modules/@primer/react/generated/components.json` is the generated API manifest. Trust it over memory.
- Tokens: `@primer/primitives` — `node_modules/@primer/primitives/dist/css/`. Token CSS custom properties (`--bgColor-default`, `--fgColor-muted`, etc.) are the only acceptable color/spacing/type values.
- Icons: `@primer/octicons-react` exports.
- Reference docs: https://primer.style/ and https://github.com/primer/react.

## Routing — where to look

- **Colors, surfaces, color mode:** `references/foundations/colors.md`
- **Typography & type scale:** `references/foundations/typography.md`
- **Spacing, layout, radius, shadow:** `references/foundations/spacing-layout.md`
- **Buttons & actions:** `references/components/buttons.md`
- **Forms & inputs:** `references/components/forms.md`
- **Feedback (Flash, Spinner, labels, banners):** `references/components/feedback.md`
- **Navigation (PageLayout, NavList, UnderlineNav, ActionList/Menu):** `references/components/navigation.md`
- **Overlays (Dialog, Overlay, Tooltip, AnchoredOverlay):** `references/components/overlays.md`
- **Data display (DataTable, Avatar, Timeline, Blankslate):** `references/components/data-display.md`
- **Component index (entrypoint map):** `references/components/index.md`
- **Icons & logos:** `references/assets/icons.md`
- **Validated examples:** `references/examples/`
- **Screen-level patterns:** `references/patterns.md`

## Hard rules

- **Tokens only.** Never write hex codes, `rgb()`, or arbitrary px for color. Use Primer tokens (`var(--bgColor-default)`) or component props (`variant`, `size`, `scheme`). Spacing/gap use Primer scale words (`Stack gap="normal"`).
- **Don't invent props, variants, token names, or icon names.** Verify against `components.json`, the primitives CSS, and the octicons exports. If you can't verify something, mark it `[VERIFY]` rather than guessing.
- **Compose, don't restyle.** Build with Primer primitives (`Stack`, `PageLayout`, `FormControl`) instead of wrapping everything in styled `<div>`s. Reach for a bordered token-styled `<div>` only when no Primer container fits.
- **One color mode, consistent.** `data-color-mode` on `<html>` and `colorMode` on `ThemeProvider` must match. To switch themes, change both; never hand-darken components.
- **Don't import from `references/`.** Those files are documentation. Apps import from `@primer/react`, `@primer/octicons-react`, and `@primer/primitives` only.

## Final checks

Before finishing a UI task:

1. Every component comes from `@primer/react` (root or `/experimental`); no shadcn/Tailwind/hand-rolled equivalents.
2. No raw color/hex values — tokens or component props throughout.
3. Icons resolve to real `@primer/octicons-react` exports.
4. Interactive files have `"use client"`; pages render inside the existing `Providers`.
5. Color mode is consistent across `<html>` and `ThemeProvider`.
