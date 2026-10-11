import { describe, expect, it } from 'vitest';
import { filterRecipes } from './filter-recipes';
import type { Recipe } from '@/types/recipe.types';

const make = (id: string, over: Partial<Recipe>) =>
  ({
    id,
    name: id,
    description: null,
    category: 'dinner',
    difficulty: 'easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }) as Recipe;

const recipes = [
  make('Pasta', { createdAt: '2026-01-01T00:00:00Z', prepTimeMinutes: 5, cookTimeMinutes: 20, description: 'Tomato sauce' }),
  make('Omelette', { category: 'breakfast', createdAt: '2026-03-01T00:00:00Z', prepTimeMinutes: 2, cookTimeMinutes: 5 }),
  make('Brisket', { difficulty: 'hard', createdAt: '2026-02-01T00:00:00Z', prepTimeMinutes: 30, cookTimeMinutes: 300 }),
];
const ids = (r: Recipe[]) => r.map((x) => x.id);

describe('filterRecipes', () => {
  it('sorts newest first by default', () => {
    expect(ids(filterRecipes(recipes, {}))).toEqual(['Omelette', 'Brisket', 'Pasta']);
  });

  it('searches name and description case-insensitively', () => {
    expect(ids(filterRecipes(recipes, { search: 'TOMATO' }))).toEqual(['Pasta']);
    expect(ids(filterRecipes(recipes, { search: 'ome' }))).toEqual(['Omelette']);
  });

  it('filters by category and difficulty', () => {
    expect(ids(filterRecipes(recipes, { category: 'breakfast' }))).toEqual(['Omelette']);
    expect(ids(filterRecipes(recipes, { difficulty: 'hard' }))).toEqual(['Brisket']);
  });

  it('sorts by name asc/desc', () => {
    expect(ids(filterRecipes(recipes, { sortBy: 'name', sortOrder: 'asc' }))).toEqual(['Brisket', 'Omelette', 'Pasta']);
    expect(ids(filterRecipes(recipes, { sortBy: 'name', sortOrder: 'desc' }))).toEqual(['Pasta', 'Omelette', 'Brisket']);
  });

  it('sorts by total time', () => {
    expect(ids(filterRecipes(recipes, { sortBy: 'totalTime', sortOrder: 'asc' }))).toEqual(['Omelette', 'Pasta', 'Brisket']);
  });

  it('does not mutate input', () => {
    const copy = [...recipes];
    filterRecipes(recipes, { sortBy: 'name', sortOrder: 'asc' });
    expect(recipes).toEqual(copy);
  });
});
