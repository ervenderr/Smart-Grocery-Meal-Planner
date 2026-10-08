import { describe, expect, it } from 'vitest';
import {
  NAV_MORE,
  NAV_PRIMARY,
  NAV_SIDEBAR,
  getPageTitle,
  isActive,
  isMoreActive,
} from '@/lib/navigation';

describe('nav config', () => {
  it('has the primary tabs in order', () => {
    expect(NAV_PRIMARY.map((i) => [i.label, i.href])).toEqual([
      ['Home', '/dashboard'],
      ['Pantry', '/pantry'],
      ['Meals', '/mealplans'],
      ['Shopping', '/shopping'],
    ]);
  });

  it('has the more items in order with groups', () => {
    expect(NAV_MORE.map((i) => [i.label, i.href])).toEqual([
      ['Recipes', '/recipes'],
      ['AI features', '/recipes?ai=suggestions'],
      ['Budget', '/budget'],
      ['Analytics', '/analytics'],
      ['Alerts', '/alerts'],
      ['Settings', '/settings'],
      ['Profile', '/profile'],
      ['Help', '/help'],
    ]);
    for (const item of NAV_MORE) {
      expect(['explore', 'account']).toContain(item.group);
    }
  });

  it('keeps the sidebar labels', () => {
    expect(NAV_SIDEBAR.map((i) => i.label)).toEqual([
      'Dashboard',
      'Pantry',
      'Recipes',
      'Meal Plans',
      'Shopping Lists',
      'Budget',
      'Analytics',
      'Settings',
    ]);
  });
});

describe('isActive', () => {
  it('matches exact routes', () => {
    expect(isActive('/dashboard', '/dashboard', true)).toBe(true);
    expect(isActive('/dashboard/x', '/dashboard', true)).toBe(false);
  });
  it('matches nested routes by segment', () => {
    expect(isActive('/pantry/123', '/pantry')).toBe(true);
    expect(isActive('/pantryx', '/pantry')).toBe(false);
  });
  it('handles null pathname and query hrefs', () => {
    expect(isActive(null, '/pantry')).toBe(false);
    expect(isActive('/recipes', '/recipes?ai=suggestions')).toBe(true);
  });
});

describe('isMoreActive', () => {
  it('is true on more routes', () => {
    expect(isMoreActive('/budget')).toBe(true);
    expect(isMoreActive('/recipes/abc')).toBe(true);
  });
  it('is false on primary routes and null', () => {
    expect(isMoreActive('/pantry')).toBe(false);
    expect(isMoreActive('/dashboard')).toBe(false);
    expect(isMoreActive(null)).toBe(false);
  });
});

describe('getPageTitle', () => {
  it('maps known routes', () => {
    expect(getPageTitle('/mealplans')).toBe('Meal Plans');
    expect(getPageTitle('/shopping')).toBe('Shopping');
    expect(getPageTitle('/alerts')).toBe('Alerts');
    expect(getPageTitle('/pantry/12')).toBe('Pantry');
  });
  it('falls back to Kitcha', () => {
    expect(getPageTitle('/unknown')).toBe('Kitcha');
    expect(getPageTitle(null)).toBe('Kitcha');
  });
});
