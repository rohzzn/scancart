import { enrichFoodProduct } from "./food.js";
import { enrichBeautyProduct } from "./beauty.js";
import { enrichSupplementProduct } from "./supplements.js";
import { enrichEcoProduct } from "./eco.js";

export async function enrichProduct(product, classification, settings) {
  const category = classification?.category || "unknown";

  if (category === "food") {
    return enrichFoodProduct(product, settings);
  }
  if (category === "skincare") {
    return enrichBeautyProduct(product, settings);
  }
  if (category === "supplements") {
    return enrichSupplementProduct(product, settings);
  }
  if (category === "eco_cleaning") {
    return enrichEcoProduct(product, settings);
  }

  return {
    sources: [],
    candidates: [],
    warnings: ["No category-specific enrichment source was available for this product yet."]
  };
}
