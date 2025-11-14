/**
 * Pantry Service
 *
 * Business logic for pantry item management.
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  CreatePantryItemRequest,
  UpdatePantryItemRequest,
  PantryItemResponse,
  GetPantryItemsQuery,
  PaginatedPantryResponse,
  PantryStats,
} from '../../types/pantry.types';
import { Decimal } from '@prisma/client/runtime/library';

export class PantryService {
  /**
   * Create a new pantry item
   */
  async createItem(
    userId: string,
    data: CreatePantryItemRequest
  ): Promise<PantryItemResponse> {
    const {
      ingredientName,
      quantity,
      unit,
      category,
      expiryDate,
      purchaseDate,
      purchasePriceCents,
      location,
      notes,
    } = data;

    // Validate quantity
    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than 0', 400);
    }

    // Create the pantry item
    const item = await prisma.pantryItem.create({
      data: {
        userId,
        ingredientName: ingredientName.trim(),
        quantity: new Decimal(quantity),
        unit,
        category,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePriceCents,
        location,
        notes,
      },
    });

    logger.info('Pantry item created', {
      service: 'kitcha-api',
      userId,
      itemId: item.id,
      ingredientName: item.ingredientName,
    });

    return this.formatItem(item);
  }

  /**
   * Get all pantry items for a user with filtering and pagination
   */
  async getItems(
    userId: string,
    query: GetPantryItemsQuery
  ): Promise<PaginatedPantryResponse> {
    const {
      category,
      location,
      expiringSoon,
      expired,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = {
      userId,
      deletedAt: null, // Exclude soft-deleted items
    };

    if (category) {
      where.category = category;
    }

    if (location) {
      where.location = location;
    }

    if (search) {
      where.ingredientName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Handle expiry filters
    if (expiringSoon) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

      where.expiryDate = {
        gte: today,
        lte: sevenDaysFromNow,
      };
    } else if (expired) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      where.expiryDate = {
        lt: today,
      };
    }

    // Get total count
    const total = await prisma.pantryItem.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.ingredientName = sortOrder;
    } else if (sortBy === 'expiryDate') {
      orderBy.expiryDate = sortOrder;
    } else if (sortBy === 'quantity') {
      orderBy.quantity = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get items
    const items = await prisma.pantryItem.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    });

    return {
      items: items.map((item) => this.formatItem(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single pantry item by ID
   */
  async getItemById(userId: string, itemId: string): Promise<PantryItemResponse> {
    const item = await prisma.pantryItem.findFirst({
      where: {
        id: itemId,
        userId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new AppError('Pantry item not found', 404);
    }

    return this.formatItem(item);
  }

  /**
   * Update a pantry item
   */
  async updateItem(
    userId: string,
    itemId: string,
    data: UpdatePantryItemRequest
  ): Promise<PantryItemResponse> {
    // Check if item exists and belongs to user
    const existingItem = await prisma.pantryItem.findFirst({
      where: {
        id: itemId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingItem) {
      throw new AppError('Pantry item not found', 404);
    }

    // Validate quantity if provided
    if (data.quantity !== undefined && data.quantity <= 0) {
      throw new AppError('Quantity must be greater than 0', 400);
    }

    // Prepare update data
    const updateData: any = {};

    if (data.ingredientName !== undefined) {
      updateData.ingredientName = data.ingredientName.trim();
    }
    if (data.quantity !== undefined) {
      updateData.quantity = new Decimal(data.quantity);
    }
    if (data.unit !== undefined) {
      updateData.unit = data.unit;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.expiryDate !== undefined) {
      updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }
    if (data.purchaseDate !== undefined) {
      updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
    }
    if (data.purchasePriceCents !== undefined) {
      updateData.purchasePriceCents = data.purchasePriceCents;
    }
    if (data.location !== undefined) {
      updateData.location = data.location;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Update item
    const item = await prisma.pantryItem.update({
      where: { id: itemId },
      data: updateData,
    });

    logger.info('Pantry item updated', {
      service: 'kitcha-api',
      userId,
      itemId,
    });

    return this.formatItem(item);
  }

  /**
   * Delete a pantry item (soft delete)
   */
  async deleteItem(userId: string, itemId: string): Promise<void> {
    // Check if item exists and belongs to user
    const existingItem = await prisma.pantryItem.findFirst({
      where: {
        id: itemId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingItem) {
      throw new AppError('Pantry item not found', 404);
    }

    // Soft delete
    await prisma.pantryItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    logger.info('Pantry item deleted', {
      service: 'kitcha-api',
      userId,
      itemId,
    });
  }

  /**
   * Get pantry statistics
   */
  async getStats(userId: string): Promise<PantryStats> {
    const items = await prisma.pantryItem.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

    // Calculate statistics
    const stats: PantryStats = {
      totalItems: items.length,
      totalValue: items.reduce(
        (sum, item) => sum + (item.purchasePriceCents || 0),
        0
      ),
      expiringWithin7Days: items.filter(
        (item) =>
          item.expiryDate &&
          item.expiryDate >= today &&
          item.expiryDate <= sevenDaysFromNow
      ).length,
      expired: items.filter((item) => item.expiryDate && item.expiryDate < today)
        .length,
      byCategory: {},
      byLocation: {},
    };

    // Count by category
    items.forEach((item) => {
      stats.byCategory[item.category] =
        (stats.byCategory[item.category] || 0) + 1;
    });

    // Count by location
    items.forEach((item) => {
      if (item.location) {
        stats.byLocation[item.location] =
          (stats.byLocation[item.location] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Format pantry item for response
   */
  private formatItem(item: any): PantryItemResponse {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let isExpired = false;
    let daysUntilExpiry: number | null = null;

    if (item.expiryDate) {
      const expiryDate = new Date(item.expiryDate);
      expiryDate.setUTCHours(0, 0, 0, 0);

      isExpired = expiryDate < today;

      if (!isExpired) {
        const diffTime = expiryDate.getTime() - today.getTime();
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      id: item.id,
      userId: item.userId,
      ingredientName: item.ingredientName,
      quantity: item.quantity.toString(),
      unit: item.unit,
      category: item.category,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().split('T')[0] : null,
      purchaseDate: item.purchaseDate
        ? item.purchaseDate.toISOString().split('T')[0]
        : null,
      purchasePriceCents: item.purchasePriceCents,
      location: item.location,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      isExpired,
      daysUntilExpiry,
    };
  }
}
