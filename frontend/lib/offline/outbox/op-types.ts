import { z } from 'zod';
import type { OutboxState } from '../sql/schema';

export const OP_KINDS = [
  'shopping.item.create',
  'shopping.item.update',
  'shopping.item.delete',
  'pantry.create',
  'pantry.adjust',
  'pantry.update',
  'pantry.delete',
  'shopping.finish',
  'cook.apply',
] as const;
export type OpKind = (typeof OP_KINDS)[number];
export type EntityType = 'shopping-item' | 'pantry-item' | 'shopping-list' | 'cook';

const uuid = z.string().uuid();
const isoDate = z.string().datetime();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const label = z.string().min(1).max(120);

const UNITS = ['lbs', 'kg', 'grams', 'oz', 'cups', 'ml', 'liters', 'tsp', 'tbsp', 'fl_oz', 'pieces', 'items'] as const;
const CATEGORIES = ['protein', 'vegetable', 'fruit', 'dairy', 'grains', 'spices', 'canned', 'frozen', 'beverages', 'condiments', 'other'] as const;
const LOCATIONS = ['fridge', 'freezer', 'pantry', 'counter', 'cabinet'] as const;

const shoppingCreate = z.object({
  itemName: z.string().min(1),
  quantity: z.number().finite().optional(),
  unit: z.string().optional(),
  category: z.string().nullable().optional(),
  costEstimateCents: z.number().nullable().optional(),
  actualCostCents: z.number().nullable().optional(),
  isChecked: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
const shoppingPatch = shoppingCreate.partial().strict().refine((p) => Object.keys(p).length > 0, 'empty patch');

const pantryCreate = z.object({
  ingredientName: z.string().min(1),
  category: z.enum(CATEGORIES),
  quantity: z.number().finite().nonnegative(),
  unit: z.enum(UNITS),
  expiryDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  location: z.enum(LOCATIONS).optional(),
  notes: z.string().optional(),
  barcode: z.string().optional(),
});
const pantryPatch = z
  .object({
    ingredientName: z.string().min(1),
    category: z.enum(CATEGORIES),
    unit: z.enum(UNITS),
    expiryDate: z.string().nullable(),
    purchaseDate: z.string().nullable(),
    location: z.enum(LOCATIONS).nullable(),
    notes: z.string().nullable(),
    barcode: z.string().nullable(),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'empty patch');

const delta = z
  .number()
  .finite()
  .refine((d) => Math.round(d * 100) !== 0, 'delta must be non-zero')
  .refine((d) => Math.abs(d * 100 - Math.round(d * 100)) < 1e-6, 'max 2 decimals');

const base = { inverse: z.unknown().optional(), label };
const op = <K extends OpKind, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ kind: z.literal(kind), payload, ...base });

export const NewOpSchema = z.discriminatedUnion('kind', [
  op('shopping.item.create', z.object({ item: shoppingCreate.extend({ id: uuid }) })),
  op('shopping.item.update', z.object({ id: uuid, patch: shoppingPatch })),
  op('shopping.item.delete', z.object({ id: uuid })),
  op('pantry.create', z.object({ item: pantryCreate.extend({ id: uuid }) })),
  op('pantry.adjust', z.object({ id: uuid, delta })),
  op('pantry.update', z.object({ id: uuid, patch: pantryPatch })),
  op('pantry.delete', z.object({ id: uuid })),
  op(
    'shopping.finish',
    z.object({
      input: z.object({
        carryOver: z.enum(['carry', 'discard']).optional(),
        addToPantry: z.boolean().optional(),
        occurredAt: isoDate,
        receiptDate: ymd,
      }),
    })
  ),
  op(
    'cook.apply',
    z.object({
      target: z.union([z.object({ recipeId: uuid }), z.object({ mealPlanItemId: uuid })]),
      servings: z.number().int().positive(),
      occurredAt: isoDate,
    })
  ),
]);

export type NewOp = z.infer<typeof NewOpSchema>;

export type LastError = {
  reason: 'gone' | 'conflict' | 'invalid' | 'max-attempts' | 'transient' | 'auth';
  status?: number;
  code?: string;
};

export type OutboxOp = {
  seq: number;
  opId: string;
  idempotencyKey: string;
  userId: string;
  kind: OpKind;
  entityType: EntityType;
  entityId: string;
  payload: NewOp['payload'];
  inverse: unknown;
  resolved: unknown | null;
  label: string;
  state: OutboxState;
  attempts: number;
  lastError: LastError | null;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
};

export function entityOf(op: NewOp): { entityType: EntityType; entityId: string } {
  switch (op.kind) {
    case 'shopping.item.create':
    case 'pantry.create':
      return { entityType: op.kind === 'pantry.create' ? 'pantry-item' : 'shopping-item', entityId: op.payload.item.id };
    case 'shopping.item.update':
    case 'shopping.item.delete':
      return { entityType: 'shopping-item', entityId: op.payload.id };
    case 'pantry.adjust':
    case 'pantry.update':
    case 'pantry.delete':
      return { entityType: 'pantry-item', entityId: op.payload.id };
    case 'shopping.finish':
      return { entityType: 'shopping-list', entityId: 'active' };
    case 'cook.apply': {
      const t = op.payload.target;
      return { entityType: 'cook', entityId: 'mealPlanItemId' in t ? t.mealPlanItemId : t.recipeId };
    }
  }
}

export function barrierFor(kind: OpKind): EntityType[] | null {
  if (kind === 'shopping.finish') return ['shopping-item'];
  if (kind === 'cook.apply') return ['pantry-item'];
  return null;
}
