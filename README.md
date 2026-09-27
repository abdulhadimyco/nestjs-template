# nestjs-template

A NestJS service template on the Fastify adapter, strict TypeScript, Mongoose, and Redis. It is the
starting point for every new Myco backend service: generate a repository from it, delete or keep the
example module, and inherit a working config layer, error handling, auth, CORS, caching, OpenAPI
generation, and CI from day one.

## Stack

| Layer           | Choice                        | Version                                     |
| --------------- | ----------------------------- | ------------------------------------------- |
| Runtime         | Node.js                       | 22 (see `.nvmrc`)                           |
| Framework       | NestJS on the Fastify adapter | 11                                          |
| Language        | TypeScript, strict mode       | ~5.9                                        |
| Validation      | Zod + `nestjs-zod`            | Zod 4, nestjs-zod 5                         |
| Database        | MongoDB via Mongoose          | Mongoose 8                                  |
| Cache           | Redis via ioredis             | ioredis 5                                   |
| Package manager | pnpm                          | 10 (see `packageManager` in `package.json`) |
| Test runner     | Jest                          | 30                                          |
| Build           | Nest CLI with the SWC builder | —                                           |

## Prerequisites

- Node.js 22, as pinned in `.nvmrc`. Use `nvm use` or equivalent.
- pnpm, via Corepack. `corepack enable` once per machine, then `corepack prepare` picks up the exact
  version pinned in `package.json`'s `packageManager` field automatically.
- A reachable MongoDB and Redis instance for local development (see Configuration).

## Create a service from this template

1. On GitHub, use "Use this template" on this repository to create the new service's repository.
2. Clone it and run `pnpm install`.
3. Copy `.env.example` to `.env` and fill in real values for local development.
4. Rename the service in `package.json` (`name`, `description`) and in the OpenAPI title passed to
   `setupOpenApi` in `src/main.ts`.
5. Decide what to do with `src/modules/notes`: it's a worked example of the module shape described
   in `docs/CONVENTIONS.md`. Delete it once you have a real first module, or keep it as a reference
   until then — either way, don't leave it registered in `app.module.ts` once it's not needed.
6. Make your first commit.

## Scripts

| Script                      | What it does                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run build`            | Cleans `dist/` and builds with the Nest CLI (SWC builder).                                                                 |
| `pnpm run start`            | Runs the built app from `dist/main.js` with `.env` loaded.                                                                 |
| `pnpm run start:prod`       | Runs the built app with no env file (the container/ConfigMap supplies the environment).                                    |
| `pnpm run dev`              | Runs `nest start --watch` with `.env` loaded (copy `.env.example` first).                                                  |
| `pnpm run dev:prod`         | Runs with `.env.production` loaded, still watching.                                                                        |
| `pnpm run debug`            | Runs with the Node inspector open on `0.0.0.0:9229`, watching.                                                             |
| `pnpm run typecheck`        | `tsc --noEmit` against `tsconfig.json`.                                                                                    |
| `pnpm run lint`             | ESLint across the repository.                                                                                              |
| `pnpm run lint:fix`         | ESLint with autofix.                                                                                                       |
| `pnpm run format`           | Prettier, writing changes.                                                                                                 |
| `pnpm run format:check`     | Prettier, checking only.                                                                                                   |
| `pnpm run test`             | Jest unit tests (`*.spec.ts`).                                                                                             |
| `pnpm run test:watch`       | Jest in watch mode.                                                                                                        |
| `pnpm run test:cov`         | Jest unit tests with a coverage report.                                                                                    |
| `pnpm run test:e2e`         | Jest end-to-end tests under `test/`.                                                                                       |
| `pnpm run check:deps`       | `knip`, to find unused files, exports, and dependencies.                                                                   |
| `pnpm run gate`             | Runs typecheck, lint, format check, unit tests, e2e tests, `openapi:check`, and build in sequence — the full quality gate. |
| `pnpm run openapi:generate` | Boots the app without listening and writes `openapi.json` to the repo root.                                                |
| `pnpm run openapi:check`    | Same, but fails if `openapi.json` on disk doesn't match — this is what CI runs.                                            |

## Project layout

```
src/
  main.ts              Bootstraps the Fastify-backed Nest app.
  app.module.ts         Root module.
  config/               Env schema (Zod) and the typed AppConfigService.
  common/                Cross-cutting code: logger, errors, filters, interceptors, auth, cors,
                         cache, mongo, dto, utils, openapi, signing.
  integrations/          One folder per external vendor, wrapping its SDK behind a typed provider.
  modules/               One folder per feature (controller, service, DTOs, schemas, tests, README).
test/                    End-to-end and contract tests.
docs/                    CONVENTIONS.md and any other project documentation.
scripts/                 One-off and CI-support scripts (for example generate-openapi.ts).
```

See `docs/CONVENTIONS.md` for the full rules on what goes where and why.

## Configuration

All configuration is read once, in `src/config/env.schema.ts`, and exposed elsewhere through the
typed `AppConfigService`. `process.env` is unreachable outside that one file (a lint rule enforces
this). Every key in `.env.example`:

| Key                       | Meaning                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | `development`, `test`, or `production`. Defaults to `development`.                                          |
| `PORT`                    | HTTP port the service listens on. Defaults to `3000`.                                                       |
| `LOG_LEVEL`               | `debug`, `info`, `warn`, or `error`. Defaults to `info`.                                                    |
| `MONGO_URI`               | MongoDB connection string. Required.                                                                        |
| `REDIS_URL`               | Redis connection string. Required.                                                                          |
| `ACCESS_TOKEN_JWT_SECRET` | Secret used to verify incoming access tokens. Required.                                                     |
| `JWT_EXPECTED_ISSUER`     | Optional `iss` claim to enforce on incoming tokens.                                                         |
| `JWT_EXPECTED_AUDIENCE`   | Optional `aud` claim to enforce on incoming tokens.                                                         |
| `ALLOWED_ORIGINS`         | Comma-separated list of origins allowed by CORS.                                                            |
| `RATE_LIMIT_ENABLED`      | `false` disables the in-process limiter when the edge (Cloudflare) already rate-limits. Defaults to `true`. |
| `RATE_LIMIT_MAX`          | Max requests per client per window. Defaults to `300`.                                                      |
| `RATE_LIMIT_WINDOW_MS`    | Rate-limit window, in milliseconds. Defaults to `60000`.                                                    |
| `TRUST_PROXY`             | `true`/`false`, a hop count, or a comma list of proxy IPs/CIDRs. See Security below. Defaults to `false`.   |
| `SHUTDOWN_TIMEOUT_MS`     | Graceful shutdown timeout, in milliseconds. Defaults to `10000`.                                            |

## Security

- In production, `env.schema.ts` requires a `ACCESS_TOKEN_JWT_SECRET` of at least 32 characters, a
  non-empty and non-wildcard `ALLOWED_ORIGINS`, and rejects `LOG_LEVEL=debug`.
- Rate limiting is on by default (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`), keyed by client IP,
  returning `429` with the service's standard error body. Set `RATE_LIMIT_ENABLED=false` when the
  limit is enforced at the edge (Cloudflare) so requests are not limited twice.
- Set `TRUST_PROXY` to the number of trusted hops in front of this service, not a bare `true` —
  behind Cloudflare alone that's `TRUST_PROXY=1`. `true` trusts every hop, including anything a
  client itself claims to be, and lets a client spoof its own IP and bypass the rate limiter's key;
  `false` behind any proxy collapses every client into one rate-limit bucket. Use a comma list of
  IPs/CIDRs instead of a hop count when the trusted proxies aren't a fixed chain length.
- Every response carries `x-request-id`, matching the id in that request's log line.
- The OpenAPI UI (`/docs`) is only served when `NODE_ENV !== "production"`.

See `docs/CONVENTIONS.md` § Security for the full checklist.

## Running locally

```bash
pnpm install
cp .env.example .env   # then fill in real values
pnpm run dev
```

The service listens on `PORT` (default `3000`) with the global prefix `api` and URI versioning
(`/api/v1/...`), except routes explicitly marked `VERSION_NEUTRAL` (for example `/healthz`).

### With Docker

```bash
docker build -t nestjs-template .
docker run --env-file .env -p 3000:3000 nestjs-template
```

The `Dockerfile` builds with pnpm and the Nest CLI, then ships a production image running
`dist/main.js` under `dumb-init` as a non-root user.

## Testing

- `pnpm run test` for unit tests, colocated as `*.spec.ts` next to the code they cover.
- `pnpm run test:e2e` for end-to-end tests under `test/`, using `test/jest-e2e.config.ts`.
- Coverage floor is 80% (branches, functions, lines, statements) — see `jest.config.ts`.
- Write the failing test first. See `docs/CONVENTIONS.md` § Testing.

## OpenAPI

`src/common/openapi/openapi.setup.ts` builds the OpenAPI document with `@nestjs/swagger`'s
`DocumentBuilder`, registers a bearer auth scheme named `accessToken`, runs `nestjs-zod`'s
`cleanupOpenApiDoc` so Zod-derived schemas render correctly, and serves the Swagger UI (`/docs` by
default). `scripts/generate-openapi.ts` boots the app without listening and writes the resulting
document to `openapi.json` at the repo root; `--check` makes it exit non-zero if that file is stale
instead of writing it. Run `pnpm run openapi:generate` after any route change and commit the result;
CI's `pnpm run openapi:check` fails the build otherwise.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: checkout, Node/pnpm
setup (`.github/actions/setup-node`), typecheck, lint, format check, unit tests with coverage, e2e
tests, an OpenAPI check (`pnpm run openapi:check`), and build — each as its own named step, so a
failure points at the exact stage.

## Conventions

The full rulebook — types, size caps, naming, structure, single-source-of-truth rules, testing, git,
and the quality gate — lives in `docs/CONVENTIONS.md`. Read it before adding a first feature module.

## What is deliberately NOT here

- **Kubernetes manifests** — added by the first service that has a concrete deployment target
  needing them; this template doesn't assume one.
- **Kafka or any message queue** — added when a service actually has an event to publish or
  consume; no speculative event bus.
- **Metrics/tracing/health-check endpoints** — added when a service has a concrete observability or
  liveness/readiness requirement, so the choice of tooling (and whether that's `@nestjs/terminus` or
  something else) matches that need instead of guessing.
- **Database seeders** — added by the first service whose local development needs seed data; a
  generic seeder for an empty schema has nothing useful to generate.

## Licence and derivation

MIT — see `LICENSE`. The tooling layout (ESLint config shape, Husky hooks, lint-staged, commitlint,
Dockerfile structure) is derived from
[AlbertHernandez/nestjs-service-template](https://github.com/AlbertHernandez/nestjs-service-template),
also MIT.
