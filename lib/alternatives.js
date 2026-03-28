import { classifyProduct } from "./classify.js";
import { scoreAlternativePreview } from "./scoring.js";

function uniqueBy(values, getKey) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalizeCandidate(candidate, defaults = {}) {
  return {
    title: String(candidate.title || "").trim(),
    brand: String(candidate.brand || "").trim(),
    score: typeof candidate.score === "number" ? candidate.score : null,
    scoreLabel: String(candidate.scoreLabel || "").trim(),
    price: String(candidate.price || "").trim(),
    priceValue: typeof candidate.priceValue === "number" ? candidate.priceValue : null,
    currency: candidate.currency || defaults.currency || "USD",
    image: String(candidate.image || "").trim(),
    url: String(candidate.url || "").trim(),
    rating: typeof candidate.rating === "number" ? candidate.rating : null,
    categoryHints: candidate.categoryHints || defaults.categoryHints || [],
    claims: candidate.claims || [],
    sourceType: candidate.sourceType || defaults.sourceType || "candidate",
    sourceLabel: candidate.sourceLabel || defaults.sourceLabel || "Candidate pool",
    confidence: typeof candidate.confidence === "number" ? candidate.confidence : (defaults.confidence || 0.56),
    reasons: Array.isArray(candidate.reasons) ? candidate.reasons : [],
    category: candidate.category || defaults.category || "unknown",
    subcategory: candidate.subcategory || defaults.subcategory || "unknown"
  };
}

function buildModeRanks(candidate, currentProduct, classification, preferences) {
  const preview = scoreAlternativePreview(candidate, classification.category, preferences, classification.subcategory);
  const resolvedScore = typeof candidate.score === "number" ? candidate.score : preview.score;
  const sameSubcategory = candidate.subcategory !== "unknown" && candidate.subcategory === classification.subcategory;
  const sameCategory = candidate.category !== "unknown" && candidate.category === classification.category;
  const priceDelta = typeof candidate.priceValue === "number" && typeof currentProduct.priceValue === "number"
    ? Math.abs(candidate.priceValue - currentProduct.priceValue)
    : 999;

  return {
    ...preview,
    resolvedScore,
    healthierRank: resolvedScore + candidate.confidence * 12 + (sameSubcategory ? 12 : sameCategory ? 6 : 0),
    betterValueRank: resolvedScore * 0.7 + candidate.confidence * 8 + Math.max(0, 18 - Math.min(18, priceDelta)),
    closerMatchRank: resolvedScore + candidate.confidence * 10 + (sameSubcategory ? 14 : sameCategory ? 8 : 0) + (preview.preferenceFit || 0)
  };
}

function enhanceCandidate(candidate, currentProduct, classification, preferences) {
  const ranked = buildModeRanks(candidate, currentProduct, classification, preferences);
  const resolvedScore = ranked.resolvedScore;
  return {
    ...candidate,
    score: resolvedScore,
    scoreLabel: candidate.scoreLabel || ranked.scoreLabel,
    scoreTone: ranked.scoreTone,
    reasons: candidate.reasons.length ? candidate.reasons : ranked.reasons,
    modeRanks: {
      healthier: ranked.healthierRank,
      betterValue: ranked.betterValueRank,
      closerMatch: ranked.closerMatchRank
    }
  };
}

function sortByMode(candidates, mode) {
  return [...candidates].sort((left, right) => right.modeRanks[mode] - left.modeRanks[mode]);
}

export function buildAlternatives({ currentProduct, classification, preferences, history = [], relatedProducts = [], enrichmentCandidates = [] }) {
  const currentScore = typeof currentProduct.scoreValue === "number" ? currentProduct.scoreValue : null;
  const currentUrl = currentProduct.url;
  const rawCandidates = [
    ...relatedProducts.map((candidate) => normalizeCandidate(candidate, { sourceType: "retailer_related", sourceLabel: "Retailer page", confidence: 0.54, category: classification.category, subcategory: classification.subcategory })),
    ...enrichmentCandidates.map((candidate) => normalizeCandidate(candidate, { sourceType: candidate.sourceType || "source_search", sourceLabel: candidate.sourceLabel || "Source search", confidence: candidate.confidence || 0.62, category: classification.category })),
    ...history.filter((item) => item.url && item.url !== currentUrl).map((item) => normalizeCandidate({
      title: item.title,
      brand: item.brand,
      price: item.price,
      image: item.image,
      url: item.url,
      score: item.scoreValue,
      scoreLabel: item.scoreLabel,
      category: item.category,
      subcategory: item.subcategory,
      confidence: item.confidenceOverall,
      reasons: item.summary ? [item.summary] : []
    }, { sourceType: "history", sourceLabel: "Saved history", confidence: item.confidenceOverall || 0.72, category: item.category, subcategory: item.subcategory }))
  ];

  const filtered = uniqueBy(rawCandidates, (candidate) => candidate.url || candidate.title.toLowerCase())
    .filter((candidate) => candidate.title && candidate.url && candidate.url !== currentUrl)
    .map((candidate) => {
      const previewClassification = classifyProduct({
        ...currentProduct,
        title: candidate.title,
        brand: candidate.brand,
        claims: candidate.claims,
        categoryHints: candidate.categoryHints,
        ingredientsText: "",
        nutritionText: "",
        nutrition: null,
        ingredients: []
      });
      return enhanceCandidate({ ...candidate, category: candidate.category === "unknown" ? previewClassification.category : candidate.category, subcategory: candidate.subcategory === "unknown" ? previewClassification.subcategory : candidate.subcategory }, currentProduct, classification, preferences);
    })
    .filter((candidate) => candidate.category === classification.category)
    .filter((candidate) => currentScore == null || candidate.score > currentScore);

  const healthier = sortByMode(filtered, "healthier").slice(0, 3).map((item) => ({ ...item, modeLabel: "Healthier" }));
  const betterValue = sortByMode(filtered, "betterValue").slice(0, 3).map((item) => ({ ...item, modeLabel: "Better value" }));
  const closerMatch = sortByMode(filtered, "closerMatch").slice(0, 3).map((item) => ({ ...item, modeLabel: "Preference match" }));
  const primary = uniqueBy([...healthier, ...closerMatch, ...betterValue], (candidate) => candidate.url || candidate.title).slice(0, 3);

  return {
    primary,
    healthier,
    betterValue,
    closerMatch
  };
}
