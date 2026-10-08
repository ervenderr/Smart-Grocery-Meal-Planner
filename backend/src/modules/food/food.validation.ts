import { param, query, ValidationChain } from 'express-validator';

export { validate } from '../ai/ai.validation';

export const validateBarcode: ValidationChain[] = [
  param('code').matches(/^\d{8,14}$/).withMessage('barcode must be 8 to 14 digits'),
];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

export function sanitizeSearchQuery(value: string): string {
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

export const validateNutritionQuery: ValidationChain[] = [
  query('query')
    .isString()
    .withMessage('query is required')
    .bail()
    // The value is only URL-encoded into an upstream query string and never
    // rendered as HTML, so strip control characters instead of HTML-escaping.
    .customSanitizer(sanitizeSearchQuery)
    .isLength({ min: 2, max: 80 })
    .withMessage('query must be 2-80 characters'),
];
