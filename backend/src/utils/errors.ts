import type { Response } from "express";

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendError = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({ error: message });
};