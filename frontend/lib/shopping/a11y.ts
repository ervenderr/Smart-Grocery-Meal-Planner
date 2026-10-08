/**
 * Accessible-name helpers (WCAG 2.5.3 Label in Name).
 * A control's accessible name must START with its visible text so voice-control
 * users can activate it by saying what they see.
 */

/** Visible chip text first, then the item it applies to: "Add price for Milk". */
export function priceChipLabel(visibleText: string, itemName: string): string {
  return `${visibleText} for ${itemName}`;
}

/**
 * Stable, state-independent name for an item checkbox. Checked state is
 * conveyed by aria-checked, so the label must never say "mark as ..." or
 * contradict it.
 */
export function itemCheckboxLabel(itemName: string): string {
  return itemName;
}
