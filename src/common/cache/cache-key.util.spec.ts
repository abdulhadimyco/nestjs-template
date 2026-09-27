import { createCacheKeyBuilder } from "@/common/cache/cache-key.util";

describe("createCacheKeyBuilder", () => {
  it("joins the prefix and parts with a colon", () => {
    const buildKey = createCacheKeyBuilder<[string]>("notes:id");

    expect(buildKey("abc123")).toBe("notes:id:abc123");
  });

  it("joins multiple parts", () => {
    const buildKey = createCacheKeyBuilder<[string, string]>("notes:list");

    expect(buildKey("owner1", "draft")).toBe("notes:list:owner1:draft");
  });

  it("throws a TypeError for an empty part", () => {
    const buildKey = createCacheKeyBuilder<[string]>("notes:id");

    expect(() => buildKey("")).toThrow(TypeError);
  });

  it("throws a TypeError for a part containing a colon", () => {
    const buildKey = createCacheKeyBuilder<[string]>("notes:id");

    expect(() => buildKey("a:b")).toThrow(TypeError);
  });

  it("throws a TypeError for a part containing whitespace", () => {
    const buildKey = createCacheKeyBuilder<[string]>("notes:id");

    expect(() => buildKey("a b")).toThrow(TypeError);
  });
});
