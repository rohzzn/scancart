function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function hasAny(text, values) {
  return values.some((value) => text.includes(value));
}

const CATEGORY_RULES = {
  food: ["snack", "protein bar", "bar", "chips", "cracker", "cookie", "granola", "cereal", "drink", "beverage", "soda", "juice", "sauce", "pasta", "food"],
  skincare: ["cleanser", "moisturizer", "serum", "sunscreen", "cream", "lotion", "toner", "face wash", "skincare", "mask"],
  supplements: ["supplement", "vitamin", "capsule", "tablet", "gummy", "preworkout", "whey", "protein powder", "electrolyte", "amino"],
  eco_cleaning: ["detergent", "dish soap", "surface cleaner", "all purpose cleaner", "laundry", "cleaner spray", "cleaning", "disinfectant"]
};

const SUBCATEGORY_RULES = {
  food: {
    snack: ["snack", "chips", "cracker", "cookie"],
    cereal: ["cereal", "granola", "oats"],
    protein_bar: ["protein bar", "bar"],
    beverage: ["drink", "beverage", "shake", "soda", "juice"],
    sauce: ["sauce", "dressing", "marinade"]
  },
  skincare: {
    cleanser: ["cleanser", "face wash", "cleansing"],
    moisturizer: ["moisturizer", "cream", "lotion", "gel cream"],
    serum: ["serum", "ampoule", "essence"],
    sunscreen: ["sunscreen", "spf", "sun screen"]
  },
  supplements: {
    protein: ["whey", "protein powder", "protein shake", "protein"],
    vitamin: ["vitamin", "multivitamin", "mineral"],
    preworkout: ["preworkout", "pre-workout"],
    gummy: ["gummy", "gummies"]
  },
  eco_cleaning: {
    detergent: ["detergent", "laundry"],
    dish_soap: ["dish soap", "dishwashing"],
    spray: ["spray", "mist"],
    surface_cleaner: ["surface cleaner", "all purpose cleaner", "multi-surface"]
  }
};

export function classifyProduct(product, enrichmentSources = []) {
  const searchText = [
    product.title,
    product.brand,
    ...(product.categoryHints || []),
    ...(product.claims || []),
    product.ingredientsText,
    product.nutritionText,
    ...enrichmentSources.flatMap((source) => source.fields?.categoryHints || [])
  ].join(" ").toLowerCase();

  const reasons = [];
  const scores = {
    food: 0,
    skincare: 0,
    supplements: 0,
    eco_cleaning: 0,
    unknown: 0
  };

  if (product.nutrition && Object.keys(product.nutrition).length) {
    scores.food += 3;
    reasons.push("Nutrition facts were detected.");
  }

  if (product.ingredients?.length) {
    const ingredientText = product.ingredients.map((item) => item.canonicalName).join(" ");
    if (/niacinamide|ceramide|glycerin|panthenol|parfum|fragrance/.test(ingredientText)) {
      scores.skincare += 2;
      reasons.push("The ingredient list looks skincare-oriented.");
    }
    if (/vitamin|mineral|magnesium|creatine|whey protein|b12/.test(ingredientText)) {
      scores.supplements += 2;
      reasons.push("The ingredient list looks supplement-oriented.");
    }
    if (/sodium laureth sulfate|alkyl polyglucoside|lauramine oxide|quaternary ammonium|ammonia/.test(ingredientText)) {
      scores.eco_cleaning += 2;
      reasons.push("The ingredient list looks like a cleaning product formula.");
    }
  }

  Object.entries(CATEGORY_RULES).forEach(([category, keywords]) => {
    const hits = keywords.filter((keyword) => searchText.includes(keyword));
    if (hits.length) {
      scores[category] += hits.length;
      reasons.push(`${category.replace(/_/g, " ")} keywords matched: ${hits.slice(0, 3).join(", ")}.`);
    }
  });

  for (const source of enrichmentSources) {
    const sourceKey = String(source.sourceKey || "");
    if (sourceKey.includes("food")) {
      scores.food += 2;
    }
    if (sourceKey.includes("beauty")) {
      scores.skincare += 2;
    }
    if (sourceKey.includes("dsld")) {
      scores.supplements += 2;
    }
  }

  let category = "unknown";
  let bestScore = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (key === "unknown") {
      continue;
    }
    if (value > bestScore) {
      bestScore = value;
      category = key;
    }
  }

  if (bestScore < 2) {
    category = "unknown";
  }

  let subcategory = "unknown";
  const subcategoryRules = SUBCATEGORY_RULES[category] || {};
  for (const [key, keywords] of Object.entries(subcategoryRules)) {
    if (hasAny(searchText, keywords)) {
      subcategory = key;
      break;
    }
  }

  const confidence = category === "unknown"
    ? 0.34
    : Math.min(0.96, 0.48 + bestScore * 0.08 + (subcategory !== "unknown" ? 0.08 : 0));

  return {
    category,
    subcategory,
    confidence,
    reasons: [...new Set(reasons)].slice(0, 6)
  };
}
