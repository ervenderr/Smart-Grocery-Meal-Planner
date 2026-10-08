import {
  buildForbiddenTerms,
  normalizeRestrictions,
  partitionByRestrictions,
  violates,
} from "../src/modules/ai/dietary-filter";

const check = (restriction: string, texts: string[]): boolean =>
  violates(texts, buildForbiddenTerms([restriction]));

describe("normalizeRestrictions", () => {
  it("lowercases, trims, dedupes, sorts and merges lists", () => {
    expect(
      normalizeRestrictions(["Vegan ", "vegan"], undefined, ["Gluten-Free"]),
    ).toEqual(["gluten-free", "vegan"]);
  });

  it("collapses whitespace and drops empties", () => {
    expect(normalizeRestrictions(["  no   mushrooms ", "", "  "], null)).toEqual([
      "no mushrooms",
    ]);
  });
});

describe("violates (known tags)", () => {
  it.each([
    ["vegan", ["chicken breast"], true],
    ["vegan", ["Scrambled Eggs"], true],
    ["vegan", ["honey"], true],
    ["vegan", ["tofu", "rice"], false],
    ["vegetarian", ["beef stew"], true],
    ["vegetarian", ["gelatin"], true],
    ["vegetarian", ["egg", "cheese", "milk"], false],
    ["pescatarian", ["pork chop"], true],
    ["pescatarian", ["salmon fish"], false],
    ["gluten-free", ["whole wheat flour"], true],
    ["gluten-free", ["soy sauce"], true],
    ["gluten-free", ["noodles"], true],
    ["gluten-free", ["rice", "potato"], false],
    ["dairy-free", ["cheddar cheese"], true],
    ["dairy-free", ["peanut butter"], true],
    ["dairy-free", ["coconut milk water"], true],
    ["dairy-free", ["olive oil"], false],
    ["nut-free", ["roasted almonds"], true],
    ["nut-free", ["coconut"], false],
    ["peanut allergy", ["peanuts"], true],
    ["shellfish allergy", ["garlic shrimp"], true],
    ["shellfish allergy", ["grilled salmon"], false],
    ["egg-free", ["mayonnaise"], true],
    ["halal", ["bacon bits"], true],
    ["halal", ["chicken"], false],
    ["kosher", ["lobster tail"], true],
    ["kosher", ["beef"], false],
  ])("%s vs %j -> %s", (restriction, texts, expected) => {
    expect(check(restriction, texts)).toBe(expected);
  });
});

describe("free text restrictions", () => {
  it("derives meaningful tokens and drops stop words", () => {
    expect(buildForbiddenTerms(["no mushrooms"])).toContain("mushroom");
    expect(buildForbiddenTerms(["no mushrooms"])).not.toContain("no");
  });

  it("matches the free-text token in output", () => {
    expect(check("no mushrooms", ["sauteed mushrooms"])).toBe(true);
    expect(check("no mushrooms", ["sauteed onions"])).toBe(false);
  });

  it("returns no terms for empty restrictions", () => {
    expect(buildForbiddenTerms([])).toEqual([]);
    expect(violates(["chicken"], [])).toBe(false);
  });

  it("escapes regex metacharacters in free text", () => {
    expect(() => check("avoid (a+)+$", ["aaaa"])).not.toThrow();
  });
});

describe("partitionByRestrictions", () => {
  const recipes = Object.freeze([
    Object.freeze({ title: "Chicken curry", items: ["chicken", "rice"] }),
    Object.freeze({ title: "Veg stir fry", items: ["tofu", "broccoli"] }),
    Object.freeze({ title: "Lentil soup", items: ["lentils", "carrot"] }),
  ]);

  it("removes violating items without mutating input", () => {
    const snapshot = JSON.stringify(recipes);
    const result = partitionByRestrictions(
      recipes,
      (r) => [r.title, ...r.items],
      ["vegan"],
    );
    expect(result.kept).toHaveLength(2);
    expect(result.removedCount).toBe(1);
    expect(result.kept).not.toBe(recipes);
    expect(JSON.stringify(recipes)).toBe(snapshot);
  });

  it("keeps everything with empty restrictions", () => {
    const result = partitionByRestrictions(recipes, (r) => r.items, []);
    expect(result.kept).toHaveLength(3);
    expect(result.removedCount).toBe(0);
  });
});
