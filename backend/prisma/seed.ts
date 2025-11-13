/**
 * Database Seed Script
 *
 * Seeds the database with sample recipes for testing and development.
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create a test user if not exists
  const testUserEmail = 'demo@example.com';
  let testUser = await prisma.user.findUnique({
    where: { email: testUserEmail },
  });

  if (!testUser) {
    const hashedPassword = await hashPassword('Demo1234!');
    testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        passwordHash: hashedPassword,
        firstName: 'Demo',
        lastName: 'User',
      },
    });
    console.log(`✓ Created test user: ${testUserEmail}`);

    // Create user preferences
    await prisma.userPreference.create({
      data: {
        userId: testUser.id,
        currency: 'USD',
        budgetPerWeekCents: 10000,
      },
    });
    console.log('✓ Created user preferences');
  } else {
    console.log(`✓ Test user already exists: ${testUserEmail}`);
  }

  // Sample recipes
  const recipes = [
    {
      title: 'Classic Scrambled Eggs',
      description:
        'Fluffy and creamy scrambled eggs perfect for a quick breakfast.',
      category: 'breakfast',
      difficulty: 'easy',
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      servings: 2,
      ingredientsList: [
        { ingredientName: 'eggs', quantity: 4, unit: 'pieces', notes: 'large' },
        { ingredientName: 'butter', quantity: 1, unit: 'tbsp' },
        { ingredientName: 'milk', quantity: 2, unit: 'tbsp' },
        { ingredientName: 'salt', quantity: 0.25, unit: 'tsp' },
        { ingredientName: 'pepper', quantity: 0.125, unit: 'tsp' },
      ],
      instructions: [
        'Crack eggs into a bowl and whisk with milk, salt, and pepper',
        'Melt butter in a non-stick pan over medium-low heat',
        'Pour in egg mixture and let sit for 20 seconds',
        'Gently stir with a spatula, creating large curds',
        'Remove from heat when eggs are still slightly wet',
        'Serve immediately',
      ],
      tags: ['quick', 'protein-rich', 'breakfast'],
      dietaryRestrictions: ['vegetarian'],
      isPublic: true,
    },
    {
      title: 'Mediterranean Quinoa Bowl',
      description:
        'A healthy and colorful bowl packed with vegetables and protein.',
      category: 'lunch',
      difficulty: 'easy',
      prepTimeMinutes: 15,
      cookTimeMinutes: 20,
      servings: 4,
      ingredientsList: [
        { ingredientName: 'quinoa', quantity: 1, unit: 'cups', notes: 'dry' },
        {
          ingredientName: 'cherry tomatoes',
          quantity: 2,
          unit: 'cups',
          notes: 'halved',
        },
        {
          ingredientName: 'cucumber',
          quantity: 1,
          unit: 'pieces',
          notes: 'diced',
        },
        {
          ingredientName: 'red onion',
          quantity: 0.5,
          unit: 'pieces',
          notes: 'diced',
        },
        { ingredientName: 'feta cheese', quantity: 1, unit: 'cups', notes: 'crumbled' },
        { ingredientName: 'olive oil', quantity: 3, unit: 'tbsp' },
        { ingredientName: 'lemon juice', quantity: 2, unit: 'tbsp' },
        { ingredientName: 'salt', quantity: 0.5, unit: 'tsp' },
        { ingredientName: 'pepper', quantity: 0.25, unit: 'tsp' },
      ],
      instructions: [
        'Cook quinoa according to package directions and let cool',
        'Dice cucumber and red onion',
        'Halve cherry tomatoes',
        'In a large bowl, combine quinoa, tomatoes, cucumber, and onion',
        'Add crumbled feta cheese',
        'Whisk together olive oil, lemon juice, salt, and pepper',
        'Pour dressing over salad and toss to combine',
        'Serve chilled or at room temperature',
      ],
      tags: ['healthy', 'vegetarian', 'meal-prep'],
      dietaryRestrictions: ['vegetarian'],
      isPublic: true,
    },
    {
      title: 'One-Pot Chicken and Rice',
      description:
        'A comforting one-pot meal with tender chicken and flavorful rice.',
      category: 'dinner',
      difficulty: 'medium',
      prepTimeMinutes: 10,
      cookTimeMinutes: 35,
      servings: 4,
      ingredientsList: [
        {
          ingredientName: 'chicken thighs',
          quantity: 1.5,
          unit: 'lbs',
          notes: 'bone-in, skin-on',
        },
        { ingredientName: 'white rice', quantity: 1.5, unit: 'cups', notes: 'long grain' },
        { ingredientName: 'chicken broth', quantity: 2.5, unit: 'cups' },
        { ingredientName: 'onion', quantity: 1, unit: 'pieces', notes: 'diced' },
        { ingredientName: 'garlic', quantity: 3, unit: 'pieces', notes: 'minced' },
        { ingredientName: 'olive oil', quantity: 2, unit: 'tbsp' },
        { ingredientName: 'paprika', quantity: 1, unit: 'tsp' },
        { ingredientName: 'salt', quantity: 1, unit: 'tsp' },
        { ingredientName: 'pepper', quantity: 0.5, unit: 'tsp' },
        { ingredientName: 'frozen peas', quantity: 1, unit: 'cups' },
      ],
      instructions: [
        'Season chicken thighs with salt, pepper, and paprika',
        'Heat olive oil in a large pot over medium-high heat',
        'Sear chicken skin-side down until golden, about 5 minutes',
        'Remove chicken and set aside',
        'Add onion to pot and cook until softened, 3-4 minutes',
        'Add garlic and cook for 1 minute',
        'Add rice and stir to coat with oil',
        'Pour in chicken broth and bring to a boil',
        'Return chicken to pot, reduce heat to low',
        'Cover and simmer for 25 minutes',
        'Stir in frozen peas and cook 5 more minutes',
        'Let rest 5 minutes before serving',
      ],
      tags: ['one-pot', 'comfort-food', 'family-friendly'],
      dietaryRestrictions: [],
      isPublic: true,
    },
    {
      title: 'Vegan Black Bean Tacos',
      description:
        'Delicious plant-based tacos loaded with seasoned black beans and fresh toppings.',
      category: 'dinner',
      difficulty: 'easy',
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 4,
      ingredientsList: [
        {
          ingredientName: 'black beans',
          quantity: 2,
          unit: 'cups',
          notes: 'cooked or canned',
        },
        { ingredientName: 'corn tortillas', quantity: 8, unit: 'pieces' },
        { ingredientName: 'avocado', quantity: 2, unit: 'pieces', notes: 'sliced' },
        {
          ingredientName: 'cherry tomatoes',
          quantity: 1,
          unit: 'cups',
          notes: 'diced',
        },
        { ingredientName: 'red cabbage', quantity: 2, unit: 'cups', notes: 'shredded' },
        { ingredientName: 'lime', quantity: 1, unit: 'pieces', notes: 'cut into wedges' },
        { ingredientName: 'cumin', quantity: 1, unit: 'tsp' },
        { ingredientName: 'chili powder', quantity: 1, unit: 'tsp' },
        { ingredientName: 'garlic powder', quantity: 0.5, unit: 'tsp' },
        { ingredientName: 'salt', quantity: 0.5, unit: 'tsp' },
      ],
      instructions: [
        'Heat black beans in a pan with cumin, chili powder, garlic powder, and salt',
        'Mash beans slightly with a fork while heating',
        'Warm tortillas in a dry skillet or microwave',
        'Prepare toppings: slice avocado, dice tomatoes, shred cabbage',
        'Fill each tortilla with seasoned black beans',
        'Top with avocado, tomatoes, and cabbage',
        'Serve with lime wedges',
        'Squeeze lime juice over tacos before eating',
      ],
      tags: ['vegan', 'quick', 'mexican'],
      dietaryRestrictions: ['vegan', 'vegetarian', 'dairy_free'],
      isPublic: true,
    },
    {
      title: 'Homemade Chocolate Chip Cookies',
      description: 'Classic chewy chocolate chip cookies that everyone loves.',
      category: 'dessert',
      difficulty: 'easy',
      prepTimeMinutes: 15,
      cookTimeMinutes: 12,
      servings: 24,
      ingredientsList: [
        { ingredientName: 'butter', quantity: 1, unit: 'cups', notes: 'softened' },
        { ingredientName: 'white sugar', quantity: 0.75, unit: 'cups' },
        { ingredientName: 'brown sugar', quantity: 0.75, unit: 'cups', notes: 'packed' },
        { ingredientName: 'eggs', quantity: 2, unit: 'pieces', notes: 'large' },
        { ingredientName: 'vanilla extract', quantity: 2, unit: 'tsp' },
        { ingredientName: 'all-purpose flour', quantity: 2.25, unit: 'cups' },
        { ingredientName: 'baking soda', quantity: 1, unit: 'tsp' },
        { ingredientName: 'salt', quantity: 1, unit: 'tsp' },
        { ingredientName: 'chocolate chips', quantity: 2, unit: 'cups' },
      ],
      instructions: [
        'Preheat oven to 375°F (190°C)',
        'Beat butter, white sugar, and brown sugar until creamy',
        'Add eggs and vanilla extract, beat well',
        'In a separate bowl, combine flour, baking soda, and salt',
        'Gradually add dry ingredients to butter mixture',
        'Fold in chocolate chips',
        'Drop rounded tablespoons of dough onto ungreased baking sheets',
        'Bake for 9-11 minutes until golden brown',
        'Cool on baking sheet for 2 minutes',
        'Transfer to wire rack to cool completely',
      ],
      tags: ['dessert', 'baking', 'classic'],
      dietaryRestrictions: ['vegetarian'],
      isPublic: true,
    },
    {
      title: 'Green Smoothie Bowl',
      description:
        'A nutrient-packed smoothie bowl perfect for a healthy breakfast or snack.',
      category: 'breakfast',
      difficulty: 'easy',
      prepTimeMinutes: 10,
      cookTimeMinutes: 0,
      servings: 2,
      ingredientsList: [
        { ingredientName: 'frozen banana', quantity: 2, unit: 'pieces' },
        { ingredientName: 'frozen mango', quantity: 1, unit: 'cups' },
        { ingredientName: 'spinach', quantity: 2, unit: 'cups', notes: 'fresh' },
        { ingredientName: 'almond milk', quantity: 0.5, unit: 'cups' },
        { ingredientName: 'chia seeds', quantity: 1, unit: 'tbsp' },
        { ingredientName: 'honey', quantity: 1, unit: 'tbsp', notes: 'optional' },
        { ingredientName: 'granola', quantity: 0.25, unit: 'cups', notes: 'for topping' },
        {
          ingredientName: 'fresh berries',
          quantity: 0.5,
          unit: 'cups',
          notes: 'for topping',
        },
      ],
      instructions: [
        'Add frozen banana, mango, spinach, and almond milk to blender',
        'Add chia seeds and honey if using',
        'Blend until smooth and creamy',
        'Pour into bowls',
        'Top with granola and fresh berries',
        'Serve immediately',
      ],
      tags: ['healthy', 'quick', 'no-cook'],
      dietaryRestrictions: ['vegetarian', 'vegan'],
      isPublic: true,
    },
  ];

  // Seed recipes
  console.log('\nSeeding recipes...');
  for (const recipeData of recipes) {
    const existing = await prisma.recipe.findFirst({
      where: {
        title: recipeData.title,
        userId: testUser.id,
      },
    });

    if (!existing) {
      await prisma.recipe.create({
        data: {
          ...recipeData,
          userId: testUser.id,
        },
      });
      console.log(`✓ Created recipe: ${recipeData.title}`);
    } else {
      console.log(`- Recipe already exists: ${recipeData.title}`);
    }
  }

  console.log('\n✅ Database seeded successfully!');
  console.log(`\nTest user credentials:`);
  console.log(`Email: ${testUserEmail}`);
  console.log(`Password: Demo1234!`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
