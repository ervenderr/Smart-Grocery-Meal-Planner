import { Request, Response } from 'express';
import { lookupBarcode, searchNutrition } from './food.service';

export async function getBarcode(req: Request, res: Response): Promise<void> {
  const { product, attribution, cached } = await lookupBarcode(String(req.params.code));
  res.json({ product, attribution, cached });
}

export async function getNutrition(req: Request, res: Response): Promise<void> {
  const { results, attribution, cached } = await searchNutrition(String(req.query.query));
  res.json({ results, attribution, cached });
}
