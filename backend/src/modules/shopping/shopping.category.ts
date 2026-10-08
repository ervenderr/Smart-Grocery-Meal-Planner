/**
 * Server-side category inference for manually added shopping items.
 * Small keyword map; unknown names fall back to "other".
 */

import { PantryCategory } from '../../types/pantry.types';

type CategoryRule = readonly [PantryCategory, readonly string[]];

/** Multi-word phrases are checked first (e.g. "bell pepper" is not a spice). */
const PHRASES: readonly CategoryRule[] = Object.freeze([
  [PantryCategory.VEGETABLE, Object.freeze(['bell pepper', 'sweet potato'])],
  [PantryCategory.SPICES, Object.freeze(['black pepper', 'chili powder', 'curry powder'])],
  [PantryCategory.CONDIMENTS, Object.freeze(['soy sauce', 'olive oil', 'fish sauce'])],
  [PantryCategory.BEVERAGES, Object.freeze(['orange juice', 'apple juice'])],
  [PantryCategory.FROZEN, Object.freeze(['ice cream'])],
]);

/** Single keywords in precedence order. */
const KEYWORDS: readonly CategoryRule[] = Object.freeze([
  [PantryCategory.FROZEN, Object.freeze(['frozen'])],
  [PantryCategory.CANNED, Object.freeze(['canned', 'tinned'])],
  [
    PantryCategory.BEVERAGES,
    Object.freeze(['water', 'juice', 'coffee', 'tea', 'soda', 'beer', 'wine']),
  ],
  [
    PantryCategory.CONDIMENTS,
    Object.freeze([
      'sauce', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'oil', 'honey', 'sugar',
    ]),
  ],
  [
    PantryCategory.SPICES,
    Object.freeze([
      'salt', 'pepper', 'cumin', 'paprika', 'cinnamon', 'oregano', 'thyme', 'basil', 'turmeric',
    ]),
  ],
  [PantryCategory.DAIRY, Object.freeze(['milk', 'cheese', 'butter', 'yogurt', 'cream'])],
  [
    PantryCategory.PROTEIN,
    Object.freeze([
      'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'tofu', 'turkey',
      'bacon', 'ham', 'sausage',
    ]),
  ],
  [
    PantryCategory.FRUIT,
    Object.freeze([
      'apple', 'banana', 'orange', 'lemon', 'lime', 'mango', 'berry', 'berries', 'grape',
      'pineapple',
    ]),
  ],
  [
    PantryCategory.VEGETABLE,
    Object.freeze([
      'onion', 'garlic', 'tomato', 'potato', 'carrot', 'lettuce', 'spinach', 'cabbage',
      'cucumber', 'broccoli', 'eggplant', 'pea',
    ]),
  ],
  [
    PantryCategory.GRAINS,
    Object.freeze(['rice', 'bread', 'pasta', 'noodle', 'flour', 'oat', 'cereal', 'tortilla']),
  ],
]);

const tokenMatches = (token: string, keyword: string): boolean =>
  token === keyword || token === `${keyword}s` || token === `${keyword}es`;

export function inferCategory(name: string): PantryCategory {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return PantryCategory.OTHER;

  const padded = ` ${tokens.join(' ')} `;
  for (const [category, phrases] of PHRASES) {
    if (phrases.some((p) => padded.includes(` ${p} `) || padded.includes(` ${p}s `))) {
      return category;
    }
  }
  for (const [category, words] of KEYWORDS) {
    if (tokens.some((t) => words.some((w) => tokenMatches(t, w)))) return category;
  }
  return PantryCategory.OTHER;
}
