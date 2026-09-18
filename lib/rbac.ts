export enum Permission {
  MANAGE_ORGANIZATION = "MANAGE_ORGANIZATION",
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_ROLES = "MANAGE_ROLES",
  MANAGE_BOOKINGS = "MANAGE_BOOKINGS",
  CREATE_BOOKINGS = "CREATE_BOOKINGS",
  VIEW_BOOKINGS = "VIEW_BOOKINGS",
}

export type RoleName = "ADMIN" | "MANAGER" | "STAFF";

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  ADMIN: [
    Permission.MANAGE_ORGANIZATION,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.MANAGE_BOOKINGS,
    Permission.CREATE_BOOKINGS,
    Permission.VIEW_BOOKINGS,
  ],

  MANAGER: [
    Permission.MANAGE_BOOKINGS,
    Permission.CREATE_BOOKINGS,
    Permission.VIEW_BOOKINGS,
  ],

  STAFF: [
    Permission.CREATE_BOOKINGS,
    Permission.VIEW_BOOKINGS,
  ],
};

export function roleHasPermission(
  roleName: string,
  permission: Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[roleName as RoleName];

  return permissions ? permissions.includes(permission) : false;
}

export function requirePermission(
  roleName: string,
  permission: Permission
): void {
  if (!roleHasPermission(roleName, permission)) {
    throw new Error(
      `Forbidden: role "${roleName}" does not have permission "${permission}".`
    );
  }
}