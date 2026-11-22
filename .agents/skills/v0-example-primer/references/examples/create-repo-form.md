# Example: Create-repository form card

A realistic GitHub-style form composed entirely from Primer primitives — `FormControl` fields inside a token-styled surface, with a `Flash` context banner and a right-aligned action footer. This is the canonical "form in a card" pattern. It's validated in the starter (`components/showcase/create-repo-card.tsx`).

Required imports:

- `@primer/react`: `Heading`, `Text`, `Stack`, `FormControl`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `Button`, `Flash`, `Avatar`
- `@primer/octicons-react`: `RepoIcon`

```tsx
'use client'

import {
  Heading,
  Text,
  Stack,
  FormControl,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Button,
  Flash,
  Avatar,
} from '@primer/react'
import { RepoIcon } from '@primer/octicons-react'

export function CreateRepoCard() {
  return (
    <div
      style={{
        backgroundColor: 'var(--bgColor-default)',
        border: '1px solid var(--borderColor-default)',
        borderRadius: 'var(--borderRadius-large)',
        boxShadow: 'var(--shadow-resting-medium)',
      }}
    >
      <Stack direction="vertical" gap="normal" padding="normal">
        <Stack direction="horizontal" gap="condensed" align="center">
          <Avatar
            src="https://avatars.githubusercontent.com/u/9919?v=4"
            size={40}
            alt="octocat"
          />
          <Stack direction="vertical" gap="none">
            <Stack direction="horizontal" gap="condensed" align="center">
              <RepoIcon size={16} />
              <Heading as="h3" variant="small">
                Create a new repository
              </Heading>
            </Stack>
            <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
              A repository contains all project files and revision history.
            </Text>
          </Stack>
        </Stack>

        <Flash variant="default">
          You are creating this repository in your personal account.
        </Flash>

        <FormControl required>
          <FormControl.Label>Repository name</FormControl.Label>
          <TextInput
            block
            placeholder="awesome-project"
            leadingVisual={RepoIcon}
          />
          <FormControl.Caption>
            Great repository names are short and memorable.
          </FormControl.Caption>
        </FormControl>

        <FormControl>
          <FormControl.Label>Description</FormControl.Label>
          <Textarea
            block
            rows={3}
            placeholder="Optional description"
            resize="vertical"
          />
        </FormControl>

        <FormControl>
          <FormControl.Label>Visibility</FormControl.Label>
          <Select>
            <Select.Option value="public">Public</Select.Option>
            <Select.Option value="private">Private</Select.Option>
          </Select>
        </FormControl>

        <FormControl>
          <Checkbox defaultChecked />
          <FormControl.Label>Add a README file</FormControl.Label>
          <FormControl.Caption>
            This is where you can write a long description for your project.
          </FormControl.Caption>
        </FormControl>

        <Stack direction="horizontal" gap="condensed" justify="end">
          <Button variant="invisible">Cancel</Button>
          <Button variant="primary">Create repository</Button>
        </Stack>
      </Stack>
    </div>
  )
}
```

## What to copy

- `leadingVisual={RepoIcon}` — pass the icon **component**, not `<RepoIcon />`.
- Every field is a `FormControl` with `FormControl.Label` (+ `FormControl.Caption` for help text). The single checkbox puts `Checkbox` before the label inside the control.
- The surface is a token-styled `<div>` (`--bgColor-default`, `--borderColor-default`, `--borderRadius-large`, `--shadow-resting-medium`) wrapping a `Stack` — not a hand-tuned px box.
- Muted secondary text uses `color: "var(--fgColor-muted)"`, never a gray hex.
- Action footer is a horizontal `Stack` with `justify="end"`: invisible `Cancel` then primary submit.
- `"use client"` because the form is interactive.
