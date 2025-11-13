/**
 * Alert Controller
 *
 * HTTP request handlers for alert endpoints.
 */

import { Request, Response } from 'express';
import { AlertService } from './alert.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  CreateAlertRequest,
  GetAlertsQuery,
} from '../../types/alert.types';

export class AlertController {
  private alertService: AlertService;

  constructor() {
    this.alertService = new AlertService();
  }

  /**
   * Create a new alert
   * POST /api/v1/alerts
   */
  createAlert = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data: CreateAlertRequest = req.body;

    const alert = await this.alertService.createAlert(userId, data);
    res.status(201).json(alert);
  });

  /**
   * Get all alerts
   * GET /api/v1/alerts
   */
  getAlerts = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const query: GetAlertsQuery = {
      alertType: req.query.alertType as string,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      dismissed: req.query.dismissed === 'true' ? true : req.query.dismissed === 'false' ? false : undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.alertService.getAlerts(userId, query);
    res.status(200).json(result);
  });

  /**
   * Get a single alert
   * GET /api/v1/alerts/:id
   */
  getAlertById = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const alert = await this.alertService.getAlertById(userId, id);
    res.status(200).json(alert);
  });

  /**
   * Mark alert as read
   * PATCH /api/v1/alerts/:id/read
   */
  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const alert = await this.alertService.markAsRead(userId, id);
    res.status(200).json(alert);
  });

  /**
   * Dismiss alert
   * POST /api/v1/alerts/:id/dismiss
   */
  dismissAlert = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await this.alertService.dismissAlert(userId, id);
    res.status(200).json({ message: 'Alert dismissed successfully' });
  });

  /**
   * Delete alert
   * DELETE /api/v1/alerts/:id
   */
  deleteAlert = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await this.alertService.deleteAlert(userId, id);
    res.status(200).json({ message: 'Alert deleted successfully' });
  });

  /**
   * Get budget status
   * GET /api/v1/alerts/budget/status
   */
  getBudgetStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const status = await this.alertService.getBudgetStatus(userId);
    res.status(200).json(status);
  });

  /**
   * Check for expiring items
   * POST /api/v1/alerts/check-expiring
   */
  checkExpiringItems = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const alertsCreated = await this.alertService.checkExpiringItems(userId);
    res.status(200).json({
      message: `Checked expiring items, created ${alertsCreated} alert(s)`,
      alertsCreated,
    });
  });

  /**
   * Get alert statistics
   * GET /api/v1/alerts/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const stats = await this.alertService.getStats(userId);
    res.status(200).json(stats);
  });
}
