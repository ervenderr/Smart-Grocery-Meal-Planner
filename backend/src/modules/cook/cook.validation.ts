/**
 * Cook validation (express-validator). Errors carry code VALIDATION_ERROR.
 */

import { body, validationResult, ValidationChain } from "express-validator";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import {
  MAX_DEDUCTIONS,
  MAX_DEDUCTION_KEY_LENGTH,
  MAX_DEDUCTION_UNIT_LENGTH,
  MAX_DEDUCTION_USE,
  MAX_SERVINGS,
} from "./cook.constants";

export const validate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors
      .array()
      .map((err) => `${"path" in err ? err.path : "field"}: ${err.msg}`)
      .join(", ");
    throw new AppError(`Validation failed: ${messages}`, 400, true, {
      code: "VALIDATION_ERROR",
    });
  }
  next();
};

const hasExactlyOneTarget = (
  _value: unknown,
  { req }: { req: { body?: Record<string, unknown> } },
): boolean => {
  const body = req.body ?? {};
  const hasRecipe = body.recipeId !== undefined && body.recipeId !== null;
  const hasMeal =
    body.mealPlanItemId !== undefined && body.mealPlanItemId !== null;
  return hasRecipe !== hasMeal;
};

const targetChains = (): ValidationChain[] => [
  body("recipeId")
    .optional()
    .isUUID()
    .withMessage("recipeId must be a valid UUID"),
  body("mealPlanItemId")
    .optional()
    .isUUID()
    .withMessage("mealPlanItemId must be a valid UUID"),
  body("recipeId")
    .custom(hasExactlyOneTarget)
    .withMessage("Provide exactly one of recipeId or mealPlanItemId"),
];

export const validatePreview: ValidationChain[] = [
  ...targetChains(),
  body("servings")
    .optional()
    .isInt({ min: 1, max: MAX_SERVINGS })
    .withMessage(
      `servings must be a whole number between 1 and ${MAX_SERVINGS}`,
    )
    .toInt(),
];

const hasUniqueKeys = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;
  const keys = value.map((d) => (d as { key?: unknown } | null)?.key);
  return new Set(keys).size === keys.length;
};

export const validateApply: ValidationChain[] = [
  ...targetChains(),
  body("deductions")
    .isArray({ max: MAX_DEDUCTIONS })
    .withMessage(`deductions must be a list of at most ${MAX_DEDUCTIONS}`)
    .bail()
    .custom(hasUniqueKeys)
    .withMessage("deductions must have unique keys"),
  body("deductions.*.key")
    .isString()
    .withMessage("key must be text")
    .bail()
    .isLength({ min: 1, max: MAX_DEDUCTION_KEY_LENGTH })
    .withMessage(`key must be 1-${MAX_DEDUCTION_KEY_LENGTH} characters`),
  body("deductions.*.unit")
    .isString()
    .withMessage("unit must be text")
    .bail()
    .trim()
    .isLength({ min: 1, max: MAX_DEDUCTION_UNIT_LENGTH })
    .withMessage(`unit must be 1-${MAX_DEDUCTION_UNIT_LENGTH} characters`),
  body("deductions.*.use")
    .isFloat({ min: 0, max: MAX_DEDUCTION_USE })
    .withMessage(`use must be between 0 and ${MAX_DEDUCTION_USE}`)
    .toFloat(),
];
