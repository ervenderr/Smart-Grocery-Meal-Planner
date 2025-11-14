/**
 * Pantry Controller
 *
 * HTTP request handlers for pantry endpoints.
 */

import { Request, Response } from 'express';
import { PantryService } from './pantry.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  CreatePantryItemRequest,
  UpdatePantryItemRequest,
  GetPantryItemsQuery,
} from '../../types/pantry.types';

export class PantryController {
  private pantryService: PantryService;

  constructor() {
    this.pantryService = new PantryService();
  }

  /**
   * Create a new pantry item
   * POST /api/v1/pantry
   */
  createItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data: CreatePantryItemRequest = req.body;

    const item = await this.pantryService.createItem(userId, data);

    res.status(201).json(item);
  });

  /**
   * Get all pantry items with filtering and pagination
   * GET /api/v1/pantry
   */
  getItems = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const query: GetPantryItemsQuery = {
      category: req.query.category as string,
      location: req.query.location as string,
      expiringSoon: req.query.expiringSoon === 'true',
      expired: req.query.expired === 'true',
      search: req.query.search as string,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.pantryService.getItems(userId, query);

    res.status(200).json(result);
  });

  /**
   * Get a single pantry item by ID
   * GET /api/v1/pantry/:id
   */
  getItemById = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const itemId = req.params.id;

    const item = await this.pantryService.getItemById(userId, itemId);

    res.status(200).json(item);
  });

  /**
   * Update a pantry item
   * PATCH /api/v1/pantry/:id
   */
  updateItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const itemId = req.params.id;
    const data: UpdatePantryItemRequest = req.body;

    const item = await this.pantryService.updateItem(userId, itemId, data);

    res.status(200).json(item);
  });

  /**
   * Delete a pantry item
   * DELETE /api/v1/pantry/:id
   */
  deleteItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const itemId = req.params.id;

    await this.pantryService.deleteItem(userId, itemId);

    res.status(200).json({ message: 'Pantry item deleted successfully' });
  });

  /**
   * Get pantry statistics
   * GET /api/v1/pantry/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const stats = await this.pantryService.getStats(userId);

    res.status(200).json(stats);
  });

  /**
   * Get items expiring soon
   * GET /api/v1/pantry/expiring-soon
   */
  getExpiringSoon = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const days = req.query.days ? parseInt(req.query.days as string) : 7;

    const query: GetPantryItemsQuery = {
      expiringSoon: true,
      sortBy: 'expiryDate',
      sortOrder: 'asc',
    };

    const result = await this.pantryService.getItems(userId, query);

    // Filter items expiring within specified days
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const expiringItems = result.items.filter(item => {
      if (!item.expiryDate) return false;
      const expiryDate = new Date(item.expiryDate);
      return expiryDate >= now && expiryDate <= futureDate;
    });

    res.status(200).json(expiringItems);
  });
}
