/**
 * Zapier Routes
 *
 * API routes for Zapier webhook management
 *
 * Routes:
 * - GET    /zapier/events          - Get available event types
 * - GET    /zapier/webhooks        - Get user's webhooks
 * - GET    /zapier/webhooks/:id    - Get specific webhook
 * - POST   /zapier/webhooks        - Create new webhook
 * - PATCH  /zapier/webhooks/:id    - Update webhook
 * - DELETE /zapier/webhooks/:id    - Delete webhook
 * - POST   /zapier/test            - Test webhook
 */

import { Router } from "express";
import { zapierController } from "./zapier.controller";
import { authenticate } from "../../middleware/auth.middleware";
import {
  createWebhookValidation,
  updateWebhookValidation,
  testWebhookValidation,
  webhookIdValidation,
  webhookQueryValidation,
} from "./zapier.validation";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /zapier/events
 * Get all available Zapier event types
 * Public endpoint (authenticated users only)
 */
router.get(
  "/events",
  zapierController.getAvailableEvents.bind(zapierController)
);

/**
 * GET /zapier/webhooks
 * Get all user's webhook configurations
 * Query params: eventType, isActive
 */
router.get(
  "/webhooks",
  webhookQueryValidation,
  zapierController.getUserWebhooks.bind(zapierController)
);

/**
 * GET /zapier/webhooks/:webhookId
 * Get a specific webhook configuration
 */
router.get(
  "/webhooks/:webhookId",
  webhookIdValidation,
  zapierController.getWebhookById.bind(zapierController)
);

/**
 * POST /zapier/webhooks
 * Create a new webhook configuration
 * Body: { eventType, webhookUrl }
 */
router.post(
  "/webhooks",
  createWebhookValidation,
  zapierController.createWebhook.bind(zapierController)
);

/**
 * PATCH /zapier/webhooks/:webhookId
 * Update a webhook configuration
 * Body: { webhookUrl?, isActive? }
 */
router.patch(
  "/webhooks/:webhookId",
  [...webhookIdValidation, ...updateWebhookValidation],
  zapierController.updateWebhook.bind(zapierController)
);

/**
 * DELETE /zapier/webhooks/:webhookId
 * Delete a webhook configuration
 */
router.delete(
  "/webhooks/:webhookId",
  webhookIdValidation,
  zapierController.deleteWebhook.bind(zapierController)
);

/**
 * POST /zapier/test
 * Test a webhook by sending a sample payload
 * Body: { eventType }
 */
router.post(
  "/test",
  testWebhookValidation,
  zapierController.testWebhook.bind(zapierController)
);

export default router;
