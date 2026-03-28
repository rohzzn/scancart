import { normalizeIngredientList } from "./scoring.js";

const CLAIM_ALIASES = new Map([
  ["fragrance free", "fragrance free"],
  ["unscented", "fragrance free"],
  ["vegan", "vegan"],
  ["cruelty free", "cruelty free"],
  ["paraben free", "paraben free"],
  ["sulfate free", "sulfate free"],
  ["sls free", "sulfate free"],
  ["low sugar", "low sugar"],
  ["high protein", "high protein"],
  ["low sodium", "low sodium"],
  ["sensitive skin", "sensitive skin"],
  ["hypoallergenic", "hypoallergenic"],
  ["non comedogenic", "non comedogenic"],
  ["clean at sephora", "clean at sephora"],
  ["safer choice", "safer choice"],
  ["plant based", "plant based"]
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u2122\u00AE]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))];
}

function parseNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function pickCurrency(priceText, fallback = "USD") {
  const text = normalizeText(priceText);
  if (/€|\bEUR\b/i.test(text)) {
    return "EUR";
  }
  if (/£|\bGBP\b/i.test(text)) {
    return "GBP";
  }
  if (/\$|\bUSD\b/i.test(text)) {
    return "USD";
  }
  return fallback;
}

export function normalizeTitle(title) {
  return normalizeText(title)
    .replace(/\s*[|]\s*(free shipping|target|amazon|walmart|sephora).*$/i, "")
    .replace(/\s+-\s+(target|amazon|walmart|sephora).*$/i, "")
    .trim();
}

export function normalizeBrand(brand, title = "") {
  const cleaned = normalizeText(brand)
    .replace(/^by\s+/i, "")
    .replace(/^visit the\s+/i, "")
    .replace(/\s+store$/i, "")
    .trim();
  if (cleaned) {
    return cleaned;
  }

  const titleText = normalizeTitle(title);
  const prefix = titleText.split(/[-:,|]/)[0].trim();
  if (prefix.split(" ").length <= 3 && prefix.length >= 3) {
    return prefix;
  }
  return "";
}

export function normalizeClaims(claims = [], extraText = "") {
  const allClaims = unique([...claims, ...String(extraText || "").split(/[,|]/)]);
  const normalized = [];

  for (const claim of allClaims) {
    const lower = claim.toLowerCase();
    let mapped = CLAIM_ALIASES.get(lower) || "";
    if (!mapped) {
      for (const [alias, value] of CLAIM_ALIASES.entries()) {
        if (lower.includes(alias)) {
          mapped = value;
          break;
        }
      }
    }
    if (mapped) {
      normalized.push(mapped);
    }
  }

  return unique(normalized);
}

export function normalizeIngredients(ingredientsText) {
  const items = normalizeIngredientList(ingredientsText || "");
  return {
    items,
    text: normalizeText(ingredientsText || items.map((item) => item.displayName).join(", "))
  };
}

export function normalizeNutrition(nutritionText) {
  const text = normalizeText(nutritionText);
  const map = {};
  const rules = [
    ["calories", /calories\s*(\d{1,4})/i, 1],
    ["protein", /protein\s*(\d{1,3}(?:\.\d+)?)\s*g/i, 1],
    ["fiber", /(dietary\s+fiber|fiber)\s*(\d{1,3}(?:\.\d+)?)\s*g/i, 2],
    ["sugars", /(total\s+)?sugars?\s*(\d{1,3}(?:\.\d+)?)\s*g/i, 2],
    ["addedSugars", /includes\s*(\d{1,3}(?:\.\d+)?)\s*g\s+added\s+sugars?/i, 1],
    ["sodium", /sodium\s*(\d{1,4}(?:\.\d+)?)\s*(mg|g)/i, 1],
    ["servingSize", /serving size\s*[:]?\s*([^.,;]+)/i, 1, true]
  ];

  for (const [key, pattern, index, rawString] of rules) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    if (rawString) {
      map[key] = normalizeText(match[index]);
      continue;
    }
    const value = Number(match[index]);
    map[key] = key === "sodium" && /g/i.test(match[2] || "") ? value * 1000 : value;
  }

  return {
    values: Object.keys(map).length ? map : null,
    text
  };
}

export function normalizeCategoryHints(categoryHints = [], breadcrumbs = []) {
  return unique([...(categoryHints || []), ...(breadcrumbs || [])]);
}

export function normalizeRetailerRelatedProducts(relatedProducts = [], retailer = "") {
  return (relatedProducts || []).map((item) => {
    const priceValue = parseNumber(item.price);
    return {
      title: normalizeTitle(item.title || ""),
      brand: normalizeBrand(item.brand || "", item.title || ""),
      price: normalizeText(item.price || ""),
      priceValue,
      currency: pickCurrency(item.price || ""),
      image: normalizeText(item.image || ""),
      url: normalizeText(item.url || ""),
      rating: parseNumber(item.rating),
      retailer,
      sourceType: "retailer_related"
    };
  }).filter((item) => item.title && item.url);
}

export function normalizeProduct(rawExtraction) {
  const title = normalizeTitle(rawExtraction.title);
  const brand = normalizeBrand(rawExtraction.brand, title);
  const ingredients = normalizeIngredients(rawExtraction.ingredientsText);
  const nutrition = normalizeNutrition(rawExtraction.nutritionText);
  const categoryHints = normalizeCategoryHints(rawExtraction.categoryHints, rawExtraction.breadcrumbs);
  const claims = normalizeClaims(rawExtraction.claims, [title, brand, ...categoryHints].join(" "));
  const priceValue = parseNumber(rawExtraction.price);

  return {
    retailer: rawExtraction.retailer,
    retailerLabel: rawExtraction.retailerLabel || rawExtraction.retailer,
    url: rawExtraction.url,
    canonicalUrl: rawExtraction.canonicalUrl || rawExtraction.url,
    title,
    brand,
    categoryHints,
    price: normalizeText(rawExtraction.price),
    priceValue,
    currency: rawExtraction.currency || pickCurrency(rawExtraction.price),
    image: normalizeText(rawExtraction.image),
    rating: parseNumber(rawExtraction.rating),
    reviewCount: parseNumber(rawExtraction.reviewCount),
    breadcrumbs: unique(rawExtraction.breadcrumbs || []),
    barcode: normalizeText(rawExtraction.barcode),
    sku: normalizeText(rawExtraction.sku),
    asinOrSku: normalizeText(rawExtraction.asinOrSku || rawExtraction.sku),
    claims,
    ingredients: ingredients.items,
    ingredientsText: ingredients.text,
    nutrition: nutrition.values,
    nutritionText: nutrition.text,
    relatedProducts: normalizeRetailerRelatedProducts(rawExtraction.relatedProducts, rawExtraction.retailer),
    rawEvidence: rawExtraction.rawEvidence || {},
    searchText: [brand, title, ...categoryHints].filter(Boolean).join(" ").trim()
  };
}
