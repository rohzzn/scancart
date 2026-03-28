import { createRetailerExtractor } from "./shared.js";

const amazonExtractor = createRetailerExtractor({
  retailer: "amazon",
  retailerLabel: "Amazon",
  hostnames: ["amazon.com", "www.amazon.com"],
  pathPatterns: [/\/(dp|gp\/product)\//i],
  selectors: {
    title: ["#productTitle"],
    brand: ["#bylineInfo", "#brand"],
    price: ["#corePrice_feature_div .a-offscreen", "#corePriceDisplay_desktop_feature_div .a-offscreen", "#price_inside_buybox", ".a-price .a-offscreen"],
    rating: ["#acrPopover", "[data-hook='rating-out-of-text']"],
    reviewCount: ["#acrCustomerReviewText"],
    image: ["#landingImage", "#imgTagWrapperId img", "#main-image-container img"],
    breadcrumbs: ["#wayfinding-breadcrumbs_feature_div li a"],
    claims: ["#zeitgeistBadge_feature_div span", ".badge-text"],
    ingredients: ["#important-information p", "#feature-bullets"],
    nutrition: ["#important-information", "#productFactsDesktopExpander"],
    categoryHints: ["#nav-subnav a", "#averageCustomerReviews"],
    sku: ["#ASIN"],
    relatedCards: ["[data-asin]:not([data-asin=''])"],
    relatedTitle: ["h2", ".a-size-base-plus", "img", "span"],
    relatedPrice: [".a-price .a-offscreen"],
    relatedImage: ["img"],
    relatedLink: ['a[href*="/dp/"]', 'a[href*="/gp/product/"]']
  },
  detail: {
    rowSelectors: ["#productDetails_detailBullets_sections1 tr", "#productDetails_techSpec_section_1 tr", "#productDetails_db_sections tr", "#detailBullets_feature_div li"],
    keySelectors: ["th", ".a-text-bold", "span.a-text-bold"],
    valueSelectors: ["td", "span:nth-of-type(2)", "span:not(.a-text-bold)"]
  },
  headingPatterns: {
    ingredients: [/ingredients/i, /important information/i],
    nutrition: [/nutrition/i, /supplement facts/i]
  },
  customize(raw) {
    const asinMatch = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return {
      ...raw,
      brand: raw.brand.replace(/^Visit the\s+/i, "").replace(/\s+Store$/i, "").trim(),
      asinOrSku: asinMatch ? asinMatch[1] : raw.asinOrSku,
      rawEvidence: {
        ...raw.rawEvidence,
        asin: asinMatch ? asinMatch[1] : ""
      }
    };
  }
});

export default amazonExtractor;
