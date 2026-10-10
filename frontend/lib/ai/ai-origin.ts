export const AI_GENERATED_TAG = 'AI Generated';

export function isAiGeneratedRecipe(tags: readonly string[] | undefined): boolean {
  if (!tags) return false;
  const target = AI_GENERATED_TAG.toLowerCase();
  return tags.some((tag) => tag.trim().toLowerCase() === target);
}
