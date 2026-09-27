import { AUTH_METADATA } from "@/common/auth/auth.constants";
import { OptionalAuth } from "@/common/auth/optional-auth.decorator";

describe("OptionalAuth", () => {
  it("sets the optional-auth metadata to true", () => {
    class TestController {
      @OptionalAuth()
      public handler(): void {
        // no-op
      }
    }

    // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- getMetadata is added by the reflect-metadata polyfill Nest itself depends on.
    const value: unknown = Reflect.getMetadata(
      AUTH_METADATA.IS_OPTIONAL,
      TestController.prototype.handler,
    );

    expect(value).toBe(true);
  });
});
