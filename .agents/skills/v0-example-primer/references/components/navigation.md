# Navigation

## PageLayout (page skeleton)

See `foundations/spacing-layout.md` for the full prop list. Use it to structure header / content / pane / footer regions.

```tsx
import { PageLayout } from '@primer/react'
;<PageLayout containerWidth="large">
  <PageLayout.Header>
    <PageHeader>…</PageHeader>
  </PageLayout.Header>
  <PageLayout.Content>…</PageLayout.Content>
  <PageLayout.Pane>…</PageLayout.Pane>
</PageLayout>
```

## PageHeader

```tsx
import { PageHeader } from '@primer/react'
;<PageHeader>
  <PageHeader.TitleArea>
    <PageHeader.Title>Settings</PageHeader.Title>
  </PageHeader.TitleArea>
  <PageHeader.Description>Manage your account</PageHeader.Description>
  <PageHeader.Actions>…</PageHeader.Actions>
</PageHeader>
```

- `hasBorder`, `role`, `as`, responsive `hidden`.

## NavList (sidebar nav)

```tsx
import { NavList } from '@primer/react'
;<NavList aria-label="Settings">
  <NavList.Item href="/profile" aria-current="page">
    Profile
  </NavList.Item>
  <NavList.Item href="/billing">Billing</NavList.Item>
  <NavList.Group title="Access">
    <NavList.Item href="/ssh">SSH keys</NavList.Item>
  </NavList.Group>
</NavList>
```

- Mark the active item with `aria-current="page"`. Add icons via `<NavList.LeadingVisual>`.

## UnderlineNav (tabbed page nav)

```tsx
import { UnderlineNav } from '@primer/react'
import { CodeIcon, IssueOpenedIcon } from '@primer/octicons-react'
;<UnderlineNav aria-label="Repository">
  <UnderlineNav.Item icon={CodeIcon} aria-current="page">
    Code
  </UnderlineNav.Item>
  <UnderlineNav.Item icon={IssueOpenedIcon} counter={12}>
    Issues
  </UnderlineNav.Item>
</UnderlineNav>
```

- `variant`: `"inset" | "flush"`. Items take `icon`, `counter`, `aria-current`.

## ActionList & ActionMenu

```tsx
import { ActionList, ActionMenu, Button } from '@primer/react'
import { GearIcon } from '@primer/octicons-react'
;<ActionMenu>
  <ActionMenu.Button>Open</ActionMenu.Button>
  <ActionMenu.Overlay>
    <ActionList>
      <ActionList.Item onSelect={() => {}}>
        <ActionList.LeadingVisual>
          <GearIcon />
        </ActionList.LeadingVisual>
        Settings
      </ActionList.Item>
      <ActionList.Divider />
      <ActionList.Item variant="danger">Delete</ActionList.Item>
    </ActionList>
  </ActionMenu.Overlay>
</ActionMenu>
```

- `ActionList` `selectionVariant`: `"single" | "multiple"`; items use `ActionList.LeadingVisual` / `TrailingVisual`, `variant="danger"`, `onSelect`.
- `ActionMenu` is a button-triggered menu wrapping `ActionList`.

## Breadcrumbs / Pagination / TreeView

```tsx
import {Breadcrumbs, Pagination, TreeView} from "@primer/react"

<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/repo" selected>repo</Breadcrumbs.Item>
</Breadcrumbs>

<Pagination pageCount={10} currentPage={2} onPageChange={(e, page) => {}} />
```

- `Pagination` requires `pageCount` + `currentPage`; `TreeView` needs `aria-label` and uses `TreeView.Item`/`TreeView.SubTree`.

## Source

- `components.json` → `page_layout`, `page_header`, `nav_list`, `underline_nav`, `tab_nav`, `action_list`, `action_menu`, `breadcrumbs`, `pagination`, `tree_view`

## Common mistakes / never do

- Don't forget `aria-label` on `NavList` / `UnderlineNav` / `TreeView`.
- Don't mark the active nav item with styling only — use `aria-current="page"`.
- Don't hand-build dropdown menus — use `ActionMenu` + `ActionList`.
