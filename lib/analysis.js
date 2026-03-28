import { scoreAlternativePreview, scoreFood, scoreSkincare, scoreUnknown } from "./scoring.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(values) {
  if (!values) {
    return [];
  }
  if (Array.isArray(values)) {
    return values.map((item) => normalizeText(item)).filter(Boolean);
  }
  return String(values)
    .split(/\n|,|;/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferCategory(extraction) {
  const joined = [
    extraction.category,
    extraction.title,
    extraction.brand,
    ...(extraction.breadcrumbs || []),
    ...(extraction.bullets || [])
  ].join(" ").toLowerCase();

  const skincareWords = ["serum", "cleanser", "moisturizer", "cream", "lotion", "skincare", "sunscreen", "face wash", "toner", "mask"];
  const foodWords = ["snack", "protein", "bar", "drink", "cereal", "chips", "cookie", "food", "nutrition", "beverage", "granola"];

  if (skincareWords.some((word) => joined.includes(word))) {
    return "skincare";
  }
  if (foodWords.some((word) => joined.includes(word))) {
    return "food";
  }
  return "unknown";
}

function buildSourceRecords(extraction, enrichmentResult) {
  const records = [];

  records.push({
    sourceType: "amazon_dom",
    authorityWeight: 0.62,
    fields: {
      title: Boolean(extraction.title),
      brand: Boolean(extraction.brand),
      ingredients: Boolean(extraction.ingredients),
      nutrition: Boolean(extraction.nutrition && Object.keys(extraction.nutrition).length),
      price: Boolean(extraction.price),
      image: Boolean(extraction.image),
      claims: Boolean(extraction.claims?.length)
    },
    payload: {
      title: extraction.title,
      brand: extraction.brand,
      ingredients: extraction.ingredients,
      nutrition: extraction.nutrition,
      price: extraction.price,
      image: extraction.image,
      claims: extraction.claims
    }
  });

  if (extraction.structuredProduct) {
    records.push({
      sourceType: "amazon_jsonld",
      authorityWeight: 0.68,
      fields: {
        title: Boolean(extraction.structuredProduct.name),
        brand: Boolean(extraction.structuredProduct.brand),
        image: Boolean(extraction.structuredProduct.image),
        rating: Boolean(extraction.structuredProduct.aggregateRating)
      },
      payload: {
        title: extraction.structuredProduct.name,
        brand: extraction.structuredProduct.brand?.name || extraction.structuredProduct.brand,
        image: Array.isArray(extraction.structuredProduct.image) ? extraction.structuredProduct.image[0] : extraction.structuredProduct.image
      }
    });
  }

  for (const enrichment of enrichmentResult.enrichments || []) {
    records.push({
      sourceType: enrichment.sourceType,
      authorityWeight: enrichment.authorityWeight,
      fields: {
        title: Boolean(enrichment.product?.title),
        brand: Boolean(enrichment.product?.brand),
        ingredients: Boolean(enrichment.product?.ingredients),
        nutrition: Boolean(enrichment.product?.nutrition && Object.keys(enrichment.product.nutrition).length),
        image: Boolean(enrichment.product?.image),
        claims: Boolean(enrichment.product?.tags?.length)
      },
      payload: enrichment.product
    });
  }

  return records;
}

function chooseField(records, fieldName) {
  const candidates = records
    .filter((record) => record.payload?.[fieldName] != null && record.payload?.[fieldName] !== "")
    .sort((left, right) => right.authorityWeight - left.authorityWeight);

  if (!candidates.length) {
    return {
      value: null,
      confidence: 0,
      sourceType: null,
      supportCount: 0
    };
  }

  const winner = candidates[0];
  const winnerValue = fieldName === "claims"
    ? unique(normalizeList(winner.payload[fieldName]))
    : winner.payload[fieldName];
  const supportCount = candidates.filter((candidate) => {
    if (fieldName === "claims") {
      return normalizeList(candidate.payload[fieldName]).length > 0;
    }
    return normalizeText(candidate.payload[fieldName]).toLowerCase() === normalizeText(winner.payload[fieldName]).toLowerCase();
  }).length;

  let confidence = winner.authorityWeight + Math.min(0.18, (supportCount - 1) * 0.08);
  confidence = Math.min(0.96, confidence);

  return {
    value: winnerValue,
    confidence,
    sourceType: winner.sourceType,
    supportCount
  };
}

function mergeNutrition(extractionNutrition, records) {
  const merged = { ...(extractionNutrition || {}) };
  let sourceType = extractionNutrition && Object.keys(extractionNutrition).length ? "amazon_dom" : null;
  let confidence = extractionNutrition && Object.keys(extractionNutrition).length ? 0.58 : 0;

  for (const record of records.sort((left, right) => right.authorityWeight - left.authorityWeight)) {
    const nutrition = record.payload?.nutrition;
    if (nutrition && Object.keys(nutrition).length) {
      sourceType = record.sourceType;
      confidence = Math.max(confidence, Math.min(0.92, record.authorityWeight + 0.1));
      for (const [key, value] of Object.entries(nutrition)) {
        if (value != null && value !== "") {
          merged[key] = value;
        }
      }
      break;
    }
  }

  return {
    value: Object.keys(merged).length ? merged : null,
    confidence,
    sourceType
  };
}

function computeConfidence(category, mergedFields, sourceCount) {
  const identity = Math.min(0.96, (
    (mergedFields.title.confidence || 0) * 0.45 +
    (mergedFields.brand.confidence || 0) * 0.25 +
    (mergedFields.barcode ? 0.2 : 0) +
    Math.min(0.1, sourceCount * 0.04)
  ));

  const ingredients = mergedFields.ingredients.confidence || 0;
  const nutrition = mergedFields.nutrition.confidence || 0;
  const sourceCoverage = Math.min(0.96, 0.45 + sourceCount * 0.12);
  const sourceAgreement = Math.min(0.92, (
    (mergedFields.title.supportCount || 1) * 0.12 +
    (mergedFields.brand.supportCount || 1) * 0.1 +
    (mergedFields.ingredients.value ? 0.2 : 0) +
    (mergedFields.nutrition.value ? 0.2 : 0)
  ));

  let overall = 0.34 * identity + 0.22 * sourceCoverage + 0.18 * sourceAgreement;

  if (category === "skincare") {
    overall += 0.26 * ingredients;
  } else if (category === "food") {
    overall += 0.16 * ingredients + 0.1 * nutrition;
  } else {
    overall += 0.16 * ingredients;
  }

  return {
    overall: Math.min(0.96, overall),
    identity,
    ingredients,
    nutrition,
    sourceCoverage,
    sourceAgreement
  };
}

function summarizeSources(records, mergedFields) {
  return records.map((record) => ({
    sourceType: record.sourceType,
    authorityWeight: record.authorityWeight,
    fields: Object.keys(record.fields).filter((key) => record.fields[key]),
    selectedFor: Object.entries(mergedFields)
      .filter(([, value]) => value.sourceType === record.sourceType)
      .map(([key]) => key)
  }));
}

function buildWarnings(extraction, enrichmentWarnings, confidence, category) {
  const warnings = [...(enrichmentWarnings || [])];

  if (!extraction.ingredients) {
    warnings.push("Ingredient data was only partially available from the retailer page.");
  }
  if (category === "food" && !extraction.nutrition) {
    warnings.push("Nutrition data may be incomplete unless a supporting source was found.");
  }
  if (confidence.overall < 0.65) {
    warnings.push("This analysis has limited confidence, so strong claims are intentionally avoided.");
  }

  return unique(warnings);
}

function buildProductSnapshot(mergedFields, extraction, category) {
  return {
    title: normalizeText(mergedFields.title.value || extraction.title || "Unknown product"),
    brand: normalizeText(mergedFields.brand.value || extraction.brand || ""),
    category,
    ingredients: mergedFields.ingredients.value || extraction.ingredients || "",
    nutrition: mergedFields.nutrition.value || extraction.nutrition || null,
    price: mergedFields.price.value || extraction.price || "",
    image: mergedFields.image.value || extraction.image || "",
    claims: mergedFields.claims.value || extraction.claims || [],
    url: extraction.url,
    asin: extraction.asin || null,
    rating: extraction.rating || "",
    reviewCount: extraction.reviewCount || ""
  };
}

function makeCacheKey(extraction, product) {
  return extraction.asin
    ? `amazon:${extraction.asin}`
    : `${product.category}:${product.brand}:${product.title}`.toLowerCase();
}

function buildAlternatives(extraction, history, analysis, preferences) {
  const candidates = [];
  const seen = new Set();
  const currentUrl = extraction.url;

  for (const item of extraction.relatedProducts || []) {
    if (!item.url || item.url === currentUrl || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    const preview = scoreAlternativePreview(item, analysis.product.category, preferences);
    candidates.push({
      type: "preview",
      title: item.title,
      image: item.image,
      price: item.price,
      url: item.url,
      score: preview.score,
      scoreLabel: preview.scoreLabel,
      scoreTone: preview.scoreTone,
      reasons: preview.reasons.length ? preview.reasons : ["Looks like a potentially better fit based on title, pricing, and related-product placement."],
      confidence: 0.55
    });
  }

  for (const item of history || []) {
    if (item.cacheKey === analysis.cacheKey || item.category !== analysis.product.category || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    candidates.push({
      type: "history",
      title: item.title,
      image: item.image,
      price: item.price,
      url: item.url,
      score: item.scoreValue,
      scoreLabel: item.scoreLabel,
      scoreTone: item.scoreTone || "good",
      reasons: item.summary ? [item.summary] : ["Previously analyzed by ScanCart with stronger confidence."],
      confidence: item.confidenceOverall || 0.8
    });
  }

  candidates.sort((left, right) => {
    const leftRank = left.score + left.confidence * 10;
    const rightRank = right.score + right.confidence * 10;
    return rightRank - leftRank;
  });

  return candidates.slice(0, 3);
}

export function buildAnalysisResult(extraction, enrichmentResult, preferences, history) {
  const category = extraction.category && extraction.category !== "unknown" ? extraction.category : inferCategory(extraction);
  const records = buildSourceRecords({ ...extraction, category }, enrichmentResult);
  const mergedFields = {
    title: chooseField(records, "title"),
    brand: chooseField(records, "brand"),
    ingredients: chooseField(records, "ingredients"),
    price: chooseField(records, "price"),
    image: chooseField(records, "image"),
    claims: chooseField(records, "claims"),
    nutrition: mergeNutrition(extraction.nutrition, records),
    barcode: enrichmentResult.barcode || extraction.barcode || null
  };

  const confidence = computeConfidence(category, mergedFields, records.length);
  const product = buildProductSnapshot(mergedFields, extraction, category);

  let scored;
  if (category === "skincare") {
    scored = scoreSkincare(product, preferences);
  } else if (category === "food") {
    scored = scoreFood(product, preferences);
  } else {
    scored = scoreUnknown(product);
  }

  let adjustedScore = scored.score;
  if (confidence.overall < 0.55) {
    adjustedScore = Math.min(adjustedScore, 74);
  }

  const score = {
    value: adjustedScore,
    label: adjustedScore === scored.score ? scored.scoreLabel : (adjustedScore >= 60 ? "Fair" : scored.scoreLabel),
    tone: adjustedScore === scored.score ? scored.scoreTone : "fair",
    components: scored.components
  };

  const warnings = buildWarnings(extraction, enrichmentResult.warnings, confidence, category);
  const analysis = {
    cacheKey: makeCacheKey(extraction, product),
    product,
    score,
    confidence,
    tags: unique(scored.tags),
    flags: scored.flags,
    benefits: scored.benefits,
    preferenceHits: scored.preferenceHits,
    warnings,
    sources: summarizeSources(records, mergedFields),
    extractionMeta: {
      retailer: "Amazon",
      asin: extraction.asin || null
    }
  };

  analysis.alternatives = buildAlternatives(extraction, history, analysis, preferences);
  return analysis;
}
