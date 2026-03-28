import { createRetailerExtractor } from "./shared.js";

const samsClubExtractor = createRetailerExtractor({
  retailer: "samsclub",
  retailerLabel: "Sam's Club",
  hostnames: ["samsclub.com", "www.samsclub.com"],
  pathPatterns: [/\/p\//i],
  selectors: {
    title: ['h1[data-testid="item-title"]', 'h1'],
    brand: ['[data-testid="brand-name"]', 'a[href*="/brand/"]'],
    price: ['[data-testid="price-view"]', '[itemprop="price"]', '.Price-group'],
    rating: ['[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="reviews-count"]'],
    image: ['img[data-testid="image-viewer-image"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['.badge', '[data-testid="badge"]'],
    ingredients: ['[data-testid="description-container"]', '[data-testid="specifications"]'],
    nutrition: ['[data-testid="description-container"]', '[data-testid="specifications"]'],
    relatedCards: ['[data-testid="product-card"]', 'article'],
    relatedTitle: ['h3', 'img', 'span'],
    relatedPrice: ['[data-testid="price-view"]', '.price'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="specifications"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default samsClubExtractor;
