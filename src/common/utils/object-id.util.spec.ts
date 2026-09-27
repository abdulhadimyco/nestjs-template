import { Types } from "mongoose";

import { ValidationError } from "@/common/errors/app.error";
import { parseObjectId } from "@/common/utils/object-id.util";

describe("parseObjectId", () => {
  it("parses a valid ObjectId string", () => {
    const id = new Types.ObjectId().toHexString();

    expect(parseObjectId(id).toHexString()).toBe(id);
  });

  it("throws ValidationError for an invalid id", () => {
    expect(() => parseObjectId("not-an-id")).toThrow(ValidationError);
  });
});
