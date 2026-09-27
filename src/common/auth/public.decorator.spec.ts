import { AUTH_METADATA } from "@/common/auth/auth.constants";
import { Public } from "@/common/auth/public.decorator";

describe("Public", () => {
  it("sets the public-route metadata to true", () => {
    class TestController {
      @Public()
      public handler(): void {
        // no-op
      }
    }

    // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- getMetadata is added by the reflect-metadata polyfill Nest itself depends on.
    const value: unknown = Reflect.getMetadata(
      AUTH_METADATA.IS_PUBLIC,
      TestController.prototype.handler,
    );

    expect(value).toBe(true);
  });
});
