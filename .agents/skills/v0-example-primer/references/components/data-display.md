# Data display: DataTable, Avatar, Timeline, Blankslate

## DataTable + Table (experimental)

```tsx
import {DataTable, Table} from "@primer/react/experimental"

const data = [
  {id: 1, name: "primer/react", stars: 3200, updated: "2 days ago"},
  {id: 2, name: "primer/primitives", stars: 410, updated: "1 week ago"},
]

<Table.Container>
  <Table.Title as="h2" id="repos">Repositories</Table.Title>
  <DataTable
    aria-labelledby="repos"
    data={data}
    columns={[
      {header: "Repository", field: "name", rowHeader: true},
      {header: "Stars", field: "stars"},
      {header: "Updated", field: "updated"},
    ]}
  />
</Table.Container>
```

- Import from `@primer/react/experimental`.
- `columns`: each has `header`, `field` (or a `renderCell`), optional `rowHeader`, `sortBy`, `width`.
- `cellPadding`: `"condensed" | "normal" | "spacious"`.
- For sortable tables provide `sortBy` on columns and `initialSortColumn`/`initialSortDirection`.

## Avatar / AvatarStack

```tsx
import {Avatar, AvatarStack} from "@primer/react"

<Avatar src="/placeholder.svg?height=40&width=40" size={40} alt="octocat" />

<AvatarStack>
  <Avatar src="/placeholder.svg?height=24&width=24" alt="user a" />
  <Avatar src="/placeholder.svg?height=24&width=24" alt="user b" />
</AvatarStack>
```

- `Avatar`: `src`, `size` (number or responsive object), `square` (rounded-rect for orgs), `alt`.

## Timeline

```tsx
import { Timeline } from '@primer/react'
import { GitCommitIcon } from '@primer/octicons-react'
;<Timeline>
  <Timeline.Item>
    <Timeline.Badge>
      <GitCommitIcon />
    </Timeline.Badge>
    <Timeline.Body>Pushed 3 commits</Timeline.Body>
  </Timeline.Item>
</Timeline>
```

- `clipSidebar` controls the connector line at the ends.

## Blankslate (empty state — experimental)

```tsx
import { Blankslate } from '@primer/react/experimental'
import { SearchIcon } from '@primer/octicons-react'
;<Blankslate>
  <Blankslate.Visual>
    <SearchIcon size={24} />
  </Blankslate.Visual>
  <Blankslate.Heading>No results found</Blankslate.Heading>
  <Blankslate.Description>
    Try adjusting your search filters.
  </Blankslate.Description>
  <Blankslate.PrimaryAction href="#">Clear filters</Blankslate.PrimaryAction>
</Blankslate>
```

- `border`, `narrow`, `spacious`, `size` (`"small" | "medium" | "large"`).

## Source

- `components.json` → `data_table`, `avatar`, `timeline`, `blankslate`; `DataTable`/`Table`/`Blankslate` live in `dist/experimental`.

## Common mistakes / never do

- Don't import `DataTable`/`Blankslate` from the root — they're in `@primer/react/experimental`.
- Don't omit `alt` on `Avatar` or `aria-labelledby`/`aria-label` on `DataTable`.
- Don't build empty states from scratch — use `Blankslate`.
