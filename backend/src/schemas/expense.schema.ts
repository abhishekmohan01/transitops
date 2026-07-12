import { z } from "zod";

// ─────────────────────────────────────────────
// Expense type enum — matches PRD Section 5.7
// ─────────────────────────────────────────────
export const ExpenseTypeEnum = z.enum(["TOLL", "MAINTENANCE", "OTHER"], {
  errorMap: () => ({
    message: "type must be one of: TOLL, MAINTENANCE, OTHER",
  }),
});

// ─────────────────────────────────────────────
// POST /api/expenses
// ─────────────────────────────────────────────
export const createExpenseSchema = z.object({
  vehicleId: z
    .number({
      required_error: "vehicleId is required",
      invalid_type_error: "vehicleId must be a number",
    })
    .int()
    .positive("vehicleId must be a positive integer"),
  type: ExpenseTypeEnum,
  amount: z
    .number({ required_error: "amount is required" })
    .positive("Amount must be greater than 0"),
  date: z.coerce.date({ required_error: "date is required" }),
});

// ─────────────────────────────────────────────
// PUT /api/expenses/:id
// ─────────────────────────────────────────────
export const updateExpenseSchema = z
  .object({
    vehicleId: z.number().int().positive().optional(),
    type: ExpenseTypeEnum.optional(),
    amount: z.number().positive("Amount must be greater than 0").optional(),
    date: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
