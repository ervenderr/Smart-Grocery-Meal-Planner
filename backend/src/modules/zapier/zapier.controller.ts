/**
 * Zapier Controller
 *
 * HTTP request handlers for Zapier webhook management
 */

import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { zapierService } from "./zapier.service";
import { AppError } from "../../middleware/errorHandler";
import { ZapierEventType } from "./zapier.types";

/**
 * Get validation errors from request
 */
function handleValidationErrors(req: Request): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err) => err.msg)
      .join(", ");
    throw new AppError(errorMessages, 400);
  }
}

/**
 * Parse boolean query parameter
 */
function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export class ZapierController {
  /**
   * GET /zapier/events
   * Get all available Zapier event types
   */
  async getAvailableEvents(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const events = zapierService.getAvailableEvents();

      res.json({
        success: true,
        message: "Available Zapier events retrieved",
        data: {
          events,
          globalWebhookConfigured: !!process.env.ZAPIER_WEBHOOK_URL,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /zapier/webhooks
   * Get all user's webhook configurations
   */
  async getUserWebhooks(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { eventType, isActive } = req.query;

      const webhooks = await zapierService.getUserWebhooks(userId, {
        eventType: eventType as ZapierEventType | undefined,
        isActive: parseBooleanQuery(isActive),
      });

      res.json({
        success: true,
        message: "Webhooks retrieved",
        data: {
          webhooks,
          count: webhooks.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /zapier/webhooks/:webhookId
   * Get a specific webhook configuration
   */
  async getWebhookById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { webhookId } = req.params;

      const webhook = await zapierService.getWebhookById(userId, webhookId);

      res.json({
        success: true,
        message: "Webhook retrieved",
        data: { webhook },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /zapier/webhooks
   * Create a new webhook configuration
   */
  async createWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { eventType, webhookUrl } = req.body;

      const webhook = await zapierService.createUserWebhook(userId, {
        eventType,
        webhookUrl,
      });

      res.status(201).json({
        success: true,
        message: "Webhook created successfully",
        data: { webhook },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /zapier/webhooks/:webhookId
   * Update a webhook configuration
   */
  async updateWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { webhookId } = req.params;
      const { webhookUrl, isActive } = req.body;

      const webhook = await zapierService.updateUserWebhook(userId, webhookId, {
        webhookUrl,
        isActive,
      });

      res.json({
        success: true,
        message: "Webhook updated successfully",
        data: { webhook },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /zapier/webhooks/:webhookId
   * Delete a webhook configuration
   */
  async deleteWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { webhookId } = req.params;

      await zapierService.deleteUserWebhook(userId, webhookId);

      res.json({
        success: true,
        message: "Webhook deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /zapier/test
   * Test a webhook by sending a sample payload
   */
  async testWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleValidationErrors(req);

      const userId = (req as any).user.id;
      const { eventType } = req.body;

      const results = await zapierService.testWebhook(userId, eventType);

      const allSuccessful = results.every((r) => r.success);

      res.json({
        success: true,
        message: allSuccessful
          ? "All webhooks tested successfully"
          : "Some webhooks failed - check results for details",
        data: {
          results,
          summary: {
            total: results.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const zapierController = new ZapierController();
