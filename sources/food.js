function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildOffBaseUrl(settings) {
  return String(settings.openFoodFactsBaseUrl || "https://world.openfoodfacts.org").replace(/\/$/, "");
}

function buildUsdaBaseUrl(settings) {
  return String(settings.usdaApiBaseUrl || "https://api.nal.usda.gov/fdc/v1").replace(/\/$/, "");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function scoreFoodMatch(product, query) {
  const title = normalizeText(product.product_name || product.product_name_en).toLowerCase();
  const brand = normalizeText(product.brands).toLowerCase();
  let score = 0;

  if (title && query.title.includes(title.slice(0, 18))) {
    score += 5;
  }
  if (query.brand && brand && brand.includes(query.brand)) {
    score += 4;
  }
  if (product.ingredients_text) {
    score += 2;
  }
  if (product.nutriments) {
    score += 2;
  }
  if (product.image_front_url) {
    score += 1;
  }

  return score;
}

function mapOpenFoodFactsProduct(product, matchType) {
  if (!product) {
    return null;
  }

  const nutriments = product.nutriments || {};
  const sodiumValue = nutriments.sodium_serving ?? nutriments.sodium_100g ?? null;
  const sodiumMilligrams = typeof sodiumValue === "number" ? sodiumValue * 1000 : sodiumValue;
  const title = product.product_name || product.product_name_en || "";
  const brand = product.brands || "";

  return {
    source: {
      sourceKey: "open_food_facts",
      sourceLabel: "Open Food Facts",
      sourceType: "public_dataset",
      authority: matchType === "barcode" ? 0.86 : 0.76,
      trusted: true,
      matchSignals: {
        barcodeMatch: matchType === "barcode",
        titleBrandMatch: matchType !== "barcode"
      },
      fields: {
        title,
        brand,
        ingredients: product.ingredients_text || "",
        nutrition: {
          calories: nutriments["energy-kcal_serving"] ?? nutriments["energy-kcal_100g"] ?? null,
          sugars: nutriments.sugars_serving ?? nutriments.sugars_100g ?? null,
          addedSugars: nutriments["added-sugars_serving"] ?? nutriments["added-sugars_100g"] ?? null,
          sodium: sodiumMilligrams,
          protein: nutriments.proteins_serving ?? nutriments.proteins_100g ?? null,
          fiber: nutriments.fiber_serving ?? nutriments.fiber_100g ?? null
        },
        claims: [
          ...(product.labels_tags || []).slice(0, 6),
          ...(product.categories_tags || []).slice(0, 6)
        ],
        barcode: product.code || "",
        image: product.image_front_url || product.image_front_small_url || "",
        categoryHints: (product.categories_tags || []).slice(0, 6)
      },
      evidence: {
        matchType,
        url: product.url || ""
      }
    },
    candidate: {
      title,
      brand,
      image: product.image_front_url || product.image_front_small_url || "",
      url: product.url || "",
      price: "",
      sourceType: "open_food_facts_search",
      sourceLabel: "Open Food Facts",
      confidence: matchType === "barcode" ? 0.78 : 0.64,
      reasons: [matchType === "barcode" ? "Matched by barcode in Open Food Facts." : "Found a close public-database food match."],
      category: "food",
      claims: [
        ...(product.labels_tags || []).slice(0, 6),
        ...(product.categories_tags || []).slice(0, 6)
      ]
    }
  };
}

function mapUsdaFood(food) {
  if (!food) {
    return null;
  }

  const nutrientMap = {};
  for (const nutrient of food.foodNutrients || []) {
    const name = String(nutrient.nutrientName || nutrient.name || "").toLowerCase();
    if (name.includes("protein")) {
      nutrientMap.protein = nutrient.value;
    }
    if (name.includes("fiber")) {
      nutrientMap.fiber = nutrient.value;
    }
    if (name.includes("sugar")) {
      nutrientMap.sugars = nutrient.value;
    }
    if (name.includes("sodium")) {
      nutrientMap.sodium = nutrient.value;
    }
    if (name.includes("energy")) {
      nutrientMap.calories = nutrient.value;
    }
  }

  return {
    source: {
      sourceKey: "usda_fooddata_central",
      sourceLabel: "USDA FoodData Central",
      sourceType: "government_reference",
      authority: 0.82,
      trusted: true,
      matchSignals: {
        titleBrandMatch: true
      },
      fields: {
        title: food.description || "",
        brand: food.brandOwner || food.brandName || "",
        ingredients: food.ingredients || "",
        nutrition: nutrientMap,
        claims: [],
        barcode: food.gtinUpc || "",
        categoryHints: [food.foodCategory || "", food.dataType || ""].filter(Boolean)
      },
      evidence: {
        matchType: "search",
        fdcId: food.fdcId || null
      }
    },
    candidate: {
      title: food.description || "",
      brand: food.brandOwner || food.brandName || "",
      url: food.fdcId ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}` : "",
      price: "",
      image: "",
      sourceType: "usda_food_search",
      sourceLabel: "USDA FoodData Central",
      confidence: 0.66,
      reasons: ["Backed by USDA nutrition reference data."],
      category: "food"
    }
  };
}

export async function enrichFoodProduct(product, settings) {
  const sources = [];
  const candidates = [];
  const warnings = [];
  const baseUrl = buildOffBaseUrl(settings);
  const query = {
    title: normalizeText(product.title).toLowerCase(),
    brand: normalizeText(product.brand).toLowerCase()
  };

  try {
    if (product.barcode) {
      const byBarcode = await fetchJson(`${baseUrl}/api/v2/product/${encodeURIComponent(product.barcode)}.json`);
      if (byBarcode.status === 1 && byBarcode.product) {
        const mapped = mapOpenFoodFactsProduct(byBarcode.product, "barcode");
        if (mapped) {
          sources.push(mapped.source);
          candidates.push(mapped.candidate);
        }
      }
    }
  } catch (error) {
    warnings.push("Open Food Facts barcode lookup was unavailable.");
  }

  if (!sources.length) {
    try {
      const terms = encodeURIComponent(`${product.brand || ""} ${product.title}`.trim());
      const search = await fetchJson(`${baseUrl}/cgi/search.pl?search_terms=${terms}&search_simple=1&action=process&json=1&page_size=5`);
      const best = (search.products || [])
        .map((entry) => ({ product: entry, score: scoreFoodMatch(entry, query) }))
        .sort((left, right) => right.score - left.score)[0];
      if (best?.score >= 3) {
        const mapped = mapOpenFoodFactsProduct(best.product, "search");
        if (mapped) {
          sources.push(mapped.source);
        }
      }
      (search.products || []).slice(0, 4).forEach((entry) => {
        const mapped = mapOpenFoodFactsProduct(entry, "search");
        if (mapped?.candidate) {
          candidates.push(mapped.candidate);
        }
      });
    } catch (error) {
      warnings.push("Open Food Facts search was unavailable.");
    }
  }

  if (settings.usdaApiKey) {
    try {
      const usdaBaseUrl = buildUsdaBaseUrl(settings);
      const search = await fetchJson(`${usdaBaseUrl}/foods/search?api_key=${encodeURIComponent(settings.usdaApiKey)}&query=${encodeURIComponent(`${product.brand} ${product.title}`.trim())}&pageSize=4`);
      const foods = search.foods || [];
      if (foods.length) {
        const primary = mapUsdaFood(foods[0]);
        if (primary) {
          sources.push(primary.source);
        }
        foods.forEach((food) => {
          const mapped = mapUsdaFood(food);
          if (mapped?.candidate) {
            candidates.push(mapped.candidate);
          }
        });
      }
    } catch (error) {
      warnings.push("USDA FoodData Central lookup was unavailable.");
    }
  }

  return { sources, candidates, warnings };
}
