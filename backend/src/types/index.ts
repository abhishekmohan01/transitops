import type { Role } from "@prisma/client";
import type { Request } from "express";

export interface AuthPayload {
  userId: number;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}