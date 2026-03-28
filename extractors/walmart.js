import { createRetailerExtractor } from "./shared.js";

const walmartExtractor = createRetailerExtractor({
  retailer: "walmart",
  retailerLabel: "Walmart",
  hostnames: ["walmart.com", "www.walmart.com"],
  pathPatterns: [/\/ip\//i],
  selectors: {
    title: ['h1[itemprop="name"]', 'h1[data-automation-id="product-title"]', 'h1[data-testid="product-title"]', 'h1'],
    brand: ['a[link-identifier="brandName"]', '[data-testid="brand-name"]', 'a[href*="/brand/"]'],
    price: ['[itemprop="price"]', '[data-automation-id="product-price"]', '[data-testid="price-wrap"]'],
    rating: ['[data-testid="reviews-and-ratings"]', '[aria-label*="out of 5"]'],
    reviewCount: ['[data-testid="review-count"]', '[link-identifier="reviews"]'],
    image: ['img[data-testid="hero-image"]', 'img[loading="eager"]', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="breadcrumb"] a'],
    claims: ['[data-testid="pill"]', '[class*="badge"]'],
    ingredients: ['[data-testid="product-about-section"]', '[data-testid="accordion-item-content"]'],
    nutrition: ['[data-testid="nutrition-facts"]', '[data-testid="product-about-section"]'],
    categoryHints: ['[data-testid="product-category"]'],
    relatedCards: ['[data-testid="product-tile"]', '[data-testid="list-view"] article'],
    relatedTitle: ['h2', 'h3', '[data-testid="product-title"]', 'img'],
    relatedPrice: ['[data-testid="price-wrap"]', '[itemprop="price"]'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-testid="specifications"] li', '[data-testid="accordion-item-content"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default walmartExtractor;
