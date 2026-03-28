import { createRetailerExtractor } from "./shared.js";

const krogerExtractor = createRetailerExtractor({
  retailer: "kroger",
  retailerLabel: "Kroger",
  hostnames: ["kroger.com", "www.kroger.com"],
  pathPatterns: [/\/p\//i, /\/products\//i],
  selectors: {
    title: ['[data-testid="product-details-name"]', 'h1'],
    brand: ['[data-testid="product-brand"]', 'a[href*="/search"]'],
    price: ['[data-testid="product-price"]', '[itemprop="price"]', '.price'],
    rating: ['[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="review-count"]'],
    image: ['img[data-testid="product-image"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="breadcrumb"] a', 'nav[aria-label="Breadcrumb"] a'],
    claims: ['[data-testid="attribute-pill"]', '.badge'],
    ingredients: ['[data-testid="ingredients"]', '[data-testid="product-details"]'],
    nutrition: ['[data-testid="nutrition-facts"]', '[data-testid="product-details"]'],
    relatedCards: ['[data-testid="product-card"]', 'article'],
    relatedTitle: ['h3', 'img', 'span'],
    relatedPrice: ['[data-testid="product-price"]', '.price'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="product-details"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default krogerExtractor;
