import { Router } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import { sendError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const user = await registerUser(validatedData);
    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await loginUser(validatedData);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "Not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;