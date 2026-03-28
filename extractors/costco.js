import { createRetailerExtractor } from "./shared.js";

const costcoExtractor = createRetailerExtractor({
  retailer: "costco",
  retailerLabel: "Costco",
  hostnames: ["costco.com", "www.costco.com"],
  pathPatterns: [/\.product\./i, /\/CatalogSearch/i],
  selectors: {
    title: ['h1.product-h1-container', 'h1[itemprop="name"]', 'h1'],
    brand: ['[itemprop="brand"]', '.product-brand-name'],
    price: ['.product-pricing .price', '[itemprop="price"]', '.your-price'],
    rating: ['[aria-label*="out of 5"]'],
    reviewCount: ['.bv_numReviews_text'],
    image: ['#zoomImage', '.product-image img', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a', '.breadcrumbs a'],
    claims: ['.product-badges span', '.product-flag'],
    ingredients: ['#product-details', '.product-features'],
    nutrition: ['#product-details', '.product-features'],
    relatedCards: ['.product', '.featured-product'],
    relatedTitle: ['h3', '.description', 'img', 'span'],
    relatedPrice: ['.price', '.your-price'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['#product-details li', '.product-features li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default costcoExtractor;
