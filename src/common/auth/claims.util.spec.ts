import type { AccessTokenClaims } from "@/common/auth/auth.types";
import { extractBearerToken, toAuthUser } from "@/common/auth/claims.util";

describe("toAuthUser", () => {
  const baseClaims: AccessTokenClaims = {
    sub: "sub-1",
    exp: 1,
    iat: 1,
  };

  it("prefers the myco:userid claim over sub", () => {
    const result = toAuthUser({ ...baseClaims, "myco:userid": "user-1" });

    expect(result.userId).toBe("user-1");
  });

  it("falls back to sub when myco:userid is absent", () => {
    const result = toAuthUser(baseClaims);

    expect(result.userId).toBe("sub-1");
  });

  it("prefers username over preferred_username", () => {
    const result = toAuthUser({
      ...baseClaims,
      username: "alice",
      preferred_username: "alice2",
    });

    expect(result.username).toBe("alice");
  });

  it("falls back to preferred_username when username is absent", () => {
    const result = toAuthUser({
      ...baseClaims,
      preferred_username: "alice2",
    });

    expect(result.username).toBe("alice2");
  });

  it("leaves username undefined when neither claim is present", () => {
    const result = toAuthUser(baseClaims);

    expect(result.username).toBeUndefined();
  });

  it("defaults groups to an empty array when absent", () => {
    const result = toAuthUser(baseClaims);

    expect(result.groups).toEqual([]);
    expect(result.isAdmin).toBe(false);
  });

  it("marks isAdmin true when cognito:groups includes Admin", () => {
    const result = toAuthUser({
      ...baseClaims,
      "cognito:groups": ["Editor", "Admin"],
    });

    expect(result.isAdmin).toBe(true);
    expect(result.groups).toEqual(["Editor", "Admin"]);
  });

  it("marks isAdmin false when cognito:groups excludes Admin", () => {
    const result = toAuthUser({
      ...baseClaims,
      "cognito:groups": ["Editor"],
    });

    expect(result.isAdmin).toBe(false);
  });

  it("carries the original claims through", () => {
    const result = toAuthUser(baseClaims);

    expect(result.claims).toBe(baseClaims);
  });
});

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed header", () => {
    expect(extractBearerToken({ authorization: "Bearer abc.def.ghi" })).toBe(
      "abc.def.ghi",
    );
  });

  it("is case-insensitive on the header name", () => {
    expect(extractBearerToken({ Authorization: "Bearer abc.def.ghi" })).toBe(
      "abc.def.ghi",
    );
  });

  it("tolerates extra whitespace around the token", () => {
    expect(
      extractBearerToken({ authorization: "Bearer   abc.def.ghi  " }),
    ).toBe("abc.def.ghi");
  });

  it("returns undefined when the header is missing", () => {
    expect(extractBearerToken({})).toBeUndefined();
  });

  it("returns undefined when the scheme is not Bearer", () => {
    expect(extractBearerToken({ authorization: "Basic abc" })).toBeUndefined();
  });

  it("returns undefined when the token is empty", () => {
    expect(extractBearerToken({ authorization: "Bearer " })).toBeUndefined();
  });
});
