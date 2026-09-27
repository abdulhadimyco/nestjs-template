## What and why

<!-- One or two sentences. Link the ticket if there is one. -->

## Checklist

- [ ] Quality gate (`pnpm run gate`) run locally, output pasted below
- [ ] Tests written first (TDD), covering the new/changed behaviour
- [ ] No `any`, no `!`, no `as` casts without a why-comment
- [ ] Every new export has a TSDoc block
- [ ] Every new/changed route has `@ApiOperation` and `@ApiResponse`
- [ ] `openapi.json` regenerated (`pnpm run openapi:generate`) if routes changed
- [ ] Module `README.md` updated if this module's routes, collections, cache keys, or env keys changed
- [ ] Vault or service doc updated if this change affects documented behaviour

## Gate output

```
<!-- paste pnpm run gate output here -->
```
