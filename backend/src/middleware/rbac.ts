import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { sendError } from "../utils/errors.js";

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return sendError(res, 401, "Not authenticated");
    }

    if (!allowedRoles.includes(user.role)) {
      return sendError(res, 403, "Forbidden: Insufficient permissions");
    }

    next();
  };
};
