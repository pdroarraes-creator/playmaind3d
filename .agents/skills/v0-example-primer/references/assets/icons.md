# Icons & logos (Octicons)

Primer's icon set is **Octicons**, shipped as React components in `@primer/octicons-react` (379 icons in the installed version).

## Usage

```tsx
import {RepoIcon, StarIcon, GitBranchIcon, MarkGithubIcon} from "@primer/octicons-react"

<RepoIcon />
<StarIcon size={24} />
<StarIcon size="small" />          {/* "small"=16, "medium"=24, "large"=32 */}
<RepoIcon className="…" aria-label="Repository" />
```

- Names are **PascalCase + `Icon` suffix**: `RepoIcon`, `GitBranchIcon`, `IssueOpenedIcon`, `PlusIcon`, `TrashIcon`, `GearIcon`, `MarkGithubIcon`, `CheckIcon`, `XIcon`, `AlertIcon`, `SearchIcon`.
- `size`: a number (px) or `"small" | "medium" | "large"`.
- Icons inherit `currentColor`, so they take the surrounding text color token automatically — don't hardcode a fill.

## Passing icons to components

Many Primer components take an **icon component reference**, not a rendered element:

```tsx
<Button leadingVisual={PlusIcon}>New</Button>        // component, not <PlusIcon/>
<IconButton icon={HeartIcon} aria-label="Sponsor" />
<TextInput leadingVisual={SearchIcon} />
```

Inside slot components like `ActionList.LeadingVisual` you render the element: `<ActionList.LeadingVisual><GearIcon /></ActionList.LeadingVisual>`.

## The GitHub logo

`MarkGithubIcon` is the GitHub mark (octocat silhouette). Use it for brand placement; size it like any icon (`<MarkGithubIcon size={32} />`).

## Verify a name exists

Don't guess icon names — confirm before using:

```bash
node -e "const i=require('@primer/octicons-react'); console.log(i.RepoIcon ? 'ok' : 'missing')"
# list / search:
node -e "const i=require('@primer/octicons-react'); console.log(Object.keys(i).filter(k=>k.endsWith('Icon')&&/Git/.test(k)).join(', '))"
```

## Source

- `@primer/octicons-react` exports; browse at https://primer.style/foundations/icons/

## Common mistakes / never do

- Don't invent icon names — verify against the exports.
- Don't pass `<Icon />` where a component reference is expected (`leadingVisual`, `icon`).
- Don't set a hardcoded `fill`/color — icons follow `currentColor`/text token.
- Don't substitute lucide/react-icons/other sets; use Octicons only.
