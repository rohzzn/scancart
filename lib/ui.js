export function confidenceLabel(value) {
  if (value >= 0.85) {
    return "High confidence";
  }
  if (value >= 0.65) {
    return "Moderate confidence";
  }
  return "Limited confidence";
}

export function formatPrice(value) {
  return value || "Price unavailable";
}

export function scoreToneClass(tone) {
  return tone || "fair";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function prettyCategory(category) {
  const labels = {
    skincare: "Skincare",
    food: "Food",
    supplements: "Supplements",
    eco_cleaning: "Eco Cleaning",
    unknown: "Unknown"
  };
  return labels[category] || "General";
}

export function prettySubcategory(subcategory) {
  if (!subcategory || subcategory === "unknown") {
    return "General";
  }
  return subcategory.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function prettyRetailer(retailerLabel, retailerKey) {
  if (retailerLabel) {
    return retailerLabel;
  }
  return String(retailerKey || "Retailer").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
