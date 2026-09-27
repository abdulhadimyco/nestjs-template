import { buildHelmetOptions } from "@/common/security/helmet-options";

describe("buildHelmetOptions", () => {
  it("keeps Helmet's untouched defaults in production", () => {
    expect(buildHelmetOptions({ isProduction: true })).toEqual({});
  });

  it("widens script-src and style-src for the Swagger UI outside production", () => {
    const options = buildHelmetOptions({ isProduction: false });

    expect(options).toEqual({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    });
  });
});
