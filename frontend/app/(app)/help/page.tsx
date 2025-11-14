'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Book, Lightbulb, Mail, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type FAQItem = {
  question: string;
  answer: string;
  category: 'getting-started' | 'pantry' | 'recipes' | 'meal-plans' | 'shopping' | 'budget' | 'ai';
};

const faqs: FAQItem[] = [
  // Getting Started
  {
    question: 'How do I get started with Kitcha?',
    answer: 'Start by adding items to your pantry. Go to the Pantry page and click "Add Item" to track what you already have at home. This helps the AI suggest recipes based on available ingredients and prevents duplicate purchases.',
    category: 'getting-started',
  },
  {
    question: 'What is the recommended workflow?',
    answer: '1. Add items to your Pantry, 2. Browse or create Recipes, 3. Use AI to generate Meal Plans, 4. Create Shopping Lists for missing ingredients, 5. Track your spending in Budget to stay within limits.',
    category: 'getting-started',
  },

  // Pantry
  {
    question: 'How do I manage my pantry items?',
    answer: 'Navigate to the Pantry page to add, edit, or remove items. You can set quantities, categories, and expiry dates. Items nearing expiration will be highlighted so you can use them before they spoil.',
    category: 'pantry',
  },
  {
    question: 'Can I track expiry dates?',
    answer: 'Yes! When adding or editing pantry items, you can set an expiry date. The system will show warnings for items expiring soon, helping you reduce food waste.',
    category: 'pantry',
  },

  // Recipes
  {
    question: 'How do I create a recipe?',
    answer: 'Go to the Recipes page and click "Create Recipe". Fill in the recipe name, description, ingredients, instructions, and cooking details. You can also specify difficulty level and dietary restrictions.',
    category: 'recipes',
  },
  {
    question: 'Can I get AI recipe suggestions?',
    answer: 'Absolutely! On the Recipes page, click "AI Suggestions". The AI will analyze your pantry items and suggest recipes you can make with what you have, complete with match percentages.',
    category: 'recipes',
  },
  {
    question: 'How do I save recipes from AI suggestions?',
    answer: 'When viewing AI-suggested recipes, click the "Save Recipe" button on any suggestion. The recipe will be added to your recipe collection for future use.',
    category: 'recipes',
  },

  // Meal Plans
  {
    question: 'What are meal plans and how do I create them?',
    answer: 'Meal plans help you organize meals for multiple days. You can create them manually by selecting recipes for each day, or use the AI Generator to create complete meal plans based on your budget and dietary preferences.',
    category: 'meal-plans',
  },
  {
    question: 'How does the AI meal plan generator work?',
    answer: 'The AI Generator creates a complete meal plan based on your budget, number of days, dietary restrictions, and available pantry items. It suggests breakfast, lunch, and dinner options that fit your criteria.',
    category: 'meal-plans',
  },
  {
    question: 'Can I edit AI-generated meal plans?',
    answer: 'Yes! Once an AI meal plan is generated, you can save it and then edit individual meals, swap recipes, or adjust serving sizes to better fit your needs.',
    category: 'meal-plans',
  },

  // Shopping Lists
  {
    question: 'How do shopping lists work?',
    answer: 'Shopping lists are generated from your meal plans. When viewing a meal plan, click "Generate Shopping List" to create a list of ingredients you need to buy. The system automatically excludes items you already have in your pantry.',
    category: 'shopping',
  },
  {
    question: 'Can I get AI substitution suggestions?',
    answer: 'Yes! When viewing a shopping list, you can use the AI Substitution feature to find cheaper or available alternatives for expensive or out-of-stock ingredients.',
    category: 'shopping',
  },
  {
    question: 'How are shopping list quantities calculated?',
    answer: 'Quantities are calculated based on recipe servings and adjusted for the number of people in your meal plan. Items are grouped by category for easier shopping.',
    category: 'shopping',
  },

  // Budget
  {
    question: 'How do I set my budget?',
    answer: 'Go to Settings > Preferences and adjust your weekly budget using the slider. You can set amounts from ₱100 to ₱10,000 per week.',
    category: 'budget',
  },
  {
    question: 'How does budget tracking work?',
    answer: 'The Budget page shows your weekly spending based on shopping lists and meal plans. You can see percentage used, remaining budget, and spending by category.',
    category: 'budget',
  },
  {
    question: 'What are budget alerts?',
    answer: 'Budget alerts notify you when you approach your spending limit. You can enable them and set a threshold (e.g., 90%) in Settings > Preferences.',
    category: 'budget',
  },

  // AI Features
  {
    question: 'What AI features are available?',
    answer: 'Kitcha offers three AI features: 1) Recipe Suggestions from your pantry items, 2) Meal Plan Generation based on budget and preferences, 3) Ingredient Substitution suggestions for shopping lists.',
    category: 'ai',
  },
  {
    question: 'Why do AI requests take time?',
    answer: 'AI generation requires processing by Google Gemini AI, which can take 30-60 seconds depending on the complexity. We show a loading indicator while the AI works on your request.',
    category: 'ai',
  },
  {
    question: 'Are AI suggestions always accurate?',
    answer: 'AI suggestions are generated based on common recipes and nutritional data. While generally reliable, always review suggestions for accuracy and adjust based on your preferences and dietary needs.',
    category: 'ai',
  },
];

const categories = [
  { id: 'getting-started', name: 'Getting Started', icon: Lightbulb },
  { id: 'pantry', name: 'Pantry Management', icon: Book },
  { id: 'recipes', name: 'Recipes', icon: Book },
  { id: 'meal-plans', name: 'Meal Plans', icon: Book },
  { id: 'shopping', name: 'Shopping Lists', icon: Book },
  { id: 'budget', name: 'Budget Tracking', icon: Book },
  { id: 'ai', name: 'AI Features', icon: Book },
];

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<string>('getting-started');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const filteredFaqs = faqs.filter(faq => faq.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Help & Support</h1>
        <p className="mt-1 text-sm text-gray-600">
          Find answers to common questions and learn how to use Kitcha
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary-100 p-2">
              <Book className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Documentation</h3>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive guides and tutorials
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Community</h3>
              <p className="text-sm text-gray-600 mt-1">
                Connect with other users
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Contact Support</h3>
              <p className="text-sm text-gray-600 mt-1">
                Get help from our team
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Category Sidebar */}
        <Card className="p-4 lg:col-span-1 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Categories</h2>
          <nav className="space-y-1">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  {category.name}
                </button>
              );
            })}
          </nav>
        </Card>

        {/* FAQ Content */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <HelpCircle className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {filteredFaqs.map((faq, index) => {
                const isExpanded = expandedItems.has(index);

                return (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900 pr-4">
                        {faq.question}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 text-sm text-gray-600 border-t border-gray-100">
                        <p className="pt-3">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-12">
                <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No FAQs available for this category</p>
              </div>
            )}
          </Card>

          {/* Additional Help */}
          <Card className="p-6 mt-4 bg-primary-50 border-primary-200">
            <h3 className="font-semibold text-primary-900 mb-2">Still need help?</h3>
            <p className="text-sm text-primary-700 mb-4">
              Can't find the answer you're looking for? Our support team is here to help.
            </p>
            <Button variant="outline" className="border-primary-300 text-primary-700 hover:bg-primary-100">
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
