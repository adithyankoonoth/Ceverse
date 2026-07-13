/**
 * Role-based access control for Ceverse.
 * Pure permission matrix — no DB / session side effects.
 */

export type Role =
  | "CREATOR"
  | "OPERATOR"
  | "MANUFACTURER"
  | "DESIGNER"
  | "PACKAGING_PARTNER"
  | "PHOTOGRAPHER"
  | "LAWYER"
  | "MARKETING_AGENCY"
  | "WAREHOUSE"
  | "INVESTOR"
  | "ADMIN"
  | "SUPER_ADMIN";

/**
 * Canonical permission strings used across API routes and services.
 */
export type Permission =
  | "profile:read"
  | "profile:write"
  | "marketplace:browse"
  | "marketplace:bookmark"
  | "proposal:create"
  | "proposal:respond"
  | "deal:read"
  | "deal:write"
  | "deal:manage_members"
  | "milestone:write"
  | "task:write"
  | "message:send"
  | "contract:create"
  | "contract:sign"
  | "escrow:fund"
  | "escrow:release"
  | "payment:read"
  | "dispute:open"
  | "dispute:resolve"
  | "verification:submit"
  | "verification:review"
  | "admin:users"
  | "admin:audit"
  | "admin:settings"
  | "admin:impersonate";

const OPERATOR_LIKE: Role[] = [
  "OPERATOR",
  "MANUFACTURER",
  "DESIGNER",
  "PACKAGING_PARTNER",
  "PHOTOGRAPHER",
  "LAWYER",
  "MARKETING_AGENCY",
  "WAREHOUSE",
  "INVESTOR",
];

/** Baseline permissions every authenticated non-admin role receives. */
const BASE_USER_PERMISSIONS: Permission[] = [
  "profile:read",
  "profile:write",
  "marketplace:browse",
  "marketplace:bookmark",
  "proposal:create",
  "proposal:respond",
  "deal:read",
  "deal:write",
  "milestone:write",
  "task:write",
  "message:send",
  "contract:create",
  "contract:sign",
  "escrow:fund",
  "payment:read",
  "dispute:open",
  "verification:submit",
];

const CREATOR_EXTRA: Permission[] = [
  // Creators can invite members into their deal rooms.
  "deal:manage_members",
  // Creators typically authorize escrow release after milestone approval.
  "escrow:release",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...BASE_USER_PERMISSIONS,
  "deal:manage_members",
  "escrow:release",
  "dispute:resolve",
  "verification:review",
  "admin:users",
  "admin:audit",
  "admin:settings",
];

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  "admin:impersonate",
];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  CREATOR: new Set([...BASE_USER_PERMISSIONS, ...CREATOR_EXTRA]),
  OPERATOR: new Set(BASE_USER_PERMISSIONS),
  MANUFACTURER: new Set(BASE_USER_PERMISSIONS),
  DESIGNER: new Set(BASE_USER_PERMISSIONS),
  PACKAGING_PARTNER: new Set(BASE_USER_PERMISSIONS),
  PHOTOGRAPHER: new Set(BASE_USER_PERMISSIONS),
  LAWYER: new Set(BASE_USER_PERMISSIONS),
  MARKETING_AGENCY: new Set(BASE_USER_PERMISSIONS),
  WAREHOUSE: new Set(BASE_USER_PERMISSIONS),
  INVESTOR: new Set(BASE_USER_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  SUPER_ADMIN: new Set(SUPER_ADMIN_PERMISSIONS),
};

export function isRole(value: string): value is Role {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}

export function permissionsFor(role: Role): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role]);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function hasAllPermissions(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isCreator(role: Role): boolean {
  return role === "CREATOR";
}

export function isOperatorLike(role: Role): boolean {
  return OPERATOR_LIKE.includes(role);
}

/**
 * Assert permission or throw a typed error (for service-layer guards).
 */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
