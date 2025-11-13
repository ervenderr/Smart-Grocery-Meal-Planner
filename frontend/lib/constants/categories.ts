/**
 * Pantry Item Categories
 */
export const PANTRY_CATEGORIES = [
  { value: 'protein', label: 'Protein', icon: '🥩', color: 'bg-red-100 text-red-800' },
  { value: 'vegetable', label: 'Vegetables', icon: '🥦', color: 'bg-green-100 text-green-800' },
  { value: 'fruit', label: 'Fruits', icon: '🍎', color: 'bg-pink-100 text-pink-800' },
  { value: 'dairy', label: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-800' },
  { value: 'grains', label: 'Grains', icon: '🌾', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'spices', label: 'Spices', icon: '🌶️', color: 'bg-orange-100 text-orange-800' },
  { value: 'other', label: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-800' },
] as const;

/**
 * Storage Locations
 */
export const STORAGE_LOCATIONS = [
  { value: 'fridge', label: 'Refrigerator', icon: '❄️' },
  { value: 'freezer', label: 'Freezer', icon: '🧊' },
  { value: 'pantry', label: 'Pantry', icon: '🚪' },
  { value: 'counter', label: 'Counter', icon: '🏠' },
] as const;

/**
 * Dietary Restrictions
 */
export const DIETARY_RESTRICTIONS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { value: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { value: 'nut-free', label: 'Nut-Free', icon: '🥜' },
  { value: 'low-carb', label: 'Low-Carb', icon: '🥩' },
  { value: 'keto', label: 'Keto', icon: '🥓' },
] as const;

/**
 * Meal Types
 */
export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅', color: 'bg-amber-100 text-amber-800' },
  { value: 'lunch', label: 'Lunch', icon: '🌞', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'dinner', label: 'Dinner', icon: '🌙', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'snack', label: 'Snack', icon: '🍪', color: 'bg-purple-100 text-purple-800' },
] as const;

/**
 * Get category by value
 */
export function getCategoryByValue(value: string) {
  return PANTRY_CATEGORIES.find((cat) => cat.value === value) || PANTRY_CATEGORIES[6]; // default to 'other'
}

/**
 * Get storage location by value
 */
export function getStorageByValue(value: string) {
  return STORAGE_LOCATIONS.find((loc) => loc.value === value) || STORAGE_LOCATIONS[2]; // default to 'pantry'
}

/**
 * Get meal type by value
 */
export function getMealTypeByValue(value: string) {
  return MEAL_TYPES.find((type) => type.value === value) || MEAL_TYPES[0]; // default to 'breakfast'
}
