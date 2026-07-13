import type { UserRole } from "@prisma/client";

/** End-user / marketplace participant roles. */
export const USER_ROLES = [
  "CREATOR",
  "OPERATOR",
  "MANUFACTURER",
  "DESIGNER",
  "PACKAGING_PARTNER",
  "PHOTOGRAPHER",
  "LAWYER",
  "MARKETING_AGENCY",
  "WAREHOUSE",
  "INVESTOR",
] as const satisfies readonly UserRole[];

/** Operator-like roles that provide services to creators. */
export const OPERATOR_ROLES = [
  "OPERATOR",
  "MANUFACTURER",
  "DESIGNER",
  "PACKAGING_PARTNER",
  "PHOTOGRAPHER",
  "LAWYER",
  "MARKETING_AGENCY",
  "WAREHOUSE",
  "INVESTOR",
] as const satisfies readonly UserRole[];

/** Platform administration roles. */
export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const satisfies readonly UserRole[];

export type UserRoleValue = (typeof USER_ROLES)[number];
export type OperatorRoleValue = (typeof OPERATOR_ROLES)[number];
export type AdminRoleValue = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  CREATOR: "Creator",
  OPERATOR: "Operator",
  MANUFACTURER: "Manufacturer",
  DESIGNER: "Designer",
  PACKAGING_PARTNER: "Packaging Partner",
  PHOTOGRAPHER: "Photographer",
  LAWYER: "Lawyer",
  MARKETING_AGENCY: "Marketing Agency",
  WAREHOUSE: "Warehouse",
  INVESTOR: "Investor",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export function isAdmin(role: UserRole): boolean {
  return (ADMIN_ROLES as readonly UserRole[]).includes(role);
}

export function isOperatorLike(role: UserRole): boolean {
  return (OPERATOR_ROLES as readonly UserRole[]).includes(role);
}

export function isCreator(role: UserRole): boolean {
  return role === "CREATOR";
}
