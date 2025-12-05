/**
 * Zapier Integration Service
 *
 * Core service for dispatching events to Zapier webhooks
 * Supports both global webhooks (from env) and per-user webhooks (from DB)
 */

import axios, { AxiosError } from "axios";
import { prisma } from "../../config/database.config";
import { config } from "../../config/env.config";
import { logger } from "../../config/logger.config";
import { AppError } from "../../middleware/errorHandler";
import {
  ZapierEventType,
  WebhookDispatchResult,
  WebhookDispatchSummary,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ZapierWebhookConfig,
} from "./zapier.types";
import { ZAPIER_EVENTS, getEventDefinition } from "./zapier.events";

// Timeout for webhook requests (5 seconds)
const WEBHOOK_TIMEOUT = 5000;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

export class ZapierService {
  /**
   * Get the global webhook URL from environment
   */
  private getGlobalWebhookUrl(): string | undefined {
    return config.zapier?.webhookUrl;
  }

  /**
   * Dispatch an event to all configured webhooks (global + user-specific)
   */
  async dispatchEvent(
    userId: string,
    eventType: ZapierEventType,
    payload: Record<string, unknown>
  ): Promise<WebhookDispatchSummary> {
    const results: WebhookDispatchResult[] = [];
    const fullPayload = {
      ...payload,
      eventType,
      timestamp: new Date().toISOString(),
      userId,
    };

    // Get user email for payload enrichment
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      (fullPayload as any).userEmail = user.email;
    }

    // 1. Dispatch to global webhook (if configured)
    const globalUrl = this.getGlobalWebhookUrl();
    if (globalUrl) {
      const result = await this.sendWebhook(globalUrl, fullPayload, "global");
      results.push(result);
    }

    // 2. Dispatch to user-specific webhooks for this event type
    const userWebhooks = await prisma.zapierWebhook.findMany({
      where: {
        userId,
        eventType,
        isActive: true,
      },
    });

    for (const webhook of userWebhooks) {
      const result = await this.sendWebhook(
        webhook.webhookUrl,
        fullPayload,
        webhook.id
      );
      results.push(result);
    }

    const summary: WebhookDispatchSummary = {
      eventType,
      totalDispatched: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };

    logger.info("Zapier event dispatched", {
      service: "kitcha-api",
      module: "zapier",
      userId,
      eventType,
      totalDispatched: summary.totalDispatched,
      successful: summary.successful,
      failed: summary.failed,
    });

    return summary;
  }

  /**
   * Send a webhook request with retry logic
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: Record<string, unknown>,
    webhookId: string
  ): Promise<WebhookDispatchResult> {
    let lastError: string | undefined;
    const eventType = payload.eventType as ZapierEventType;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: WEBHOOK_TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Kitcha-API/1.0",
            "X-Webhook-Event": eventType,
          },
        });

        // Log successful webhook
        await this.logWebhookResult(webhookId, payload, response.status, true);

        return {
          success: true,
          eventType,
          webhookUrl: this.maskUrl(webhookUrl),
          statusCode: response.status,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = axiosError.message;

        if (attempt < MAX_RETRIES) {
          logger.warn("Webhook failed, retrying...", {
            service: "kitcha-api",
            module: "zapier",
            webhookId,
            attempt: attempt + 1,
            error: lastError,
          });
          await this.delay(RETRY_DELAY * (attempt + 1));
        }
      }
    }

    // Log failed webhook
    await this.logWebhookResult(
      webhookId,
      payload,
      undefined,
      false,
      lastError
    );

    return {
      success: false,
      eventType,
      webhookUrl: this.maskUrl(webhookUrl),
      error: lastError,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log webhook result for debugging/monitoring
   */
  private async logWebhookResult(
    webhookId: string,
    payload: Record<string, unknown>,
    statusCode: number | undefined,
    success: boolean,
    error?: string
  ): Promise<void> {
    // For now, just log to application logs
    // Could be extended to store in DB for audit trail
    const eventType = payload.eventType as string;
    if (success) {
      logger.debug("Webhook delivered successfully", {
        service: "kitcha-api",
        module: "zapier",
        webhookId,
        eventType,
        statusCode,
      });
    } else {
      logger.error("Webhook delivery failed", {
        service: "kitcha-api",
        module: "zapier",
        webhookId,
        eventType,
        error,
      });
    }
  }

  /**
   * Mask webhook URL for logging (security)
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}/***`;
    } catch {
      return "***";
    }
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // User Webhook Management
  // ============================================

  /**
   * Create a new user webhook configuration
   */
  async createUserWebhook(
    userId: string,
    data: CreateWebhookRequest
  ): Promise<ZapierWebhookConfig> {
    // Check if webhook for this event type already exists
    const existing = await prisma.zapierWebhook.findFirst({
      where: {
        userId,
        eventType: data.eventType,
      },
    });

    if (existing) {
      throw new AppError(
        "Webhook for this event type already exists. Update or delete the existing one.",
        409
      );
    }

    const webhook = await prisma.zapierWebhook.create({
      data: {
        userId,
        eventType: data.eventType,
        webhookUrl: data.webhookUrl,
        isActive: true,
      },
    });

    logger.info("User webhook created", {
      service: "kitcha-api",
      module: "zapier",
      userId,
      webhookId: webhook.id,
      eventType: data.eventType,
    });

    return this.formatWebhook(webhook);
  }

  /**
   * Get all webhooks for a user
   */
  async getUserWebhooks(
    userId: string,
    filters?: { eventType?: ZapierEventType; isActive?: boolean }
  ): Promise<ZapierWebhookConfig[]> {
    const where: any = { userId };

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const webhooks = await prisma.zapierWebhook.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return webhooks.map((w) => this.formatWebhook(w));
  }

  /**
   * Get a single webhook by ID
   */
  async getWebhookById(
    userId: string,
    webhookId: string
  ): Promise<ZapierWebhookConfig> {
    const webhook = await prisma.zapierWebhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new AppError("Webhook not found", 404);
    }

    return this.formatWebhook(webhook);
  }

  /**
   * Update a user webhook
   */
  async updateUserWebhook(
    userId: string,
    webhookId: string,
    data: UpdateWebhookRequest
  ): Promise<ZapierWebhookConfig> {
    const webhook = await prisma.zapierWebhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new AppError("Webhook not found", 404);
    }

    const updated = await prisma.zapierWebhook.update({
      where: { id: webhookId },
      data: {
        webhookUrl: data.webhookUrl ?? webhook.webhookUrl,
        isActive: data.isActive ?? webhook.isActive,
      },
    });

    logger.info("User webhook updated", {
      service: "kitcha-api",
      module: "zapier",
      userId,
      webhookId,
    });

    return this.formatWebhook(updated);
  }

  /**
   * Delete a user webhook
   */
  async deleteUserWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await prisma.zapierWebhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new AppError("Webhook not found", 404);
    }

    await prisma.zapierWebhook.delete({
      where: { id: webhookId },
    });

    logger.info("User webhook deleted", {
      service: "kitcha-api",
      module: "zapier",
      userId,
      webhookId,
    });
  }

  /**
   * Test a webhook by sending a sample payload
   */
  async testWebhook(
    userId: string,
    eventType: ZapierEventType
  ): Promise<WebhookDispatchResult[]> {
    const eventDef = getEventDefinition(eventType);
    if (!eventDef) {
      throw new AppError("Invalid event type", 400);
    }

    const samplePayload: Record<string, unknown> = {
      ...eventDef.samplePayload,
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      _test: true,
    };

    const results: WebhookDispatchResult[] = [];

    // Test global webhook
    const globalUrl = this.getGlobalWebhookUrl();
    if (globalUrl) {
      const result = await this.sendWebhook(
        globalUrl,
        samplePayload,
        "global-test"
      );
      results.push(result);
    }

    // Test user webhooks for this event type
    const userWebhooks = await prisma.zapierWebhook.findMany({
      where: {
        userId,
        eventType,
        isActive: true,
      },
    });

    for (const webhook of userWebhooks) {
      const result = await this.sendWebhook(
        webhook.webhookUrl,
        samplePayload,
        `${webhook.id}-test`
      );
      results.push(result);
    }

    if (results.length === 0) {
      throw new AppError("No webhooks configured for this event type", 400);
    }

    return results;
  }

  /**
   * Get available event types with descriptions
   */
  getAvailableEvents() {
    return Object.values(ZAPIER_EVENTS).map((event) => ({
      type: event.type,
      name: event.name,
      description: event.description,
      category: event.category,
      priority: event.priority,
    }));
  }

  /**
   * Format webhook for response
   */
  private formatWebhook(webhook: any): ZapierWebhookConfig {
    return {
      id: webhook.id,
      userId: webhook.userId,
      eventType: webhook.eventType as ZapierEventType,
      webhookUrl: webhook.webhookUrl,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}

// Export singleton instance
export const zapierService = new ZapierService();
