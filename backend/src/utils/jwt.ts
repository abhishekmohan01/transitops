import jwt from "jsonwebtoken";
import type { AuthPayload } from "../types/index.js";
import { AppError } from "./errors.js";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-fallback";

export const signToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): AuthPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }
};