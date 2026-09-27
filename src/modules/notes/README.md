# Notes module (reference implementation)

A complete, minimal feature module demonstrating this template's standard
pattern for Mongo + cache + Zod-validated CRUD. Copy it to start a new
feature.

## Routes

| Method | Path            | Body / Query              | Notes                                     |
| ------ | --------------- | ------------------------- | ----------------------------------------- |
| POST   | `/v1/notes`     | `CreateNoteDto`           | Owner is `@CurrentUser()`                 |
| GET    | `/v1/notes`     | `ListNotesQueryDto`       | Owner-scoped; optional `status` filter    |
| GET    | `/v1/notes/:id` | —                         | Owner-scoped, cache-aside read            |
| PATCH  | `/v1/notes/:id` | `UpdateNoteDto` (partial) | Owner-scoped; invalidates the cache entry |
| DELETE | `/v1/notes/:id` | —                         | Owner-scoped; invalidates the cache entry |

All routes sit behind the global `JwtAuthGuard`; requests need a valid
bearer token. The caller's id comes from `@CurrentUser()` (see
`@/common/auth/current-user.decorator`) — no handler reads a raw header or
the request object for identity.

**Every `:id` route is owner-scoped, not just id-scoped.** `GET/PATCH/DELETE
/v1/notes/:id` filter by `{ _id, ownerId }` together, all the way down to
the Mongo query — filtering by `_id` alone would let one authenticated user
read, edit, or delete another user's note just by guessing or reusing an
id (an IDOR). This is the pattern every copy of this module must keep: any
lookup, update, or delete of a single resource by id must also carry the
caller's identity into the filter, not just validate identity at the door.

## Repository

Every collection gets a repository — this is a hard rule, not a per-module
choice. The layers, and why each one exists:

- **`NotesRepository`** (extends `BaseRepository<Note>`, in
  `src/common/mongo/base.repository.ts`) is the _only_ place that touches
  the `Note` Mongoose model or `@InjectModel`. `BaseRepository` gives every
  repository the same generic, `protected` primitives — `findOne`,
  `findMany`, `count`, `createOne`, `updateOne`, `deleteOne` — and every one
  of them is `.lean()` with an explicit projection; there is no primitive
  without one. `NotesRepository` exposes only intent-named **public**
  methods (`create`, `findByIdForOwner`, `listByOwner`,
  `updateByIdForOwner`, `deleteByIdForOwner`) that build the Mongo filter
  internally from plain arguments (an id, an owner, a status) — every
  single-resource method takes the owner and folds it into the filter, so
  it is not possible to call this repository in a way that skips the
  ownership check. Its public surface never has a `FilterQuery` or
  `UpdateQuery` type anywhere. That's the property that matters: it's what
  keeps a future datastore swap confined to the repository layer instead of
  leaking Mongo query shapes into services and controllers. The repository
  has no business rules, no cache, and never throws `NotFoundError` — a
  miss (including "exists, but not for this owner") is just `null`/`false`.
- **`NotesService`** owns the rules: cache keys/TTLs (via `CacheService`),
  turning a `null`/`false` repository result into `NotFoundError`, mapping
  a repository record's real `ObjectId` `_id` to the plain string this
  service actually returns and caches, and shaping pagination. It depends
  on `NotesRepository` and `CacheService` only — it never imports the
  `Note` model.
- **`NotesController`** validates the request (Zod DTOs, through the global
  `ZodValidationPipe`) and makes exactly one service call per route,
  passing the caller's id from `@CurrentUser()` into every call. It never
  touches the repository.

`NotesModule` provides both `NotesRepository` and `NotesService` but
exports only the service — another module that needs notes injects
`NotesService`, never the repository or the model.

## Collection

- Collection: `notes`
- Declared (not auto-created) index: `{ ownerId: 1, status: 1, createdAt: -1 }`
  — apply it in Atlas as a reviewed step, same as every other index in this
  service.

## Cache

- Key: `notes:owner:<ownerId>:<id>` (`noteCacheKeys.byOwnerAndId`, see
  `notes.cache-keys.ts`). The key is owner-scoped, not just id-scoped, for
  the same IDOR reason the repository is: an owner-blind `notes:id:<id>`
  key would make the cache the one place ownership checking could still be
  bypassed, even with the repository fixed.
- TTL: `CACHE_TTL_SECONDS.DEFAULT` (1 hour).
- Invalidated on `update` and `remove`.
- Negative results (a miss) are never cached — `CacheService.getOrSet`
  skips the `set` when the loader resolves `null`/`undefined`, so a 404
  isn't pinned in Redis for the rest of the TTL.

## Env

None specific to this module — it uses the shared `MONGO_URI` / `REDIS_URL`
from `AppConfigService`.

## Copying this module for a new feature

1. Duplicate the folder and rename `notes` → `<feature>` everywhere
   (constants, types, schema, DTOs, repository, service, controller, module,
   folder name).
2. Update the collection name, fields, and declared indexes in
   `schemas/<feature>.schema.ts`, and the projections/derived types in
   `<feature>.types.ts`.
3. Update the Zod schemas in `dto/` for the new fields.
4. Update `<feature>.cache-keys.ts` for the new key shape(s) — keep any
   single-resource key scoped by owner, same as `byOwnerAndId` here, if the
   resource is owner-scoped.
5. Rewrite `<feature>.repository.ts`'s intent methods for the new access
   patterns, calling `BaseRepository`'s protected primitives — don't add
   new primitives to `BaseRepository` unless two+ repositories need them.
   Every single-resource method (`findXForOwner`, `updateXForOwner`,
   `deleteXForOwner`, …) takes the owner and filters by it, not just the id.
6. Read the caller's id via `@CurrentUser()`, same as this module, and pass
   it into every service call — including the single-resource ones.
7. Register the module in `app.module.ts`.
8. Copy `test/notes.e2e-spec.ts` and adjust the request bodies/assertions,
   including the "another user's token → 404" case, and copy both
   `<feature>.repository.spec.ts` (mocked model) and
   `<feature>.service.spec.ts` (mocked repository).
