import { createRetailerExtractor } from "./shared.js";

const instacartExtractor = createRetailerExtractor({
  retailer: "instacart",
  retailerLabel: "Instacart",
  hostnames: ["instacart.com", "www.instacart.com"],
  pathPatterns: [/\/products\//i, /\/store\//i],
  selectors: {
    title: ['h1[data-testid="item-name"]', 'h1', '[data-testid="item-title"]'],
    brand: ['[data-testid="item-brand"]', '[data-testid="brand-name"]'],
    price: ['[data-testid="item-price"]', '[data-testid="price"]', '[class*="price"]'],
    rating: ['[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="review-count"]'],
    image: ['img[data-testid="item-image"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['[data-testid="tag"]', '[class*="badge"]'],
    ingredients: ['[data-testid="ingredients"]', '[data-testid="item-details"]'],
    nutrition: ['[data-testid="nutrition"]', '[data-testid="item-details"]'],
    relatedCards: ['[data-testid="item-card"]', 'article'],
    relatedTitle: ['h2', 'h3', 'img', 'span'],
    relatedPrice: ['[data-testid="item-price"]', '[data-testid="price"]'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="item-details"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default instacartExtractor;
