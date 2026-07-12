// Frontend RBAC Utility

export const ROLES = {
  ADMIN: "ADMIN",
  FLEET_MANAGER: "FLEET_MANAGER",
  DRIVER: "DRIVER",
  SAFETY_OFFICER: "SAFETY_OFFICER",
  FINANCIAL_ANALYST: "FINANCIAL_ANALYST"
};

export const hasPermission = (userRole: string | undefined, allowedRoles: string[]) => {
  if (!userRole) return false;
  if (userRole === ROLES.ADMIN) return true;
  return allowedRoles.includes(userRole);
};

export const getRequiredRolesText = (allowedRoles: string[]) => {
  // Admin is always implicitly allowed, so we add it to the list if not present
  const roles = Array.from(new Set([ROLES.ADMIN, ...allowedRoles]));
  return roles
    .map(role => role.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase()))
    .join(", ");
};
