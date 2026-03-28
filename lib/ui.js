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
  if (!category) {
    return "Unknown";
  }
  if (category === "skincare") {
    return "Skincare";
  }
  if (category === "food") {
    return "Food";
  }
  return "General";
}
