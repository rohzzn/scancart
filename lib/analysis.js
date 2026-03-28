import { buildAlternatives } from "./alternatives.js";
import { classifyProduct } from "./classify.js";
import { mergeProductData } from "./merge.js";
import { normalizeProduct } from "./normalize.js";
import { scoreProduct } from "./scoring.js";
import { enrichProduct } from "../sources/router.js";

function buildWarnings({ normalizedProduct, classification, confidence, enrichment }) {
  const warnings = [...(enrichment?.warnings || []), ...(confidence.notes || [])];

  if (!normalizedProduct.ingredientsText && ["skincare", "supplements", "eco_cleaning"].includes(classification.category)) {
    warnings.push("Ingredient data was only partially available from the retailer page.");
  }
  if (!normalizedProduct.nutrition && classification.category === "food") {
    warnings.push("Nutrition data may be incomplete unless a supporting source was found.");
  }
  if (classification.category === "unknown") {
    warnings.push("This product is outside the strongest supported categories, so the verdict stays conservative.");
  }
  if (confidence.overall < 0.62) {
    warnings.push("This analysis has limited confidence, so strong claims are intentionally avoided.");
  }

  return [...new Set(warnings.filter(Boolean))];
}

function buildStates(classification, confidence) {
  return {
    unsupportedCategory: classification.category === "unknown",
    lowConfidence: confidence.overall < 0.62
  };
}

function buildCacheKey(product) {
  if (product.barcode) {
    return `${product.retailer}:${product.barcode}`;
  }
  if (product.asinOrSku) {
    return `${product.retailer}:${product.asinOrSku}`;
  }
  return `${product.retailer}:${product.title}:${product.brand}`.toLowerCase();
}

function adjustScoreForConfidence(scored, confidence, classification) {
  let value = scored.score;
  let label = scored.scoreLabel;
  let tone = scored.scoreTone;

  if (classification.category === "unknown") {
    value = Math.min(value, 58);
    label = value >= 60 ? "Fair" : scored.scoreLabel;
    tone = value >= 60 ? "fair" : scored.scoreTone;
  }

  if (confidence.overall < 0.48) {
    value = Math.min(value, 62);
    label = value >= 60 ? "Fair" : (value >= 40 ? "Caution" : "Avoid");
    tone = value >= 60 ? "fair" : (value >= 40 ? "caution" : "avoid");
  }

  return {
    value,
    label,
    tone,
    components: scored.components
  };
}

export async function buildAnalysisResult(rawExtraction, preferences, history, settings) {
  const normalizedProduct = normalizeProduct(rawExtraction);
  const initialClassification = classifyProduct(normalizedProduct);
  const enrichment = await enrichProduct(normalizedProduct, initialClassification, settings);
  const classification = classifyProduct(normalizedProduct, enrichment.sources || []);
  const merged = mergeProductData({ rawExtraction, normalizedProduct, classification, enrichment });
  const scored = scoreProduct(merged.product, preferences, classification, merged.confidence);
  const score = adjustScoreForConfidence(scored, merged.confidence, classification);
  const warnings = buildWarnings({ normalizedProduct, classification, confidence: merged.confidence, enrichment });

  const analysis = {
    cacheKey: buildCacheKey(merged.product),
    product: merged.product,
    classification,
    score,
    confidence: merged.confidence,
    tags: [...new Set(scored.tags)],
    flags: scored.flags,
    benefits: scored.benefits,
    preferenceHits: scored.preferenceHits,
    warnings,
    sources: merged.sources,
    states: buildStates(classification, merged.confidence),
    extractionMeta: {
      retailer: merged.product.retailerLabel,
      asinOrSku: merged.product.asinOrSku || null,
      barcode: merged.product.barcode || null
    }
  };

  analysis.alternatives = buildAlternatives({
    currentProduct: {
      ...merged.product,
      scoreValue: score.value,
      scoreLabel: score.label
    },
    classification,
    preferences,
    history,
    relatedProducts: normalizedProduct.relatedProducts,
    enrichmentCandidates: enrichment.candidates || []
  });

  return analysis;
}
