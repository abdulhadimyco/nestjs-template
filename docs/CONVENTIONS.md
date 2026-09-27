# Conventions

This is the rulebook every service generated from this template inherits. It is enforced by the
linter, the compiler, and the tests — not by memory. Where a rule below and `eslint.config.mjs`
disagree, the lint config wins. That happens once in this document and is called out there.

## Purpose

A new backend service starts from this template so it does not have to relearn the mistakes of the
services that came before it: no types, no size limits, no config module, one file doing everything.
Every rule here exists to stop one specific failure mode, not as a style preference. When you don't
know why a rule exists, that's a bug in this document — ask, don't skip it.

## Types

- `any` is banned (`@typescript-eslint/no-explicit-any: error`), along with the five
  `no-unsafe-{assignment,call,member-access,return,argument}` rules. Unknown input is typed
  `unknown` and narrowed with a Zod schema or a type guard, never cast.
- Generics carry real constraints (`<T extends Something>`), not bare `<T>` that lets anything in.
- Non-null assertion (`!`) is banned (`@typescript-eslint/no-non-null-assertion: error`). Prove the
  value exists — an `if`, a default, a schema — instead of asserting it.
- `as` casts are allowed only with a comment on the line above explaining why the type system
  cannot know the type by itself (for example, a third-party callback typed `unknown` by its own
  library). A cast with no comment is a review rejection, not a lint error, so review for it.
- `tsconfig.json` runs `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, and
  `useUnknownInCatchVariables`. This is stricter than some existing Myco services (for example
  admin-api, which has `strictNullChecks` and `noImplicitAny` off) — the template does not inherit
  their gaps.

## Size caps

- Functions: **40 lines**, blank lines and comments excluded (`max-lines-per-function`). Past 40
  lines a function is doing more than one job — split it.
- Files: **300 lines** (`max-lines`). A file that outgrows this is split by responsibility, never
  into `part-1.ts` / `part-2.ts`. `*.constants.ts` files are exempt (a long list of constants is
  still one responsibility).
- Cyclomatic complexity: **10** (`complexity`). High complexity is where bugs hide and tests get
  skipped.
- Nesting depth: **3** (`max-depth`). Deeper nesting is usually a missing early return or a
  function that should be split.
- Function parameters: **4** (`max-params`). Beyond that, use an options object so call sites stay
  readable and adding a parameter isn't a breaking change everywhere it's called.

These are lint errors, not suggestions. `*.spec.ts`, `*.e2e-spec.ts`, and everything under `test/`
are exempt from the size caps — a test's job is to be exhaustive, not short.

## Naming

- Files: `kebab-case.ts` (`unicorn/filename-case`), including the Nest suffixes:
  `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`.
- Types and classes: `PascalCase`, no `I` prefix on interfaces.
- `as const` objects: `PascalCase` name, `SCREAMING_SNAKE_CASE` keys, with a derived union type
  exported beside it:

  ```ts
  export const VideoStatus = {
    DRAFT: "draft",
    PUBLISHED: "published",
  } as const;
  export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];
  ```

- No TypeScript `enum`. `erasableSyntaxOnly` (TS 5.8+) forbids `enum` and constructor parameter
  properties in the same setting, and Nest's dependency injection relies on constructor parameter
  properties — so this template keeps `erasableSyntaxOnly` off and uses `as const` objects instead
  of `enum` by convention, not by compiler flag.
- `type` over `interface` for object shapes (`@typescript-eslint/consistent-type-definitions`).
  Use `interface` only when you need declaration merging or `extends` chains that `type`
  intersections make hard to read.
- No hardcoded string literals for domain values (status, role, error code, cache key prefix, and
  so on) — every value set is a named `as const` object (see Naming above and the Single source of
  truth table below).

## Structure

```
src/
  main.ts                 bootstrap only
  app.module.ts            root module, wires everything else together
  config/                  env.schema.ts (Zod, the only file reading process.env), app-config.*
  common/<kind>/           logger, errors, filters, interceptors, auth, cors, cache, mongo, dto,
                           utils, openapi, signing — cross-cutting code with no feature ownership
  integrations/<vendor>/   one folder per external vendor (S3, Tencent, SendGrid, ...), each a
                           module + service + types wrapping that vendor's SDK
  modules/<feature>/       one folder per feature:
    <feature>.module.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>.repository.ts   the ONLY file that may @InjectModel this feature's collection
    <feature>.constants.ts
    <feature>.types.ts
    dto/                   Zod DTOs (createZodDto)
    schemas/                Mongoose @Schema() classes and their projections
    *.spec.ts               colocated unit tests
    README.md               purpose, routes, collections, cache keys, external calls, env keys
```

- Dependency direction is enforced by `eslint-plugin-boundaries`, not just documented: `modules/*`
  may import `config`, `common`, `integrations`, and its own module; `common` and `integrations`
  may never import from `modules`. Cross-module use goes through the owning module's **service**,
  injected normally — never its repository, never its Mongoose model, never its controller.
- No barrel files (`no-restricted-imports` blocks `**/index` imports). An `index.ts` re-export
  hides the real import graph and is Nest's own documented cause of circular dependency injection.
- No `helpers/` directory anywhere (`no-restricted-imports` blocks `**/helpers/**`). The word is
  banned in paths so the old service's grab-bag pattern cannot come back under a new name. Put pure
  functions in `common/utils/<topic>.util.ts` and stateful code in a provider.

## Single source of truth

Every fact about the system lives in exactly one place. When it changes, exactly one file changes.

| Fact                                                           | Lives in                                                                    | Everything else does                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A value set (status, role, taxonomy, error code, cache prefix) | `<feature>.constants.ts`, one `as const` object + derived union type        | imports the object — Zod DTOs (`z.enum`), Mongoose `@Prop({ enum })`, and code all read the same values                      |
| A collection's shape                                           | one `@Schema()` class + one `Projections` constant next to it in `schemas/` | imports the named projection, never spells out field names                                                                   |
| A collection's queries                                         | one `<feature>.repository.ts`, intent-named methods only                    | the service calls `findById`/`listByOwner`/etc.; nothing outside the repository builds a Mongo filter                        |
| A cache key or TTL                                             | builder functions in `<feature>.cache-keys.ts`                              | calls the builder with ids, never concatenates strings                                                                       |
| An environment variable                                        | `config/env.schema.ts` only                                                 | reads it through the typed `AppConfigService`; `process.env` is unreachable elsewhere (`no-restricted-properties` lint rule) |
| A vendor API (S3, Tencent, SendGrid, ...)                      | one provider in `integrations/<vendor>/` with a typed client                | depends on the provider's methods, never imports the vendor SDK directly                                                     |
| Request identity (`userId`, `isAdmin`, claims)                 | the `@CurrentUser()` decorator, returning a typed `AuthUser`                | reads identity through the decorator; no handler reads the raw request object for auth                                       |
| Errors                                                         | `AppError` subclasses + one exception filter                                | throws a typed `AppError`; services never touch the HTTP response directly                                                   |

## Providers vs. utils

- If it holds state, depends on another provider or config, does any I/O, or needs to be mocked in
  a test double — it is an `@Injectable()` provider in the owning module (or a shared module with
  two or more real consumers today). A repository (see Mongo rules below) is always a provider,
  regardless of consumer count — every collection gets one.
- If it is a pure function of its inputs — no Nest imports, no I/O — it is a named export in
  `src/common/utils/<topic>.util.ts`, unit-tested directly with no mocking.
- Don't build an adapter, a DI token, or a factory just to call a plain helper function. Import it
  and call it.

## Controllers are thin

A controller method does exactly three things: validate the request (the DTO pipe does this
automatically), call one service method, and return its result or throw. No business logic, no
branching beyond what the framework needs, no direct database or cache access. If a controller
method is hard to keep under 40 lines, the logic that's pushing it over belongs in the service.

## Validation at the boundary

- Every route's body, query, and params are Zod schemas turned into DTOs with `createZodDto`
  (`nestjs-zod`), applied through the global `ZodValidationPipe`.
- Every string field has a `.max()`. An unbounded string is exactly how a 4,683-line controller
  with no validation library ends up storing garbage — this closes that path at the framework
  level, not by convention.
- Validate only at real boundaries: the HTTP request, and any external system's response you don't
  control. Code inside your own service trusts its own types — don't re-validate a value you just
  validated at the controller.

## Mongo rules

Every collection gets a repository. This is not a "when you have two consumers" judgment call like
the rest of Providers vs. utils — it is the only place `@InjectModel` is allowed to appear, full
stop, so a future database swap is confined to one file per collection instead of touching every
service.

**Two tiers:**

- `src/common/mongo/base.repository.ts` — an abstract `BaseRepository<TDoc>` with **protected**
  generic primitives: `findOne`, `findMany`, `count`, `createOne`, `updateOne`, `deleteOne`. Every
  one of these forces a projection argument and always calls `.lean()`. They are protected, not
  public — nothing outside a repository subclass can call them directly.
- `<feature>.repository.ts` — extends `BaseRepository<TDoc>`, is the only file that
  `@InjectModel`s this feature's collection, and exposes only **public, intent-named** methods:
  `findById`, `listByOwner`, `findByEmail`, and so on. Each method builds its own Mongo filter
  internally, using the protected primitives, and returns a typed lean result (or `null`/`false`
  for a not-found/no-op — see below).

**What a repository must never do:**

- No `FilterQuery<T>` or `UpdateQuery<T>` type anywhere on a repository's public surface, and never
  in a service. A generic `findMany(filter)` handed to services looks convenient, but it does not
  make a database swap cheap — every call site would still be building Mongo-shaped filter objects,
  so swapping the database means rewriting every service anyway. Intent-named methods are what
  actually confine a swap to the repository: the service asks "find by owner", not "query where
  `ownerId` equals X".
- No business rules, no cache reads/writes, no domain errors. A repository returns `null` or
  `false` for "not found" or "no-op", never throws `AppError` or one of its subclasses — the
  service decides what a missing document means for the caller.

**What the service does:**

- Depends on the repository (injected normally, like any provider) and owns business rules, cache
  keys, and `AppError`s. A service turns a repository's `null` into a `NotFoundError` (or a default,
  or a no-op) as the business rule requires — the repository itself never makes that call.

**Other rules, unchanged:**

- `MongooseModule.forRoot` runs with `autoIndex: false`. Indexes are declared in the `@Schema()`
  class for documentation and diffed against the real database in CI, but are never created as a
  side effect of booting the app — on a shared, high-traffic collection an unplanned index build is
  an outage.
- Every read specifies a projection, imported from the schema's `Projections` constant — never
  fields spelled out inline at a call site, including inside the repository.
- Every list query has an explicit `limit`, capped by a constant. No unbounded `find()`.
- No cross-module `@InjectModel`, and no cross-module repository injection either. If a feature
  needs another feature's data, it injects that feature's **service** — never its repository, and
  never its Mongoose model. The owning module's repository is the only place that queries its own
  collection; the owning module's service is the only thing another module is allowed to depend on.

## Redis rules

- Cache keys are built by named functions in `<feature>.cache-keys.ts`, never string-concatenated
  at the call site.
- TTLs are named constants, not inline numbers.
- Invalidation is by key, not by pattern. No `SCAN`/`KEYS` in application code — on a live cluster
  a scan-based invalidation blocks other clients and does not scale with key count.

## Errors and logging

- One JSON line per loggable event, through the structured logger in `common/logger`, never
  `console.*` directly (`no-console: error` outside `scripts/**`).
- Every log line that can be tied to a request carries `requestId`.
- Never log a full query string, a token, a password, or anything on the redaction list maintained
  in `common/logger`. When adding a new field that might carry a secret, add it to that list before
  the first log line that includes it.
- Errors are `AppError` subclasses (not raw `Error` or a bare string throw), mapped to HTTP
  responses by exactly one exception filter. Services throw; the filter is the only place that
  shapes a response body.

## Documentation

- Every exported function, class, provider, and type carries a TSDoc block: what it does, each
  `@param`, the `@returns`, anything it `@throws`, and an `@example` when the usage isn't obvious
  from the signature alone. `eslint-plugin-jsdoc` enforces this at error level for exports
  (`require-jsdoc`, `require-description`, `require-param`, `require-returns`).
- Every route carries `@ApiOperation({ summary, description })` and an `@ApiResponse` for each
  status code the tests actually exercise. DTOs come from `createZodDto`, so their shape appears in
  the generated document automatically — see `src/common/openapi/openapi.setup.ts`. The generated
  `openapi.json` is committed and diffed in CI (`openapi:check`); a route change with no
  regenerated document fails the build.
- Every feature module has a `README.md`: what it's for, the routes it exposes, the collections and
  cache keys it owns, the external services it calls, the env keys it reads, and a link to the
  matching vault page if one exists.
- Comments explain **why**, never **what** — the code and the TSDoc already say what. No
  commented-out code. `// TODO(TICKET-ID):` only; a bare `TODO` or `FIXME` with no ticket is a lint
  error (`no-warning-comments`).

## Testing

- TDD is the default: write the failing test first, then the implementation, red → green →
  refactor. This is a working discipline, not a coverage-after-the-fact exercise.
- Unit tests are `*.spec.ts`, colocated next to the file they test. End-to-end and contract tests
  live under `test/`.
- Coverage floor: **80%** across branches, functions, lines, and statements
  (`jest.config.ts` → `coverageThreshold`). `*.module.ts`, `main.ts`, `*.constants.ts`, and
  `*.types.ts` are excluded from the coverage collection — they carry no branching logic to cover.
- Size caps (`max-lines-per-function`, `max-lines`) don't apply inside `*.spec.ts`, `*.e2e-spec.ts`,
  or `test/**` — a thorough test file is allowed to be long.

## Git

- Conventional commits, header line **≤ 72 characters** (`commitlint.config.mjs`).
- No `Co-Authored-By` trailer.
- No commits during implementation unless explicitly asked — the person driving the change commits.
- Hooks (`.husky/`): `pre-commit` runs `lint-staged` (ESLint `--fix --max-warnings 0` plus Prettier
  on staged files, and a project-wide `tsc --noEmit` because type errors can appear outside the
  staged files); `commit-msg` runs commitlint; `pre-push` runs typecheck and test.

## Security

This is the checklist a service generated from this template must keep true, not a one-time setup
step. Everything here is enforced by `env.schema.ts`, a default plugin registration, or a named
factory in `src/common/security/` — never by memory.

- **Environment refinements in production.** `env.schema.ts`'s `superRefine` runs only when
  `NODE_ENV === "production"` and rejects: `ACCESS_TOKEN_JWT_SECRET` under 32 characters,
  `ALLOWED_ORIGINS` empty or containing `*`, and `LOG_LEVEL: debug`. Each error names the key and
  says "in production" so a misconfigured deploy fails at boot, not at the first request that hits
  the gap.
- **No OpenAPI UI in production.** `setupOpenApi` is only called when `!isProduction` (`main.ts`) —
  a production deploy exposes no `/docs` route and no generated schema for an attacker to read.
- **CORS allowlist explicit in production.** `buildCorsOptions` (`common/cors/`) fails closed: an
  origin not in `ALLOWED_ORIGINS` is rejected, and `credentials` is only ever true in production
  with no wildcard present. The env refinement above guarantees that allowlist is non-empty and
  non-wildcard by the time this factory runs.
- **Rate limiting is on by default and switchable.** `RATE_LIMIT_ENABLED=false` skips registering the
  plugin entirely — use it when Cloudflare (or another edge) already limits this service, so a
  request is never limited twice. `buildRateLimitOptions` (`common/security/`) configures
  `@fastify/rate-limit` with two env knobs: `RATE_LIMIT_MAX` (default 300) and
  `RATE_LIMIT_WINDOW_MS` (default 60000). A 429 returns our standard error contract
  (`code: "RATE_LIMITED"`, `details.retryAfterMs`) via `errorResponseBuilder`, and the standard
  `x-ratelimit-*` / `retry-after` headers are always shown. Pass an `ioredis` client as
  `buildRateLimitOptions`'s second argument to make the limit cluster-wide (one shared count across
  every replica) instead of per-replica in-memory — `main.ts` passes the app's `REDIS_CLIENT`.
- **The rate-limit key is `request.ip` by default**, which is only correct once `TRUST_PROXY` (below)
  is set correctly for this deployment. On a service that is reached exclusively through Cloudflare,
  pass `clientIpHeader: "cf-connecting-ip"` to `buildRateLimitOptions` instead — Cloudflare sets that
  header itself and it cannot be spoofed by the client, which is a stronger guarantee than trusting a
  hop count.
- **`TRUST_PROXY` is a deployment invariant, not a boolean toggle.** It accepts Fastify's own
  `trustProxy` shape: `true` (trust every hop — only correct when nothing untrusted can sit in front
  of the first hop), `false` (trust none, the default), an integer hop count (`1` behind a single
  edge like Cloudflare), or a comma list of trusted proxy IPs/CIDRs. `true` behind an untrusted or
  absent edge lets a client spoof its own IP and evade both the rate limiter's key and any IP-based
  logic; `false` behind a real proxy collapses every client into one bucket. Prefer a hop count or an
  explicit IP/CIDR list over `true` — see `parseTrustProxy` in `env.schema.ts`.
- **Request id.** `createRequestIdHook` (`common/security/`) echoes `request.id` as the
  `x-request-id` response header. `main.ts` constructs the `FastifyAdapter` with
  `requestIdHeader: "x-request-id"`, so a caller-supplied id round-trips unchanged and ties a
  client's report to one log line and one response.
- **Log redaction list** (`common/logger/`) strips known-sensitive fields (auth headers, tokens,
  secrets) from every log line before it's written — never add a field to a logged object without
  checking it isn't already covered, and extending the list when it isn't.
- **JWT algorithm pin.** Access tokens are verified HS256-only, with `JWT_EXPECTED_ISSUER` /
  `JWT_EXPECTED_AUDIENCE` opt-in via env (`common/auth/`, `AppConfigService.jwt`). Never widen the
  accepted algorithm set to satisfy a single caller.
- **Body limit.** `main.ts` passes `bodyLimit: 10 MiB` to the `FastifyAdapter`. Raise it per-route
  if a real need appears; never raise the global default speculatively.
- **Generic 500 bodies.** The exception filter (`common/filters/`) never leaks a stack trace or
  internal message for an unhandled error — only `AppError` subclasses control their own client-
  facing `message`.
- **Secrets never in the repo.** `.env*` is gitignored; only `.env.example` (no real values) is
  committed. A secret that leaks into a commit is rotated, not just removed from history.
- **`pnpm audit` in CI** — to be added; not yet wired into `.github/workflows/ci.yml`.
- **Dependency pinning via lockfile.** `pnpm-lock.yaml` is committed and is what CI installs from
  (`pnpm install --frozen-lockfile` semantics); a dependency bump is a lockfile diff in its own
  commit, never an ad hoc version bump in `package.json` alone.

## Quality gate

`pnpm run gate` runs, in order: `typecheck` (`tsc --noEmit`), `lint` (ESLint at the rules above),
`format:check` (Prettier), `test` (Jest unit, with coverage), `test:e2e` (Jest e2e config),
`openapi:check` (fails if `openapi.json` is stale — see OpenAPI below), and `build` (Nest CLI, SWC
builder). CI (`.github/workflows/ci.yml`) runs the same steps individually so a failure names the
exact stage. A PR is not done until this gate has been run and its output shown, not summarized —
see the PR template.

## How to add a feature module

1. Create `src/modules/<feature>/` with `<feature>.module.ts`, `<feature>.controller.ts`,
   `<feature>.service.ts`, `<feature>.repository.ts`, `<feature>.constants.ts`,
   `<feature>.types.ts`, `dto/`, and `schemas/`.
2. Write the failing test first: a `*.spec.ts` for the repository method, service method, or
   controller route you're about to add.
3. Define any new value sets as `as const` objects in `<feature>.constants.ts`; define the Mongo
   shape as a `@Schema()` class with a `Projections` constant in `schemas/`; define request/response
   shapes as Zod schemas turned into DTOs with `createZodDto` in `dto/`.
4. Implement the repository method (extending `BaseRepository`, intent-named, projected, `.lean()`),
   then the service method that calls it and applies business rules, then the controller route that
   calls exactly one service method.
5. Add `@ApiOperation` and `@ApiResponse` to the route, and a TSDoc block to every new export.
6. Register the module in `app.module.ts`.
7. Write `src/modules/<feature>/README.md` following the shape described in Documentation above.
8. Run `pnpm run gate` and `pnpm run openapi:generate`, and include both outputs in the PR.

## Sources

This document distils, for this template, the standards the owner signed off on in
`Myco/services/video-api/plans/revamp.md` (§ Code quality standards, Change locality, Template, Repo
tooling), `Myco/services/video-api/plans/revamp-standards.md`, and the Munchr TypeScript styleguide
(`Munchr/conductor/code_styleguides/typescript.md`), reconciled against this repository's actual
`eslint.config.mjs`. Deviations from those source documents, and why, are noted inline above; the
only place lint and docs disagree is size caps, where this repo enforces 40/300, matching the
Munchr styleguide's "~40 lines" rather than the video-api plan's initial 50-line draft — see Size
caps.
