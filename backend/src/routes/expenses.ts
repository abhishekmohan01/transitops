import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
} from "../schemas/expense.schema.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Nested vehicle select — reused across GET endpoints
const expenseInclude = {
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      name: true,
      type: true,
      status: true,
    },
  },
};

// ─────────────────────────────────────────────
// GET /api/expenses
// List all expenses — all authenticated roles
// Optional filters: ?vehicleId=, ?type=TOLL|MAINTENANCE|OTHER, ?dateFrom=, ?dateTo=
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { vehicleId, type, dateFrom, dateTo } = req.query;

    const expenses = await prisma.expense.findMany({
      where: {
        ...(vehicleId ? { vehicleId: parseInt(vehicleId as string) } : {}),
        ...(type ? { type: type as string } : {}),
        ...(dateFrom || dateTo
          ? {
              date: {
                ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}),
                ...(dateTo ? { lte: new Date(dateTo as string) } : {}),
              },
            }
          : {}),
      },
      include: expenseInclude,
      orderBy: { date: "desc" },
    });

    // Aggregate total for convenience (used by reports)
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ data: expenses, count: expenses.length, totalAmount });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/expenses/:id
// Single expense — all authenticated roles
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) return sendError(res, 400, "Invalid expense id");

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });

    if (!expense) return sendError(res, 404, "Expense not found");

    res.json(expense);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/expenses
// Create an expense — FLEET_MANAGER + FINANCIAL_ANALYST
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER", "FINANCIAL_ANALYST"),
  async (req, res, next) => {
    try {
      const data = createExpenseSchema.parse(req.body);

      // Verify vehicle exists
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });
      if (!vehicle) {
        return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
      }

      const expense = await prisma.expense.create({
        data: {
          vehicleId: data.vehicleId,
          type: data.type,
          amount: data.amount,
          date: data.date,
        },
        include: expenseInclude,
      });

      res.status(201).json({
        message: "Expense created successfully",
        data: expense,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT /api/expenses/:id
// Full update — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.put(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid expense id");

      const data = updateExpenseSchema.parse(req.body);

      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Expense not found");

      // If vehicleId is being changed, verify new vehicle exists
      if (data.vehicleId && data.vehicleId !== existing.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
        });
        if (!vehicle) {
          return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
        }
      }

      // Strip undefined keys — required due to exactOptionalPropertyTypes in tsconfig
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      const expense = await prisma.expense.update({
        where: { id },
        data: updateData,
        include: expenseInclude,
      });

      res.json({ message: "Expense updated successfully", data: expense });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// DELETE /api/expenses/:id
// Delete — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid expense id");

      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Expense not found");

      await prisma.expense.delete({ where: { id } });
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;