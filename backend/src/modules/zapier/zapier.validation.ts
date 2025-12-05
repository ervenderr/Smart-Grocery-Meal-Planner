/**
 * Zapier Validation Schemas
 *
 * Request validation using express-validator
 */

import { body, param, query } from "express-validator";
import { getAvailableEventTypes } from "./zapier.events";

const eventTypes = getAvailableEventTypes();

/**
 * Validation for creating a webhook
 */
export const createWebhookValidation = [
  body("eventType")
    .notEmpty()
    .withMessage("eventType is required")
    .isIn(eventTypes)
    .withMessage(`eventType must be one of: ${eventTypes.join(", ")}`),

  body("webhookUrl")
    .notEmpty()
    .withMessage("webhookUrl is required")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("webhookUrl must be a valid HTTP/HTTPS URL"),
];

/**
 * Validation for updating a webhook
 */
export const updateWebhookValidation = [
  body("webhookUrl")
    .optional()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("webhookUrl must be a valid HTTP/HTTPS URL"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

/**
 * Validation for testing a webhook
 */
export const testWebhookValidation = [
  body("eventType")
    .notEmpty()
    .withMessage("eventType is required")
    .isIn(eventTypes)
    .withMessage(`eventType must be one of: ${eventTypes.join(", ")}`),
];

/**
 * Validation for webhook ID parameter
 */
export const webhookIdValidation = [
  param("webhookId")
    .notEmpty()
    .withMessage("webhookId is required")
    .isUUID()
    .withMessage("webhookId must be a valid UUID"),
];

/**
 * Validation for query parameters
 */
export const webhookQueryValidation = [
  query("eventType")
    .optional()
    .isIn(eventTypes)
    .withMessage(`eventType must be one of: ${eventTypes.join(", ")}`),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];
