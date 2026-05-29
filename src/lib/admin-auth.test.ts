import { describe, expect, it } from "vitest";

import { isAdminBasicAuthAuthorized, parseBasicAuthHeader } from "@/lib/admin-auth";

function toBasicHeader(value: string) {
  return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
}

describe("admin auth", () => {
  it("parses valid basic auth header", () => {
    const parsed = parseBasicAuthHeader(toBasicHeader("admin:secret"));

    expect(parsed).toEqual({ username: "admin", password: "secret" });
  });

  it("rejects missing/invalid credentials", () => {
    expect(isAdminBasicAuthAuthorized(null, "admin", "secret")).toBe(false);
    expect(isAdminBasicAuthAuthorized("Basic invalid", "admin", "secret")).toBe(false);
    expect(isAdminBasicAuthAuthorized(toBasicHeader("admin:wrong"), "admin", "secret")).toBe(false);
  });

  it("authorizes matching credentials", () => {
    const authorized = isAdminBasicAuthAuthorized(toBasicHeader("admin:secret"), "admin", "secret");
    expect(authorized).toBe(true);
  });
});
