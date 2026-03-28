import { createRetailerExtractor } from "./shared.js";

const walgreensExtractor = createRetailerExtractor({
  retailer: "walgreens",
  retailerLabel: "Walgreens",
  hostnames: ["walgreens.com", "www.walgreens.com"],
  pathPatterns: [/\/store\/c\//i],
  selectors: {
    title: ['[data-testid="product-title"]', 'h1'],
    brand: ['[data-testid="product-brand"]', 'a[href*="/search/results.jsp?Ntt="]'],
    price: ['[data-testid="price"]', '[itemprop="price"]', '.price'],
    rating: ['[data-testid="rating"]', '[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="review-count"]'],
    image: ['img[data-testid="product-image"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['.badge', '[data-testid="badge"]'],
    ingredients: ['[data-testid="ingredients"]', '[data-testid="details"]'],
    nutrition: ['[data-testid="nutrition"]', '[data-testid="details"]'],
    relatedCards: ['[data-testid="product-card"]'],
    relatedTitle: ['h3', 'img', 'span'],
    relatedPrice: ['[data-testid="price"]', '.price'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="details"] li', '.product-details li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default walgreensExtractor;
