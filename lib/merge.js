import { computeFieldConfidence, computeOverallConfidence, valueAgreement } from "./confidence.js";

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildRetailerSource(rawExtraction, normalizedProduct) {
  return {
    sourceKey: `${normalizedProduct.retailer}_dom`,
    sourceLabel: `${normalizedProduct.retailerLabel} page`,
    sourceType: "retailer_dom",
    authority: 0.66,
    trusted: true,
    matchSignals: {
      titleBrandMatch: Boolean(normalizedProduct.title && normalizedProduct.brand)
    },
    fields: {
      title: normalizedProduct.title,
      brand: normalizedProduct.brand,
      categoryHints: normalizedProduct.categoryHints,
      ingredients: normalizedProduct.ingredientsText,
      nutrition: normalizedProduct.nutrition,
      claims: normalizedProduct.claims,
      barcode: normalizedProduct.barcode,
      price: normalizedProduct.price,
      image: normalizedProduct.image
    },
    evidence: {
      url: rawExtraction.url,
      breadcrumbs: rawExtraction.breadcrumbs || []
    }
  };
}

function buildStructuredSource(normalizedProduct) {
  const structured = normalizedProduct.rawEvidence?.structuredProduct;
  if (!structured) {
    return null;
  }

  const image = Array.isArray(structured.image) ? structured.image[0] : structured.image;
  return {
    sourceKey: `${normalizedProduct.retailer}_structured`,
    sourceLabel: `${normalizedProduct.retailerLabel} structured data`,
    sourceType: "retailer_structured",
    authority: 0.74,
    trusted: true,
    matchSignals: {
      titleBrandMatch: Boolean(structured.name && (structured.brand?.name || structured.brand))
    },
    fields: {
      title: structured.name || "",
      brand: structured.brand?.name || structured.brand || "",
      categoryHints: unique([
        ...(normalizedProduct.rawEvidence?.structuredBreadcrumbs || []),
        structured.category || ""
      ]),
      barcode: structured.gtin13 || structured.gtin14 || structured.gtin12 || structured.gtin8 || "",
      price: structured.offers?.price || structured.offers?.lowPrice || "",
      image: image || ""
    },
    evidence: {
      source: "json_ld"
    }
  };
}

function buildCandidate(fieldName, source, value, reason) {
  return {
    value,
    sourceKey: source.sourceKey,
    sourceLabel: source.sourceLabel,
    authority: source.authority,
    trusted: source.trusted,
    matchSignals: source.matchSignals || {},
    reason
  };
}

function normalizeFieldValue(fieldName, value) {
  if (fieldName === "claims" || fieldName === "category") {
    return Array.isArray(value) ? unique(value) : unique([value]);
  }
  return value;
}

function selectField(fieldName, candidates = []) {
  const usable = candidates.filter((candidate) => candidate.value != null && candidate.value !== "" && (!(Array.isArray(candidate.value)) || candidate.value.length));
  if (!usable.length) {
    return {
      value: fieldName === "claims" || fieldName === "category" ? [] : null,
      sourceKey: null,
      sourceLabel: null,
      confidence: 0,
      agreement: 0,
      reason: `No reliable ${fieldName} value was found.`
    };
  }

  const ranked = usable.map((candidate) => {
    const agreement = valueAgreement(fieldName, candidate.value, usable.filter((item) => item !== candidate));
    const confidence = computeFieldConfidence(fieldName, candidate, usable);
    return {
      ...candidate,
      confidence,
      agreement,
      value: normalizeFieldValue(fieldName, candidate.value)
    };
  }).sort((left, right) => right.confidence - left.confidence || right.authority - left.authority);

  const winner = ranked[0];
  return {
    value: winner.value,
    sourceKey: winner.sourceKey,
    sourceLabel: winner.sourceLabel,
    confidence: winner.confidence,
    agreement: winner.agreement,
    reason: winner.reason || `Preferred ${fieldName} from ${winner.sourceLabel}.`,
    candidates: ranked
  };
}

export function mergeProductData({ rawExtraction, normalizedProduct, classification, enrichment }) {
  const sources = [buildRetailerSource(rawExtraction, normalizedProduct), buildStructuredSource(normalizedProduct), ...(enrichment?.sources || [])].filter(Boolean);

  const fields = {
    title: selectField("title", sources.map((source) => buildCandidate("title", source, source.fields?.title, source.evidence?.matchType ? `${source.sourceLabel} matched by ${source.evidence.matchType}.` : `Preferred from ${source.sourceLabel}.`))),
    brand: selectField("brand", sources.map((source) => buildCandidate("brand", source, source.fields?.brand, `Preferred from ${source.sourceLabel}.`))),
    category: selectField("category", [
      buildCandidate("category", sources[0], [classification.category, classification.subcategory !== "unknown" ? classification.subcategory : ""].filter(Boolean), "Retailer page classification."),
      ...sources.map((source) => buildCandidate("category", source, source.fields?.categoryHints, `Category hints from ${source.sourceLabel}.`))
    ]),
    ingredients: selectField("ingredients", sources.map((source) => buildCandidate("ingredients", source, source.fields?.ingredients, `Ingredient text from ${source.sourceLabel}.`))),
    nutrition: selectField("nutrition", sources.map((source) => buildCandidate("nutrition", source, source.fields?.nutrition, `Nutrition data from ${source.sourceLabel}.`))),
    claims: selectField("claims", sources.map((source) => buildCandidate("claims", source, source.fields?.claims, `Claims from ${source.sourceLabel}.`))),
    barcode: selectField("barcode", sources.map((source) => buildCandidate("barcode", source, source.fields?.barcode, `Identifier from ${source.sourceLabel}.`))),
    price: selectField("price", sources.map((source) => buildCandidate("price", source, source.fields?.price, `Price snapshot from ${source.sourceLabel}.`))),
    image: selectField("image", sources.map((source) => buildCandidate("image", source, source.fields?.image, `Image from ${source.sourceLabel}.`)))
  };

  const confidence = computeOverallConfidence({ fields, classification, sourceCount: sources.length });
  const product = {
    retailer: normalizedProduct.retailer,
    retailerLabel: normalizedProduct.retailerLabel,
    url: normalizedProduct.url,
    canonicalUrl: normalizedProduct.canonicalUrl,
    title: fields.title.value || normalizedProduct.title,
    brand: fields.brand.value || normalizedProduct.brand,
    category: classification.category,
    subcategory: classification.subcategory,
    ingredients: fields.ingredients.value || normalizedProduct.ingredientsText,
    ingredientsList: normalizedProduct.ingredients,
    nutrition: fields.nutrition.value || normalizedProduct.nutrition,
    nutritionText: normalizedProduct.nutritionText,
    claims: fields.claims.value?.length ? fields.claims.value : normalizedProduct.claims,
    barcode: fields.barcode.value || normalizedProduct.barcode,
    price: fields.price.value || normalizedProduct.price,
    priceValue: normalizedProduct.priceValue,
    currency: normalizedProduct.currency,
    image: fields.image.value || normalizedProduct.image,
    rating: normalizedProduct.rating,
    reviewCount: normalizedProduct.reviewCount,
    breadcrumbs: normalizedProduct.breadcrumbs,
    asinOrSku: normalizedProduct.asinOrSku,
    sku: normalizedProduct.sku,
    categoryHints: normalizedProduct.categoryHints
  };

  const sourceBadges = sources.map((source) => ({
    sourceKey: source.sourceKey,
    sourceLabel: source.sourceLabel,
    sourceType: source.sourceType,
    authorityWeight: source.authority,
    trusted: source.trusted,
    fields: Object.keys(source.fields || {}).filter((field) => source.fields[field] && (!(Array.isArray(source.fields[field])) || source.fields[field].length)),
    selectedFor: Object.entries(fields).filter(([, value]) => value.sourceKey === source.sourceKey).map(([field]) => field),
    matchType: source.evidence?.matchType || "page"
  }));

  return {
    product,
    fields,
    confidence,
    sources: sourceBadges,
    sourceRecords: sources
  };
}
