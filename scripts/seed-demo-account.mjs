#!/usr/bin/env node
/**
 * Adds sample data to an EXISTING Kitcha account through the public API.
 *
 *   EMAIL=you@example.com PASSWORD='your-password' node scripts/seed-demo-account.mjs
 *   (optional) API=https://kitcha-api-production.up.railway.app
 *
 * The password is read from the environment only; it is never stored or logged.
 * Safe to re-run: items whose names already exist are skipped.
 */

const API = process.env.API ?? 'https://kitcha-api-production.up.railway.app';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set EMAIL and PASSWORD in the environment.');
  process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

const PANTRY = [
  ['eggs', 12, 'pieces', 'protein', 3],
  ['milk', 1, 'liters', 'dairy', 2],
  ['spinach', 200, 'grams', 'vegetable', 1],
  ['chicken thighs', 1, 'kg', 'protein', 30],
  ['white rice', 2, 'kg', 'grains', null],
  ['olive oil', 500, 'ml', 'other', null],
  ['cherry tomatoes', 300, 'grams', 'vegetable', 5],
  ['black beans', 2, 'cups', 'grains', 365],
  ['garlic', 3, 'pieces', 'vegetable', 14],
  ['onions', 4, 'pieces', 'vegetable', 20],
  ['cheddar cheese', 250, 'grams', 'dairy', 10],
  ['bananas', 5, 'pieces', 'fruit', 2],
];

const RECIPES = [
  {
    name: 'Classic Scrambled Eggs',
    category: 'breakfast',
    difficulty: 'easy',
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    servings: 2,
    instructions: ['Whisk eggs with milk, salt and pepper.', 'Melt butter in a pan.', 'Stir gently until just set.'],
    ingredients: [
      { ingredientName: 'eggs', quantity: 4, unit: 'pieces' },
      { ingredientName: 'milk', quantity: 30, unit: 'ml' },
      { ingredientName: 'butter', quantity: 1, unit: 'tbsp' },
    ],
  },
  {
    name: 'One-Pot Chicken and Rice',
    category: 'dinner',
    difficulty: 'medium',
    prepTimeMinutes: 10,
    cookTimeMinutes: 35,
    servings: 4,
    instructions: ['Sear the chicken, set aside.', 'Toast rice, add broth, boil.', 'Return chicken, cover, simmer 25 minutes.'],
    ingredients: [
      { ingredientName: 'chicken thighs', quantity: 700, unit: 'grams' },
      { ingredientName: 'white rice', quantity: 300, unit: 'grams' },
      { ingredientName: 'chicken broth', quantity: 600, unit: 'ml' },
      { ingredientName: 'garlic', quantity: 2, unit: 'pieces' },
    ],
  },
  {
    name: 'Spinach and Tomato Rice Bowl',
    category: 'lunch',
    difficulty: 'easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    instructions: ['Saute spinach and halved tomatoes in olive oil.', 'Fold into warm rice and season.'],
    ingredients: [
      { ingredientName: 'white rice', quantity: 200, unit: 'grams' },
      { ingredientName: 'spinach', quantity: 150, unit: 'grams' },
      { ingredientName: 'cherry tomatoes', quantity: 150, unit: 'grams' },
      { ingredientName: 'olive oil', quantity: 1, unit: 'tbsp' },
    ],
  },
  {
    name: 'Black Bean Quesadillas',
    category: 'dinner',
    difficulty: 'easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    instructions: ['Mash beans with garlic.', 'Layer with cheese in tortillas.', 'Toast until golden.'],
    ingredients: [
      { ingredientName: 'black beans', quantity: 1, unit: 'cups' },
      { ingredientName: 'cheddar cheese', quantity: 150, unit: 'grams' },
      { ingredientName: 'garlic', quantity: 1, unit: 'pieces' },
      { ingredientName: 'tortillas', quantity: 4, unit: 'pieces' },
    ],
  },
  {
    name: 'Banana Pancakes',
    category: 'breakfast',
    difficulty: 'easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    instructions: ['Mash bananas, mix with eggs and flour.', 'Cook small pancakes on a hot pan.'],
    ingredients: [
      { ingredientName: 'bananas', quantity: 2, unit: 'pieces' },
      { ingredientName: 'eggs', quantity: 2, unit: 'pieces' },
      { ingredientName: 'flour', quantity: 100, unit: 'grams' },
    ],
  },
];

const SHOPPING = [
  ['butter', 1, 'pieces', 'dairy'],
  ['chicken broth', 1, 'l', 'other'],
  ['tortillas', 1, 'pieces', 'grains'],
  ['flour', 1, 'kg', 'grains'],
  ['lemons', 3, 'pieces', 'fruit'],
];

async function call(method, path, token, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const unwrap = (json) => json?.data ?? json;

async function main() {
  const login = await call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    console.error(`Login failed (HTTP ${login.status}). Check EMAIL and PASSWORD.`);
    process.exit(1);
  }
  const token = unwrap(login.json)?.token ?? login.json?.token;
  if (!token) {
    console.error('Login response had no token.');
    process.exit(1);
  }

  const have = await call('GET', '/pantry?limit=100', token);
  const pantryRows = unwrap(have.json);
  const existing = new Set(
    (Array.isArray(pantryRows) ? pantryRows : pantryRows?.items ?? []).map((i) =>
      String(i.ingredientName).toLowerCase(),
    ),
  );

  let pantryAdded = 0;
  for (const [ingredientName, quantity, unit, category, expiresIn] of PANTRY) {
    if (existing.has(ingredientName)) continue;
    const body = { ingredientName, quantity, unit, category };
    if (expiresIn !== null) body.expiryDate = isoDay(expiresIn);
    const r = await call('POST', '/pantry', token, body);
    if (r.status === 201) pantryAdded += 1;
    else console.warn(`pantry "${ingredientName}": HTTP ${r.status}`);
  }

  const recRes = await call('GET', '/recipes?limit=100', token);
  const recRows = unwrap(recRes.json);
  const recList = Array.isArray(recRows) ? recRows : recRows?.items ?? recRows?.recipes ?? [];
  const recipeIds = new Map(recList.map((r) => [String(r.name).toLowerCase(), r.id]));
  let recipesAdded = 0;
  for (const recipe of RECIPES) {
    if (recipeIds.has(recipe.name.toLowerCase())) continue;
    const r = await call('POST', '/recipes', token, recipe);
    if (r.status === 201) {
      recipesAdded += 1;
      recipeIds.set(recipe.name.toLowerCase(), unwrap(r.json)?.id);
    } else console.warn(`recipe "${recipe.name}": HTTP ${r.status}`);
  }

  const listRes = await call('GET', '/shopping/list', token);
  const listBody = unwrap(listRes.json);
  const listItems = listBody?.items ?? listBody?.list?.items ?? [];
  const onList = new Set(listItems.map((i) => String(i.itemName).toLowerCase()));

  let shoppingAdded = 0;
  for (const [itemName, quantity, unit, category] of SHOPPING) {
    if (onList.has(itemName)) continue;
    const r = await call('POST', '/shopping/items', token, { itemName, quantity, unit, category });
    if (r.status === 201 || r.status === 200) shoppingAdded += 1;
    else console.warn(`shopping "${itemName}": HTTP ${r.status}`);
  }

  const eggs = recipeIds.get('classic scrambled eggs');
  const chicken = recipeIds.get('one-pot chicken and rice');
  const pancakes = recipeIds.get('banana pancakes');
  const plansRes = await call('GET', '/mealplans?limit=100', token);
  const plansBody = unwrap(plansRes.json);
  const planList = Array.isArray(plansBody) ? plansBody : plansBody?.items ?? plansBody?.mealPlans ?? [];
  const hasPlan = planList.some((p) => String(p.name).toLowerCase() === 'demo week');
  let planAdded = 0;
  if (eggs && chicken && pancakes && !hasPlan) {
    const r = await call('POST', '/mealplans', token, {
      name: 'Demo week',
      startDate: isoDay(0),
      endDate: isoDay(6),
      meals: [
        { recipeId: eggs, dayOfWeek: 0, mealType: 'breakfast', servings: 2 },
        { recipeId: chicken, dayOfWeek: 0, mealType: 'dinner', servings: 4 },
        { recipeId: pancakes, dayOfWeek: 2, mealType: 'breakfast', servings: 2 },
        { recipeId: chicken, dayOfWeek: 4, mealType: 'dinner', servings: 4 },
      ],
    });
    if (r.status === 201) planAdded = 1;
    else console.warn(`meal plan: HTTP ${r.status}`);
  }

  console.log(
    `Done. Added pantry ${pantryAdded}, recipes ${recipesAdded}, shopping ${shoppingAdded}, meal plans ${planAdded}.`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
