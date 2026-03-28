import { createRetailerExtractor } from "./shared.js";

const cvsExtractor = createRetailerExtractor({
  retailer: "cvs",
  retailerLabel: "CVS",
  hostnames: ["cvs.com", "www.cvs.com"],
  pathPatterns: [/\/shop\//i, /-prod/i],
  selectors: {
    title: ['[data-testid="product-title"]', 'h1'],
    brand: ['[data-testid="product-brand"]', 'a[href*="/shop/"]'],
    price: ['[data-testid="price"]', '[itemprop="price"]', '.price'],
    rating: ['[data-testid="rating"]', '[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="review-count"]'],
    image: ['img[data-testid="product-image"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['[data-testid="badge"]', '.badge'],
    ingredients: ['[data-testid="ingredients"]', '[data-testid="details"]'],
    nutrition: ['[data-testid="nutrition"]', '[data-testid="details"]'],
    relatedCards: ['[data-testid="product-card"]'],
    relatedTitle: ['h3', 'img', 'span'],
    relatedPrice: ['[data-testid="price"]', '.price'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="details"] li', '[data-testid="product-attributes"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default cvsExtractor;
