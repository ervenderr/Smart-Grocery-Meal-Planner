/**
 * Shopping validation (express-validator). Errors carry code VALIDATION_ERROR.
 */

import { body, param, validationResult, ValidationChain } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { PantryCategory } from '../../types/pantry.types';
import {
  MAX_ITEM_CENTS,
  MAX_ITEM_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  MIN_QUANTITY,
  SHOPPING_ERROR_CODES,
} from './shopping.constants';
import { normalizeUnit } from './shopping.units';

// eslint-disable-next-line no-control-regex -- intentionally strips control characters
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const UNIT_MESSAGE = 'Unit must be a known unit or up to 20 letters, digits, spaces or . % / -';
const UPDATABLE_FIELDS = [
  'itemName',
  'quantity',
  'unit',
  'category',
  'costEstimateCents',
  'actualCostCents',
  'isChecked',
  'notes',
] as const;

/** Strips control characters, collapses whitespace and trims. Never HTML-escapes. */
export const sanitizeText = (value: unknown): unknown =>
  typeof value === 'string'
    ? value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
    : value;

export const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors
      .array()
      .map((err) => `${'path' in err ? err.path : 'field'}: ${err.msg}`)
      .join(', ');
    throw new AppError(`Validation failed: ${messages}`, 400, true, {
      code: SHOPPING_ERROR_CODES.VALIDATION_ERROR,
    });
  }
  next();
};

const itemFieldChains = (required: boolean): ValidationChain[] => {
  const name = required ? body('itemName') : body('itemName').optional();
  return [
    name
      .customSanitizer(sanitizeText)
      .isString()
      .withMessage('Item name must be text')
      .bail()
      .notEmpty()
      .withMessage('Item name is required')
      .isLength({ max: MAX_ITEM_NAME_LENGTH })
      .withMessage(`Item name must be at most ${MAX_ITEM_NAME_LENGTH} characters`),
    body('quantity')
      .optional()
      .isFloat({ min: MIN_QUANTITY, max: MAX_QUANTITY })
      .withMessage(`Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`)
      .toFloat(),
    body('unit')
      .optional()
      .custom((v) => typeof v === 'string' && normalizeUnit(v) !== null)
      .withMessage(UNIT_MESSAGE)
      .customSanitizer((v: string) => normalizeUnit(v) ?? v),
    body('category')
      .optional({ values: 'falsy' })
      .isIn(Object.values(PantryCategory))
      .withMessage(`Category must be one of: ${Object.values(PantryCategory).join(', ')}`),
    body('isChecked').optional().isBoolean({ strict: true }).withMessage('isChecked must be a boolean'),
    ...(['costEstimateCents', 'actualCostCents'] as const).map((field) =>
      body(field)
        .optional({ nullable: true })
        .isInt({ min: 0, max: MAX_ITEM_CENTS })
        .withMessage(`${field} must be a whole number between 0 and ${MAX_ITEM_CENTS}`)
        .toInt(),
    ),
    body('notes')
      .optional({ nullable: true })
      .customSanitizer(sanitizeText)
      .isString()
      .withMessage('Notes must be text')
      .isLength({ max: MAX_NOTES_LENGTH })
      .withMessage(`Notes must be at most ${MAX_NOTES_LENGTH} characters`),
  ];
};

export const validateCreateItem: ValidationChain[] = itemFieldChains(true);

export const validateUpdateItem: ValidationChain[] = [
  ...itemFieldChains(false),
  body().custom((value: unknown) => {
    const has =
      typeof value === 'object' &&
      value !== null &&
      UPDATABLE_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(value, f));
    if (!has) throw new Error('Provide at least one field to update');
    return true;
  }),
];

export const validateItemId: ValidationChain[] = [
  param('itemId').isUUID().withMessage('Item id must be a valid UUID'),
];
