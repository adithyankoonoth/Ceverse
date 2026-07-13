import { describe, expect, it } from "vitest";
import {
  hasPermission,
  isAdmin,
  isCreator,
  isOperatorLike,
  permissionsFor,
} from "@/lib/rbac";

describe("rbac", () => {
  it("grants creators marketplace and escrow release", () => {
    expect(hasPermission("CREATOR", "marketplace:browse")).toBe(true);
    expect(hasPermission("CREATOR", "escrow:release")).toBe(true);
    expect(hasPermission("CREATOR", "admin:users")).toBe(false);
  });

  it("grants admins full admin surface", () => {
    expect(hasPermission("ADMIN", "admin:users")).toBe(true);
    expect(hasPermission("ADMIN", "verification:review")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "admin:impersonate")).toBe(true);
    expect(hasPermission("ADMIN", "admin:impersonate")).toBe(false);
  });

  it("classifies roles", () => {
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isCreator("CREATOR")).toBe(true);
    expect(isOperatorLike("MANUFACTURER")).toBe(true);
    expect(isOperatorLike("CREATOR")).toBe(false);
  });

  it("returns non-empty permission sets", () => {
    expect(permissionsFor("CREATOR").length).toBeGreaterThan(5);
    expect(permissionsFor("SUPER_ADMIN").length).toBeGreaterThan(
      permissionsFor("CREATOR").length,
    );
  });
});
