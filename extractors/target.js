import { createRetailerExtractor } from "./shared.js";

const targetExtractor = createRetailerExtractor({
  retailer: "target",
  retailerLabel: "Target",
  hostnames: ["target.com", "www.target.com"],
  pathPatterns: [/\/p\//i],
  selectors: {
    title: ['[data-test="product-title"]', 'h1[data-test="product-title"]', 'h1'],
    brand: ['[data-test="product-brand"]', '[data-test="@web/StoreName/StoreName"] a', 'a[href*="/b/"]'],
    price: ['[data-test="product-price"]', '[data-test="product-price-sale"]', '[data-test="product-price-reg"]', '[data-test="price"]'],
    rating: ['[data-test="reviews-rating"]', '[data-test="ratingCount"]', '[aria-label*="out of 5"]'],
    reviewCount: ['[data-test="ratingCount"]', '[data-test="reviews-count"]'],
    image: ['img[data-test="product-image"]', '[data-test="imageGallery"] img', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['[data-test="badge-text"]', '[data-test="fulfillment-badge"]'],
    ingredients: ['[data-test="item-details"]', '[data-test="ingredients"]'],
    nutrition: ['[data-test="nutrition-facts"]', '[data-test="item-details"]'],
    categoryHints: ['[data-test="product-category"]'],
    relatedCards: ['[data-test="product-card"]'],
    relatedTitle: ['h3', '[data-test="product-title"]', 'img', 'span'],
    relatedPrice: ['[data-test="current-price"]', '[data-test="product-price"]'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-test="item-details"] li', '[data-test="specifications"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default targetExtractor;
