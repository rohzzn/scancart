function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function stringSimilarity(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }

  const aTokens = new Set(a.split(/[^a-z0-9]+/).filter(Boolean));
  const bTokens = new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return intersection / union;
}

function listOverlap(left, right) {
  const a = (left || []).map((item) => normalizeText(item));
  const b = new Set((right || []).map((item) => normalizeText(item)));
  if (!a.length || !b.size) {
    return 0;
  }
  const matches = a.filter((item) => b.has(item)).length;
  return matches / Math.max(a.length, b.size);
}

function objectOverlap(left, right) {
  const leftKeys = Object.keys(left || {});
  const rightKeys = new Set(Object.keys(right || {}));
  if (!leftKeys.length || !rightKeys.size) {
    return 0;
  }

  const matches = leftKeys.filter((key) => {
    if (!rightKeys.has(key)) {
      return false;
    }
    const leftValue = Number(left[key]);
    const rightValue = Number(right[key]);
    if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) {
      return normalizeText(left[key]) === normalizeText(right[key]);
    }
    return Math.abs(leftValue - rightValue) <= Math.max(2, Math.abs(leftValue) * 0.15);
  }).length;

  return matches / Math.max(leftKeys.length, rightKeys.size);
}

export function valueAgreement(fieldName, value, candidates) {
  const others = (candidates || []).filter((candidate) => candidate.value != null && candidate.value !== "");
  if (!others.length) {
    return 0;
  }

  let best = 0;
  for (const candidate of others) {
    let score = 0;
    if (typeof value === "string") {
      score = stringSimilarity(value, candidate.value);
    } else if (Array.isArray(value)) {
      score = listOverlap(value, candidate.value);
    } else if (value && typeof value === "object") {
      score = objectOverlap(value, candidate.value);
    } else if (value === candidate.value) {
      score = 1;
    }
    best = Math.max(best, score);
  }

  return best;
}

export function computeFieldConfidence(fieldName, candidate, candidates = []) {
  let confidence = candidate.authority || 0.4;
  const agreement = valueAgreement(fieldName, candidate.value, candidates.filter((item) => item !== candidate));
  confidence += agreement * 0.18;

  if (candidate.matchSignals?.barcodeMatch) {
    confidence += 0.12;
  }
  if (candidate.matchSignals?.titleBrandMatch) {
    confidence += 0.06;
  }
  if (candidate.reason?.toLowerCase().includes("structured")) {
    confidence += 0.04;
  }
  if (fieldName === "price" && candidate.value) {
    confidence += 0.03;
  }
  if ((fieldName === "ingredients" || fieldName === "nutrition") && candidate.value) {
    confidence += 0.04;
  }

  return Math.max(0.12, Math.min(0.98, confidence));
}

export function computeOverallConfidence({ fields, classification, sourceCount }) {
  const titleConfidence = fields.title?.confidence || 0;
  const brandConfidence = fields.brand?.confidence || 0;
  const categoryConfidence = Math.max(classification?.confidence || 0, fields.category?.confidence || 0);
  const ingredientsConfidence = fields.ingredients?.confidence || 0;
  const nutritionConfidence = fields.nutrition?.confidence || 0;
  const barcodeConfidence = fields.barcode?.value ? (fields.barcode.confidence || 0.7) : 0;
  const agreement = [fields.title?.agreement, fields.brand?.agreement, fields.ingredients?.agreement, fields.nutrition?.agreement]
    .filter((value) => typeof value === "number");
  const agreementAverage = agreement.length
    ? agreement.reduce((sum, value) => sum + value, 0) / agreement.length
    : 0.25;
  const sourceCoverage = Math.min(0.96, 0.38 + Math.max(0, sourceCount - 1) * 0.14);

  const overall = Math.min(0.98, (
    titleConfidence * 0.2 +
    brandConfidence * 0.14 +
    categoryConfidence * 0.14 +
    ingredientsConfidence * 0.18 +
    nutritionConfidence * 0.14 +
    barcodeConfidence * 0.1 +
    agreementAverage * 0.1 +
    sourceCoverage * 0.1
  ));

  return {
    overall,
    identity: Math.min(0.98, titleConfidence * 0.55 + brandConfidence * 0.25 + barcodeConfidence * 0.2),
    ingredients: ingredientsConfidence,
    nutrition: nutritionConfidence,
    category: categoryConfidence,
    sourceCoverage,
    agreement: agreementAverage,
    notes: overall < 0.6
      ? ["Only part of the product record could be verified across sources."]
      : []
  };
}
