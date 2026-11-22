# Forms & inputs

Every field is wrapped in a `FormControl`, which wires up the label, caption, validation, and the `id`/`aria` relationships. Import from `@primer/react`.

## FormControl + TextInput

```tsx
import { FormControl, TextInput } from '@primer/react'
import { RepoIcon } from '@primer/octicons-react'
;<FormControl required>
  <FormControl.Label>Repository name</FormControl.Label>
  <TextInput leadingVisual={RepoIcon} placeholder="awesome-project" block />
  <FormControl.Caption>
    Great repository names are short and memorable.
  </FormControl.Caption>
</FormControl>
```

- `FormControl` children are `FormControl.Label`, `FormControl.Caption`, `FormControl.Validation`, and exactly one input.
- `FormControl` props: `required`, `disabled`, `id`, `layout` (`"vertical" | "horizontal"`).
- Hide a label visually but keep it for screen readers: `<FormControl.Label visuallyHidden>`.

### Validation

```tsx
<FormControl>
  <FormControl.Label>Email</FormControl.Label>
  <TextInput validationStatus="error" />
  <FormControl.Validation variant="error">
    Enter a valid email
  </FormControl.Validation>
</FormControl>
```

`validationStatus` on the input: `"error" | "success"`. `FormControl.Validation variant`: `"error" | "success"`.

## TextInput

- `block` (full width), `size` (`"small" | "medium" | "large"`), `leadingVisual` / `trailingVisual` (icon component or string), `trailingAction` (a button element), `monospace`, `loading` + `loaderPosition`, `validationStatus`, `contrast`.

## Textarea

```tsx
<FormControl>
  <FormControl.Label>Description</FormControl.Label>
  <Textarea
    placeholder="Optional description"
    rows={3}
    block
    resize="vertical"
  />
</FormControl>
```

- `rows`, `cols`, `block`, `resize` (`"both" | "horizontal" | "vertical" | "none"`), `validationStatus`.

## Select

```tsx
import { Select } from '@primer/react'
;<FormControl>
  <FormControl.Label>Visibility</FormControl.Label>
  <Select>
    <Select.Option value="public">Public</Select.Option>
    <Select.Option value="private">Private</Select.Option>
  </Select>
</FormControl>
```

- `block`, `placeholder`, `size`, `validationStatus`.

## Checkbox / Radio

```tsx
import {FormControl, Checkbox, Radio, RadioGroup, CheckboxGroup} from "@primer/react"

// Single checkbox with label
<FormControl>
  <Checkbox defaultChecked />
  <FormControl.Label>Add a README file</FormControl.Label>
  <FormControl.Caption>This is where you can write a long description.</FormControl.Caption>
</FormControl>

// Radio group
<RadioGroup name="visibility">
  <RadioGroup.Label>Visibility</RadioGroup.Label>
  <FormControl>
    <Radio value="public" defaultChecked />
    <FormControl.Label>Public</FormControl.Label>
  </FormControl>
  <FormControl>
    <Radio value="private" />
    <FormControl.Label>Private</FormControl.Label>
  </FormControl>
</RadioGroup>
```

- `Radio` requires `value`; `RadioGroup` requires `name` and uses `RadioGroup.Label`. `onChange(selected, e)` gives the selected value.
- `CheckboxGroup` groups checkboxes with `CheckboxGroup.Label`; `onChange(selected[], e)`.
- `Checkbox` supports `checked`/`defaultChecked`, `indeterminate`, `validationStatus`.

## Accessibility

- Always pair an input with `FormControl.Label`. The control wires `htmlFor`/`id` and `aria-describedby` to the caption/validation automatically.
- Use `visuallyHidden` on the label rather than dropping it.

## Source

- `components.json` → `form_control`, `text_input`, `textarea`, `select`, `checkbox`, `checkbox_group`, `radio`, `radio_group`
- Repo: `packages/react/src/FormControl/`, `packages/react/src/TextInput/`, etc.

## Common mistakes / never do

- Don't put a raw `<label>`/`<input>` — use `FormControl` + the Primer input.
- Don't add `block` expecting a max-width; combine with a container if you need to constrain width.
- `Radio` without a `value`, or `RadioGroup` without a `name`, is invalid.
