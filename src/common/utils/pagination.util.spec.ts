import { buildPaginated } from "@/common/utils/pagination.util";

describe("buildPaginated", () => {
  it("builds the pagination envelope", () => {
    expect(buildPaginated(["a", "b"], 1, 20, 2)).toEqual({
      items: ["a", "b"],
      page: 1,
      limit: 20,
      total: 2,
    });
  });
});
