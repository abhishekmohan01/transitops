import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { sendError } from "../utils/errors.js";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, 401, "No token provided or invalid format");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();
  } catch (error: any) {
    return sendError(res, 401, "Invalid or expired token");
  }
};
