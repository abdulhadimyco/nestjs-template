import type { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Extra CSP directives the Swagger UI needs: it bootstraps its bundle with
 * an inline script and inline styles, both of which Helmet's default
 * `Content-Security-Policy` blocks. Helmet merges any `directives` passed
 * here with its own defaults, so only these two are overridden — every
 * other default directive (`default-src 'self'`, `object-src 'none'`, and
 * so on) is kept.
 */
const SWAGGER_CSP_DIRECTIVES = {
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
} as const;

/** Input to {@link buildHelmetOptions}. */
export type HelmetOptionsInput = {
  isProduction: boolean;
};

/**
 * Builds the `@fastify/helmet` plugin options for this service.
 *
 * Helmet's own defaults (a strict `Content-Security-Policy`,
 * `X-Frame-Options: DENY`, `Strict-Transport-Security`, and the rest) are
 * correct for a pure JSON API and are never weakened in production —
 * `contentSecurityPolicy: false` would remove the CSP header globally just
 * to accommodate one route, which is the wrong trade.
 *
 * In non-production, the Swagger UI is also mounted (see `src/main.ts`), so
 * this widens `script-src`/`style-src` with `'unsafe-inline'` just enough
 * for its bundle to boot, merged on top of Helmet's defaults. That widening
 * never reaches production: a production deploy serves no UI and gets
 * Helmet's untouched strict defaults.
 *
 * @param input - Whether the service is running in production.
 * @returns The Fastify Helmet plugin options.
 */
export function buildHelmetOptions(
  input: HelmetOptionsInput,
): FastifyHelmetOptions {
  if (input.isProduction) {
    return {};
  }

  return {
    contentSecurityPolicy: {
      directives: SWAGGER_CSP_DIRECTIVES,
    },
  };
}
