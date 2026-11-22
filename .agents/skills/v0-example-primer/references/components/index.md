# Component index & entrypoint map

Import from the package **root** `@primer/react` unless noted as experimental. Experimental components import from `@primer/react/experimental`. Verify any prop against `node_modules/@primer/react/generated/components.json` before use.

## By task area (see the grouped reference files)

- **Buttons & actions** → `buttons.md`: `Button`, `IconButton`, `Button` variants.
- **Forms & inputs** → `forms.md`: `FormControl`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup`, `SelectPanel` (experimental), `TextInputWithTokens`.
- **Feedback** → `feedback.md`: `Flash`, `Banner` (experimental), `Spinner`, `Label`, `LabelGroup`, `Token`, `CounterLabel`.
- **Navigation** → `navigation.md`: `PageLayout`, `PageHeader`, `NavList`, `UnderlineNav`, `TabNav`, `ActionList`, `ActionMenu`, `Breadcrumbs`, `Pagination`, `TreeView`.
- **Overlays** → `overlays.md`: `Dialog` (experimental), `Overlay`, `AnchoredOverlay`, `Tooltip`, `Popover`.
- **Data display** → `data-display.md`: `DataTable` (experimental), `Table`, `Avatar`, `AvatarStack`, `Timeline`, `Blankslate` (experimental), `Truncate`.

## Layout / typography primitives (see foundations/)

`Stack`, `PageLayout`, `Heading`, `Text`, `Link`.

## Entrypoint notes

- Root `@primer/react`: the large majority of components (`Button`, `TextInput`, `FormControl`, `Stack`, `Label`, `Flash`, `ActionList`, `ActionMenu`, `NavList`, `UnderlineNav`, `Avatar`, `Heading`, `Text`, `Link`, `Tooltip`, `Overlay`, `AnchoredOverlay`, `Popover`, `Pagination`, `Breadcrumbs`, `TreeView`, `Timeline`, `Spinner`, `Token`, `CounterLabel`, `LabelGroup`, …).
- `@primer/react/experimental`: newer / actively-developed components — `Dialog`, `Banner`, `SelectPanel`, `DataTable`, `Table`, `Blankslate`, `Tooltip` (v2). When a component exists in both, new code generally uses the experimental one; verify by checking which entrypoint actually exports it (`node_modules/@primer/react/dist/experimental/index.d.ts`).
- `@primer/react/deprecated`: legacy components — avoid in new code.

## How to verify

```bash
# Is X exported from the root?
grep -o "\bComponentName\b" node_modules/@primer/react/dist/index.d.ts | head -1
# …or experimental?
grep -i "componentname" node_modules/@primer/react/dist/experimental/index.d.ts | head
# Full prop list:
node -e "console.log(JSON.stringify(require('@primer/react/generated/components.json').components.component_key.props,null,1))"
```

Component keys in `components.json` are snake_case (`text_input`, `action_list`).
