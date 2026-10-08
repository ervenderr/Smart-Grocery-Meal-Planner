/** Attribution shown by the UI next to every lookup result. */

export interface Attribution {
  readonly name: string;
  readonly url: string;
  readonly license: string;
  readonly note: string;
}

export const OFF_ATTRIBUTION: Attribution = Object.freeze({
  name: 'Open Food Facts',
  url: 'https://world.openfoodfacts.org',
  license: 'ODbL',
  note: 'Contains information from Open Food Facts, made available under the Open Database License (ODbL). Images CC BY-SA.',
});

export const USDA_ATTRIBUTION: Attribution = Object.freeze({
  name: 'USDA FoodData Central',
  url: 'https://fdc.nal.usda.gov',
  license: 'CC0',
  note: 'Source: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.',
});
