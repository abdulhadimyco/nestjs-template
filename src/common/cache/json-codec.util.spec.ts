import { z } from "zod";

import { createJsonCodec } from "@/common/cache/json-codec.util";

describe("createJsonCodec", () => {
  it("round-trips a plain value without a schema", () => {
    const codec = createJsonCodec<{ a: number }>();

    const raw = codec.serialize({ a: 1 });
    expect(codec.parse(raw)).toEqual({ a: 1 });
  });

  it("validates parsed values against a given schema", () => {
    const schema = z.object({ a: z.number() });
    const codec = createJsonCodec(schema);

    expect(codec.parse('{"a":1}')).toEqual({ a: 1 });
    expect(() => codec.parse('{"a":"x"}')).toThrow();
  });
});
