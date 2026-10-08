import { param, query, ValidationChain } from 'express-validator';

export { validate } from '../ai/ai.validation';

export const validateBarcode: ValidationChain[] = [
  param('code').matches(/^\d{8,14}$/).withMessage('barcode must be 8 to 14 digits'),
];

export const validateNutritionQuery: ValidationChain[] = [
  query('query')
    .isString()
    .withMessage('query is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('query must be 2-80 characters')
    .escape(),
];
