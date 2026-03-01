// Application-wide constants for GMB Ranking Tracker Pro
'use strict';

const CONFIG = {
  APP_NAME: 'GMB Ranking Tracker Pro',
  VERSION: '1.0.1',
  
  // Scraping settings
  MAX_PAGES_TO_CHECK: 5,
  RESULTS_PER_PAGE: 20,
  DELAY_BETWEEN_SEARCHES: 5000, // 5 seconds
  PAGE_LOAD_TIMEOUT: 8000,
  SCROLL_DELAY: 2000,
  MIN_WAIT_BETWEEN_CHECKS: 3000,
  
  // Concurrency settings
  MAX_CONCURRENT_TABS: 3,
  BATCH_SIZE: 10,
  RETRY_ATTEMPTS: 3,
  
  // Matching thresholds
  FUZZY_MATCH_THRESHOLD: 0.85,
  HIGH_CONFIDENCE_THRESHOLD: 95,
  MEDIUM_CONFIDENCE_THRESHOLD: 80,
  
  // Database
  DB_NAME: 'GMBRankingDB',
  DB_VERSION: 1,
  STORE_RANKINGS: 'rankings',
  STORE_BUSINESSES: 'businesses',
  STORE_KEYWORDS: 'keywords',
  STORE_SETTINGS: 'settings',
  
  // Storage keys
  STORAGE_KEYS: {
    LAST_CHECK: 'lastCheckTimestamp',
    BULK_QUEUE: 'bulkQueue',
    SETTINGS: 'userSettings',
    EXPORT_HISTORY: 'exportHistory'
  },
  
  // Google Search Selectors (updated for Dec 2025)
  SELECTORS: {
    // Local pack / Map results
    localPack: 'div[role="main"] div[data-attrid="LocalResultsAttribution"]',
    businessCard: 'div[role="article"]',
    businessName: '.fontHeadlineSmall, .qBF1Pd, span.OSrXXb',
    businessTitle: 'h2, h3, .fontHeadlineSmall',
    
    // Rating and reviews
    rating: 'span[role="img"][aria-label*="stars"], span[aria-label*="stars"]',
    reviewCount: 'span[aria-label*="reviews"], .RDApEe',
    
    // Business details
    category: '.W4Efsd:first-child span, .rllt__details div:first-child',
    address: '.W4Efsd:nth-child(2), .rllt__details div:nth-child(2)',
    phone: 'span[data-tooltip*="phone"], a[href^="tel:"]',
    website: 'a[href*="http"]:not([href*="google.com"])',
    
    // Links and navigation
    placeLink: 'a[href*="/maps/place/"], a[data-cid]',
    placeId: '[data-cid], [data-place-id]',
    nextButton: 'button[aria-label="Next page"], a[aria-label="Next"]',
    
    // Organic search results
    organicResult: 'div.g, div[data-hveid], div[jscontroller]',
    organicTitle: 'h3, div[role="heading"]',
    organicUrl: 'a[href]:not([role="button"])',
    organicSnippet: '.VwiC3b, .IsZvec, .aCOpRe',
    
    // Result containers
    feedContainer: '[role="feed"], div[id="search"]',
    searchResults: 'div#search, div#rso',
    resultStats: '#result-stats',
    
    // Ads (to filter out)
    adContainer: 'div[data-text-ad], .uEierd, .commercial-unit-desktop-top',
    sponsoredLabel: 'span:contains("Sponsored"), span:contains("Ad")'
  },
  
  // Google Maps URLs
  MAPS: {
    BASE_URL: 'https://www.google.com/maps',
    SEARCH_URL: 'https://www.google.com/maps/search/',
    PLACE_URL: 'https://www.google.com/maps/place/'
  },
  
  // Status codes
  STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    NOT_FOUND: 'not_found',
    RATE_LIMITED: 'rate_limited',
    CANCELLED: 'cancelled'
  },
  
  // Match methods
  MATCH_METHODS: {
    PLACE_ID: 'place_id',
    EXACT_NAME: 'exact_name',
    FUZZY_NAME: 'fuzzy_name',
    URL_MATCH: 'url_match',
    PHONE_MATCH: 'phone_match'
  },
  
  // Error messages
  ERRORS: {
    NO_RESULTS: 'No search results found on page',
    PAGE_LOAD_TIMEOUT: 'Page load timeout exceeded',
    RATE_LIMITED: 'Google rate limiting detected',
    INVALID_INPUT: 'Invalid input parameters',
    CONTENT_SCRIPT_ERROR: 'Content script not loaded',
    STORAGE_ERROR: 'Failed to access storage'
  },
  
  // API rate limits
  RATE_LIMITS: {
    SEARCHES_PER_MINUTE: 10,
    SEARCHES_PER_HOUR: 100,
    MAX_DAILY_SEARCHES: 1000
  }
};

// Make CONFIG available globally for content scripts
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// Export for Node.js/module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Log that constants are loaded
console.log('[INFO] CONFIG loaded -', CONFIG.APP_NAME, 'v' + CONFIG.VERSION);
