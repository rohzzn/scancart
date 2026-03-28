import { createRetailerExtractor } from "./shared.js";

const sephoraExtractor = createRetailerExtractor({
  retailer: "sephora",
  retailerLabel: "Sephora",
  hostnames: ["sephora.com", "www.sephora.com"],
  pathPatterns: [/\/product\//i],
  selectors: {
    title: ['[data-at="product_name"]', 'h1[data-comp="ProductPageTitle"]', 'h1'],
    brand: ['[data-at="brand_name"]', 'a[data-at="brand_name"]'],
    price: ['[data-at="price"]', '[data-comp="Price"]', '[data-at="list_price"]'],
    rating: ['[data-at="stars_rating"]', '[aria-label*="out of 5"]'],
    reviewCount: ['[data-at="number_of_reviews"]'],
    image: ['img[data-comp="PrimaryImage"]', '[data-at="hero_image"] img', 'img[alt]'],
    breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
    claims: ['[data-at="highlight_item"]', '[data-at="ingredient_callout"]', '[data-at="clean_product"]'],
    ingredients: ['[data-at="ingredients_content"]', '#ingredients', '[data-comp="Accordion"]'],
    categoryHints: ['[data-at="product_category"]', '[data-at="product_type"]'],
    relatedCards: ['[data-comp="ProductCard"]'],
    relatedTitle: ['[data-at="product_name"]', 'h3', 'img'],
    relatedPrice: ['[data-at="price"]'],
    relatedImage: ['img']
  },
  detail: {
    rowSelectors: ['[data-comp="Accordion"] li'],
    keySelectors: ['strong', 'span:first-child'],
    valueSelectors: ['span:last-child', 'div', 'p']
  }
});

export default sephoraExtractor;
