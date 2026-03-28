function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBarcode(detailMap = {}) {
  const keys = Object.keys(detailMap);
  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (normalized.includes("upc") || normalized.includes("gtin") || normalized.includes("ean")) {
      const match = String(detailMap[key]).match(/\d{8,14}/);
      if (match) {
        return match[0];
      }
    }
  }
  return null;
}

function pickBestFoodFactsProduct(products, extraction) {
  if (!Array.isArray(products) || !products.length) {
    return null;
  }

  const targetTitle = normalizeText(extraction.title).toLowerCase();
  const targetBrand = normalizeText(extraction.brand).toLowerCase();

  const scored = products.map((product) => {
    let score = 0;
    const productName = normalizeText(product.product_name || product.product_name_en).toLowerCase();
    const brand = normalizeText(product.brands).toLowerCase();

    if (productName && targetTitle.includes(productName.slice(0, 18))) {
      score += 5;
    }
    if (targetBrand && brand && brand.includes(targetBrand)) {
      score += 4;
    }
    if (product.image_front_small_url || product.image_front_url) {
      score += 1;
    }
    if (product.ingredients_text) {
      score += 2;
    }
    if (product.nutriments) {
      score += 2;
    }

    return { product, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 4 ? scored[0].product : null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }
  return response.json();
}

function mapOpenFoodFacts(product) {
  if (!product) {
    return null;
  }

  const nutriments = product.nutriments || {};
  const sodiumValue = nutriments.sodium_serving ?? nutriments.sodium_100g ?? null;
  const sodiumMilligrams = typeof sodiumValue === "number" ? sodiumValue * 1000 : sodiumValue;

  return {
    sourceType: "open_food_facts",
    authorityWeight: 0.76,
    product: {
      title: product.product_name || product.product_name_en || null,
      brand: product.brands || null,
      image: product.image_front_url || null,
      ingredients: product.ingredients_text || null,
      nutrition: {
        calories: nutriments["energy-kcal_serving"] ?? nutriments["energy-kcal_100g"] ?? null,
        sugars: nutriments.sugars_serving ?? nutriments.sugars_100g ?? null,
        addedSugars: nutriments["added-sugars_serving"] ?? nutriments["added-sugars_100g"] ?? null,
        sodium: sodiumMilligrams,
        protein: nutriments.proteins_serving ?? nutriments.proteins_100g ?? null,
        fiber: nutriments.fiber_serving ?? nutriments.fiber_100g ?? null
      },
      tags: [
        ...(product.labels_tags || []).slice(0, 6),
        ...(product.categories_tags || []).slice(0, 6)
      ],
      url: product.url || null
    }
  };
}

function mapOpenBeautyFacts(product) {
  if (!product) {
    return null;
  }

  return {
    sourceType: "open_beauty_facts",
    authorityWeight: 0.7,
    product: {
      title: product.product_name || null,
      brand: product.brands || null,
      image: product.image_front_url || null,
      ingredients: product.ingredients_text || null,
      tags: [
        ...(product.labels_tags || []).slice(0, 6),
        ...(product.categories_tags || []).slice(0, 6)
      ],
      url: product.url || null
    }
  };
}

export async function enrichWithExternalSources(extraction) {
  const barcode = extraction.barcode || extractBarcode(extraction.detailMap);
  const enrichments = [];
  const warnings = [];

  if (extraction.category === "food") {
    try {
      if (barcode) {
        const byCode = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        if (byCode.status === 1 && byCode.product) {
          enrichments.push(mapOpenFoodFacts(byCode.product));
        }
      }

      if (!enrichments.length && extraction.title) {
        const search = encodeURIComponent(`${extraction.brand || ""} ${extraction.title}`.trim());
        const searchResult = await fetchJson(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${search}&search_simple=1&action=process&json=1&page_size=5`);
        const best = pickBestFoodFactsProduct(searchResult.products, extraction);
        if (best) {
          enrichments.push(mapOpenFoodFacts(best));
        }
      }
    } catch (error) {
      warnings.push("Open Food Facts lookup was unavailable.");
    }
  }

  if (extraction.category === "skincare" && barcode) {
    try {
      const byCode = await fetchJson(`https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`);
      if (byCode.status === 1 && byCode.product) {
        enrichments.push(mapOpenBeautyFacts(byCode.product));
      }
    } catch (error) {
      warnings.push("Open Beauty Facts lookup was unavailable.");
    }
  }

  return {
    barcode,
    enrichments: enrichments.filter(Boolean),
    warnings
  };
}
