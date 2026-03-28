import amazonExtractor from "./amazon.js";
import targetExtractor from "./target.js";
import walmartExtractor from "./walmart.js";
import sephoraExtractor from "./sephora.js";
import cvsExtractor from "./cvs.js";
import walgreensExtractor from "./walgreens.js";
import instacartExtractor from "./instacart.js";
import krogerExtractor from "./kroger.js";
import costcoExtractor from "./costco.js";
import samsClubExtractor from "./samsclub.js";
import { createRetailerExtractor } from "./shared.js";

const genericRetailers = [
  createRetailerExtractor({
    retailer: "wholefoods",
    retailerLabel: "Whole Foods",
    hostnames: ["wholefoodsmarket.com", "www.wholefoodsmarket.com"],
    pathPatterns: [/\/product\//i],
    selectors: {
      title: ["h1", '[data-testid="product-title"]'],
      brand: ['[data-testid="brand-name"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge', '[class*="badge"]'],
      ingredients: ['[data-testid="product-details"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "ebay",
    retailerLabel: "eBay",
    hostnames: ["ebay.com", "www.ebay.com"],
    pathPatterns: [/\/itm\//i],
    selectors: {
      title: ['h1.x-item-title__mainTitle', 'h1'],
      brand: ['.ux-labels-values--brand .ux-textspans', '[itemprop="brand"]'],
      price: ['.x-price-primary', '[itemprop="price"]'],
      image: ['.ux-image-carousel-item img', 'img[alt]'],
      breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
      ingredients: ['.ux-layout-section__textual-display'],
      nutrition: ['.ux-layout-section__textual-display'],
      relatedCards: ['.srp-results .s-item'],
      relatedTitle: ['.s-item__title', 'img'],
      relatedPrice: ['.s-item__price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "etsy",
    retailerLabel: "Etsy",
    hostnames: ["etsy.com", "www.etsy.com"],
    pathPatterns: [/\/listing\//i],
    selectors: {
      title: ['h1[data-buy-box-listing-title="true"]', 'h1'],
      brand: ['a[href*="/shop/"]'],
      price: ['[data-buy-box-region="price"]', '[itemprop="price"]'],
      image: ['img[data-index="0"]', 'img[alt]'],
      breadcrumbs: ['nav[aria-label="Breadcrumbs"] a'],
      ingredients: ['[data-id="structured-listing-page-details"]'],
      claims: ['.wt-badge'],
      relatedCards: ['.wt-list-unstyled li'],
      relatedTitle: ['h3', 'img', 'span'],
      relatedPrice: ['.currency-value'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "bestbuy",
    retailerLabel: "Best Buy",
    hostnames: ["bestbuy.com", "www.bestbuy.com"],
    pathPatterns: [/\/site\//i],
    selectors: {
      title: ['.sku-title h1', 'h1'],
      brand: ['.shop-brand', '[data-track="Brand"]'],
      price: ['.priceView-customer-price span', '[itemprop="price"]'],
      image: ['.primary-image', 'img[alt]'],
      breadcrumbs: ['nav[aria-label="Breadcrumb"] a'],
      claims: ['.fulfillment-add-to-cart-button'],
      ingredients: ['.product-data'],
      relatedCards: ['li.sku-item'],
      relatedTitle: ['h4', '.sku-title', 'img'],
      relatedPrice: ['.priceView-customer-price span'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "costco_sameday",
    retailerLabel: "Costco SameDay",
    hostnames: ["sameday.costco.com"],
    pathPatterns: [/\/products\//i],
    selectors: {
      title: ['h1', '[data-testid="item-name"]'],
      brand: ['[data-testid="item-brand"]'],
      price: ['[data-testid="item-price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="item-details"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['[data-testid="item-price"]'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "aldi",
    retailerLabel: "Aldi",
    hostnames: ["aldi.us", "www.aldi.us", "shop.aldi.us"],
    pathPatterns: [/\/products\//i, /\/product\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      brand: ['[data-testid="product-brand"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="ingredients"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "traderjoes",
    retailerLabel: "Trader Joe's",
    hostnames: ["traderjoes.com", "www.traderjoes.com"],
    pathPatterns: [/\/home\/products\//i, /\/products\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      price: ['.price', '[data-testid="price"]'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['.product-details'],
      nutrition: ['.product-details'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "freshdirect",
    retailerLabel: "FreshDirect",
    hostnames: ["freshdirect.com", "www.freshdirect.com"],
    pathPatterns: [/\/pdp\//i, /\/product\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      brand: ['[data-testid="brand"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="ingredients"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "shipt",
    retailerLabel: "Shipt",
    hostnames: ["shipt.com", "www.shipt.com"],
    pathPatterns: [/\/products\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      brand: ['[data-testid="brand-name"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="ingredients"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "hungryroot",
    retailerLabel: "Hungryroot",
    hostnames: ["hungryroot.com", "www.hungryroot.com"],
    pathPatterns: [/\/product\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      brand: ['[data-testid="brand"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="ingredients"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  }),
  createRetailerExtractor({
    retailer: "misfitsmarket",
    retailerLabel: "Misfits Market",
    hostnames: ["misfitsmarket.com", "www.misfitsmarket.com"],
    pathPatterns: [/\/products\//i, /\/product\//i],
    selectors: {
      title: ['h1', '[data-testid="product-title"]'],
      brand: ['[data-testid="brand-name"]'],
      price: ['[data-testid="price"]', '.price'],
      image: ['img[alt]'],
      breadcrumbs: ['nav a'],
      claims: ['.badge'],
      ingredients: ['[data-testid="ingredients"]'],
      nutrition: ['[data-testid="nutrition"]'],
      relatedCards: ['article'],
      relatedTitle: ['h2', 'h3', 'img', 'span'],
      relatedPrice: ['.price'],
      relatedImage: ['img']
    }
  })
];

const extractors = [amazonExtractor, targetExtractor, walmartExtractor, sephoraExtractor, cvsExtractor, walgreensExtractor, instacartExtractor, krogerExtractor, costcoExtractor, samsClubExtractor, ...genericRetailers];

export function findExtractorForCurrentPage() {
  const hostname = location.hostname;
  return extractors.find((extractor) => extractor.matches(hostname)) || null;
}

export function isSupportedRetailerUrl(url = location.href) {
  try {
    const hostname = new URL(url).hostname;
    return extractors.some((extractor) => extractor.matches(hostname));
  } catch (error) {
    return false;
  }
}

export function detectRetailer() {
  return findExtractorForCurrentPage()?.retailer || null;
}

export function extractCurrentPage() {
  const extractor = findExtractorForCurrentPage();
  return extractor ? extractor.extract() : null;
}
