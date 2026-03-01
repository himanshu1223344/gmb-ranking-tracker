// GMB Content Script v5.0 - Fixed + extractBusinesses Action
'use strict';

console.log('🔥 GMB CONTENT SCRIPT v5.0 - FULL FIX 🔥');

const CONFIG = {
  MAX_WAIT_FOR_RESULTS: 10000,
  MUTATION_CHECK_INTERVAL: 500,
  MIN_RESULTS_THRESHOLD: 1,        // ✅ Changed 3 → 1 (don't wait for 3 minimum)
  SELECTOR_TIMEOUT: 2000,
  MAX_PAGES_TO_CHECK: 3,
  PAGINATION_WAIT: 4000,
  PAGE_LOAD_RETRIES: 8,
  SCROLL_DELAY: 3000
};

function safeLog(level, msg, data) {
  try {
    console.log(`[GMB ${level}]`, msg, data || '');
  } catch (e) {
    console.log('[LOG-FAIL]', msg);
  }
}

safeLog('INFO', 'Content script v5.0 initializing...');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// ✅ PAGE READY CHECK
// ============================================

function isPageReady() {
  const selectors = [
    '[role="article"]',
    '.rllt__details',
    '.VkpGBb',
    'div[jsname][data-hveid]',
    'div[data-cid]',
    'a[href*="/maps/place/"]',
    // ✅ NEW: 2025 Google selectors
    '[data-rc]',
    '.lqhpac',
    '.uMdZh',
    '.cXedhc',
    '#rso li',
    '.MjjYud li'
  ];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length >= CONFIG.MIN_RESULTS_THRESHOLD) {
        safeLog('DEBUG', `✅ Page ready via: ${selector} (${elements.length} found)`);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // ✅ NEW: Check if #rso exists with any content
  const rso = document.querySelector('#rso');
  if (rso && rso.innerHTML.length > 500) {
    safeLog('DEBUG', '✅ Page ready via #rso content');
    return true;
  }

  return false;
}

function waitForResults(timeout = CONFIG.MAX_WAIT_FOR_RESULTS) {
  return new Promise((resolve) => {
    if (isPageReady()) {
      safeLog('INFO', 'Results already loaded');
      resolve(true);
      return;
    }

    safeLog('INFO', 'Waiting for results to load...');

    const observer = new MutationObserver(() => {
      if (isPageReady()) {
        safeLog('INFO', 'Results detected via MutationObserver');
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      const ready = isPageReady();
      safeLog(ready ? 'INFO' : 'WARN', 'Wait timeout', { ready });
      resolve(ready);
    }, timeout);
  });
}

// ============================================
// ✅ BUSINESS CARD DETECTION - UPDATED
// ============================================

function getAllBusinessCards() {
  // Priority order - most reliable first
  const strategies = [
    // Strategy 1: data-cid (most reliable for local results)
    {
      name: 'data-cid',
      fn: () => {
        const els = document.querySelectorAll('[data-cid]');
        safeLog('DEBUG', `data-cid: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 2: role=article (local pack items)
    {
      name: 'role=article',
      fn: () => {
        const els = document.querySelectorAll('[role="article"]');
        safeLog('DEBUG', `role=article: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 3: rllt__details (older Google)
    {
      name: 'rllt__details',
      fn: () => {
        const els = document.querySelectorAll('.rllt__details');
        safeLog('DEBUG', `rllt__details: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 4: VkpGBb
    {
      name: 'VkpGBb',
      fn: () => {
        const els = document.querySelectorAll('.VkpGBb');
        safeLog('DEBUG', `VkpGBb: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 5: lqhpac (2024-2025)
    {
      name: 'lqhpac',
      fn: () => {
        const els = document.querySelectorAll('.lqhpac');
        safeLog('DEBUG', `lqhpac: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 6: uMdZh
    {
      name: 'uMdZh',
      fn: () => {
        const els = document.querySelectorAll('.uMdZh');
        safeLog('DEBUG', `uMdZh: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 7: #rso list items
    {
      name: '#rso li',
      fn: () => {
        const rso = document.querySelector('#rso');
        if (!rso) return [];
        const els = rso.querySelectorAll('li');
        safeLog('DEBUG', `#rso li: ${els.length}`);
        return Array.from(els).filter(el => {
          const hasCid = el.querySelector('[data-cid]') || el.hasAttribute('data-cid');
          const hasHeading = el.querySelector('[role="heading"]');
          const hasMapsLink = el.querySelector('a[href*="/maps/place/"]');
          return hasCid || hasHeading || hasMapsLink;
        });
      }
    },
    // Strategy 8: MjjYud (local results container 2025)
    {
      name: 'MjjYud li',
      fn: () => {
        const container = document.querySelector('.MjjYud');
        if (!container) return [];
        const els = container.querySelectorAll('li');
        safeLog('DEBUG', `MjjYud li: ${els.length}`);
        return Array.from(els);
      }
    },
    // Strategy 9: Any li with maps link
    {
      name: 'li-with-maps-link',
      fn: () => {
        const els = document.querySelectorAll('li:has(a[href*="/maps/place/"])');
        safeLog('DEBUG', `li-with-maps-link: ${els.length}`);
        return Array.from(els);
      }
    }
  ];

  for (const strategy of strategies) {
    try {
      const cards = strategy.fn();
      const validCards = cards.filter(card => {
        const name = extractBusinessName(card);
        return name && name.length > 2;
      });

      if (validCards.length > 0) {
        safeLog('INFO', `✅ Using strategy: ${strategy.name} → ${validCards.length} valid cards`);
        return validCards;
      }
    } catch (error) {
      safeLog('WARN', `Strategy ${strategy.name} failed`, error.message);
      continue;
    }
  }

  // ✅ LAST RESORT: Any element with role=heading near maps link
  safeLog('WARN', '⚠️ All strategies failed! Trying last resort...');
  const headings = document.querySelectorAll('[role="heading"]');
  const results = [];
  headings.forEach(h => {
    const parent = h.closest('li') || h.closest('[jsdata]') || h.closest('[data-hveid]');
    if (parent && (
      parent.querySelector('a[href*="/maps/place/"]') ||
      parent.querySelector('[data-cid]') ||
      parent.getAttribute('data-cid')
    )) {
      results.push(parent);
    }
  });
  safeLog('DEBUG', `Last resort headings: ${results.length}`);
  return results;
}

// ============================================
// ✅ DATA EXTRACTION - UPDATED
// ============================================

function extractBusinessName(card) {
  const headingSelectors = [
    '[role="heading"]',
    'div[role="heading"] a',
    'span[role="heading"] a',
    '[aria-level="3"] a',
    '[aria-level="3"]',
    'h3 a', 'h3',
    'h2 a', 'h2',
    // ✅ NEW 2025 selectors
    '.OSrXXb',
    '.qBF1Pd',
    '.dbg0pd',
    '.SPZz6b',
    '.fontHeadlineSmall',
    'a[href*="/maps/place/"]'
  ];

  for (const selector of headingSelectors) {
    try {
      const el = card.querySelector(selector);
      if (el && el.textContent.trim()) {
        let name = el.textContent.trim();
        // Clean ad labels
        name = name.replace(/\s*Ꮇy Ad Centre.*$/i, '');
        name = name.replace(/\s*·?\s*Ad\s*$/i, '');
        name = name.replace(/\s*Sponsored.*$/i, '');
        name = name.replace(/\s*•.*$/i, '');
        name = name.split('\n')[0].trim(); // First line only
        if (name.length > 2 && !/^\d+$/.test(name)) {
          return name;
        }
      }
    } catch (e) {
      continue;
    }
  }

  return '';
}

function extractPlaceId(card) {
  try {
    // Direct attribute
    if (card.hasAttribute('data-cid')) return card.getAttribute('data-cid');

    // Child element
    const cidEl = card.querySelector('[data-cid]');
    if (cidEl) return cidEl.getAttribute('data-cid');

    // Maps link patterns
    const link = card.querySelector('a[href*="/maps/place/"]');
    if (link && link.href) {
      const patterns = [
        /[?&]cid=(\d+)/,
        /[?&]ludocid=(\d+)/,
        /!1s(0x[a-f0-9:]+)/,
        /\/maps\/place\/[^/]+\/@[^/]+\/([^/]+)/
      ];
      for (const pattern of patterns) {
        const match = link.href.match(pattern);
        if (match && match[1]) return match[1];
      }
    }
  } catch (error) {
    safeLog('WARN', 'PlaceID extraction failed', error.message);
  }
  return '';
}

function extractRating(card) {
  try {
    const selectors = [
      '[role="img"][aria-label*="star"]',
      '[role="img"][aria-label*="Star"]',
      '[aria-label*="rating"]',
      '.yi40Hd',
      '[aria-label*="stars"]'
    ];
    for (const selector of selectors) {
      const el = card.querySelector(selector);
      if (el) {
        const text = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
        const match = text.match(/(\d+\.?\d*)/);
        if (match && parseFloat(match[1]) <= 5) return match[1];
      }
    }
  } catch (e) {}
  return '';
}

function extractReviewCount(card) {
  try {
    const selectors = ['[aria-label*="review"]', '[aria-label*="Review"]', '.RDApEe'];
    for (const selector of selectors) {
      const els = card.querySelectorAll(selector);
      for (const el of els) {
        const text = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
        const match = text.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
        if (match) {
          const count = match[1].replace(/,/g, '');
          if (parseInt(count) > 0) return count;
        }
      }
    }
  } catch (e) {}
  return '';
}

function extractCategory(card) {
  try {
    const selectors = ['.W4Efsd span', '.fontBodyMedium', '.YhemCb', '.rllt__details > div:nth-child(2)'];
    for (const selector of selectors) {
      const el = card.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > 3 && text.length < 100 && !/^\d+/.test(text)) return text;
      }
    }
  } catch (e) {}
  return '';
}

function extractAddress(card) {
  try {
    const selectors = ['[data-attrid*="address"]', '.rllt__details > div:last-child', '.LrzXr'];
    for (const selector of selectors) {
      const el = card.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > 5 && /\d/.test(text)) return text;
      }
    }
  } catch (e) {}
  return '';
}

function extractBusinessData(card, position) {
  return {
    position,
    name: extractBusinessName(card),
    placeId: extractPlaceId(card),
    rating: extractRating(card),
    reviewCount: extractReviewCount(card),
    category: extractCategory(card),
    address: extractAddress(card)
  };
}

// ============================================
// ✅ SCRAPING
// ============================================

function scrapeLocalResults() {
  safeLog('INFO', '🔍 Scraping local results...');

  // ✅ Log all strategies for debug
  safeLog('DEBUG', 'Debug counts:', {
    'data-cid': document.querySelectorAll('[data-cid]').length,
    'role=article': document.querySelectorAll('[role="article"]').length,
    'rllt__details': document.querySelectorAll('.rllt__details').length,
    'VkpGBb': document.querySelectorAll('.VkpGBb').length,
    'lqhpac': document.querySelectorAll('.lqhpac').length,
    'uMdZh': document.querySelectorAll('.uMdZh').length,
    'maps links': document.querySelectorAll('a[href*="/maps/place/"]').length,
    'headings in rso': document.querySelector('#rso')?.querySelectorAll('[role="heading"]').length || 0,
    'url': window.location.href.substring(0, 80)
  });

  const cards = getAllBusinessCards();
  const results = [];

  cards.forEach((card, index) => {
    try {
      const data = extractBusinessData(card, index + 1);
      if (data && data.name) {
        results.push(data);
        safeLog('DEBUG', `✓ #${index + 1}: "${data.name}" | CID: ${data.placeId || 'none'}`);
      }
    } catch (error) {
      safeLog('ERROR', `Card ${index + 1} failed`, error.message);
    }
  });

  safeLog('INFO', `📊 Total scraped: ${results.length} businesses`);
  return results;
}

// ============================================
// ✅ PAGINATION - UNCHANGED (working)
// ============================================

function getCurrentPageFromURL() {
  try {
    const url = new URL(window.location.href);
    const startParam = url.searchParams.get('start');
    if (!startParam) return 1;
    const startValue = parseInt(startParam);
    return Math.floor(startValue / 20) + 1;
  } catch (error) {
    return 1;
  }
}

async function loadAllResultsViaPagination(maxPages = CONFIG.MAX_PAGES_TO_CHECK) {
  safeLog('INFO', 'Starting pagination', { maxPages });

  let allBusinesses = new Map();
  const initialCards = getAllBusinessCards();
  initialCards.forEach(card => {
    const name = extractBusinessName(card);
    if (name) allBusinesses.set(name, card);
  });

  safeLog('INFO', `Page 1: ${allBusinesses.size} unique businesses`);

  let pagesChecked = 1;

  while (pagesChecked < maxPages) {
    const nextButton = findNextButton();
    if (!nextButton || isNextButtonDisabled(nextButton)) {
      safeLog('INFO', 'No next page available');
      break;
    }

    const beforeURL = window.location.href;
    const beforeCount = allBusinesses.size;

    try {
      nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(500);
      nextButton.click();

      let urlChanged = false;
      for (let i = 0; i < 10; i++) {
        await delay(300);
        if (window.location.href !== beforeURL) {
          urlChanged = true;
          break;
        }
      }

      if (!urlChanged) break;

      await delay(CONFIG.PAGINATION_WAIT);

      let newResultsDetected = false;
      let retries = 0;

      while (retries < CONFIG.PAGE_LOAD_RETRIES) {
        const currentCards = getAllBusinessCards();
        let newBusinessFound = false;

        currentCards.forEach(card => {
          const name = extractBusinessName(card);
          if (name && !allBusinesses.has(name)) {
            newBusinessFound = true;
            allBusinesses.set(name, card);
          }
        });

        if (newBusinessFound || allBusinesses.size > beforeCount) {
          newResultsDetected = true;
          pagesChecked++;
          safeLog('INFO', `Page ${pagesChecked}: Total ${allBusinesses.size} businesses`);
          break;
        }

        await delay(800);
        retries++;
      }

      if (!newResultsDetected) break;

    } catch (error) {
      safeLog('ERROR', 'Pagination failed', error.message);
      break;
    }
  }

  return allBusinesses.size;
}

function findNextButton() {
  const selectors = [
    'a#pnnext',
    'a[aria-label*="Next"]',
    'a[aria-label*="next"]',
    'a[href*="start="]',
    'td.d6cvqb a',
    '[role="navigation"] a[aria-label*="Next"]'
  ];

  for (const selector of selectors) {
    try {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) return button;
    } catch (e) {
      continue;
    }
  }

  const allLinks = document.querySelectorAll('a');
  for (const link of allLinks) {
    const text = link.textContent.toLowerCase().trim();
    const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
    if ((text.includes('next') || ariaLabel.includes('next') || text === '›') && link.offsetParent !== null) {
      return link;
    }
  }
  return null;
}

function isNextButtonDisabled(button) {
  if (!button) return true;
  if (button.hasAttribute('disabled')) return true;
  if (button.classList.contains('disabled')) return true;
  if (button.getAttribute('aria-disabled') === 'true') return true;
  if (button.style.pointerEvents === 'none') return true;
  if (button.style.display === 'none') return true;
  const href = button.getAttribute('href');
  if (!href || href === '#' || href === 'javascript:void(0)') return true;
  return false;
}

// ============================================
// ✅ BUSINESS MATCHING
// ============================================

function cleanName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchBusinessByPlaceId(placeId, results) {
  if (!placeId || placeId.length < 5) return null;
  const cleanPlaceId = String(placeId).trim().toLowerCase();
  for (let result of results) {
    if (result.placeId) {
      const resultPlaceId = String(result.placeId).toLowerCase();
      if (resultPlaceId === cleanPlaceId) {
        return { match: result, confidence: 100, method: 'place_id_exact' };
      }
      if (resultPlaceId.includes(cleanPlaceId) || cleanPlaceId.includes(resultPlaceId)) {
        return { match: result, confidence: 98, method: 'place_id_partial' };
      }
    }
  }
  return null;
}

function matchBusinessByName(targetName, results) {
  if (!targetName) return null;

  safeLog('INFO', `Matching: "${targetName}"`);
  const target = cleanName(targetName);
  const targetWords = target.split(' ').filter(w => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (let result of results) {
    const resultName = cleanName(result.name);

    if (resultName === target) {
      return { match: result, confidence: 100, method: 'exact_name' };
    }

    if (resultName.includes(target) && target.length > 10) {
      if (92 > bestScore) { bestMatch = result; bestScore = 92; }
    } else if (target.includes(resultName) && resultName.length > 10) {
      if (88 > bestScore) { bestMatch = result; bestScore = 88; }
    }

    const resultWords = resultName.split(' ').filter(w => w.length > 2);
    const matchedWords = targetWords.filter(word => resultWords.includes(word));
    const matchRatio = matchedWords.length / Math.max(targetWords.length, resultWords.length, 1);

    if (matchRatio >= 0.75) {
      const score = Math.round(matchRatio * 85);
      if (score > bestScore) { bestMatch = result; bestScore = score; }
    }
  }

  if (bestMatch && bestScore >= 75) {
    return { match: bestMatch, confidence: bestScore, method: 'fuzzy_name' };
  }

  return null;
}

// ============================================
// ✅ MAIN RANKING CHECK
// ============================================

async function checkBusinessRanking(businessName, placeId, keyword, location) {
  safeLog('INFO', '=== RANKING CHECK START ===');
  safeLog('INFO', 'Params', { businessName, placeId, keyword, location });

  const ready = await waitForResults();

  if (!ready) {
    return { success: false, error: 'Search results failed to load' };
  }

  safeLog('INFO', 'Loading additional pages...');
  await loadAllResultsViaPagination(CONFIG.MAX_PAGES_TO_CHECK);
  await delay(1000);

  const results = scrapeLocalResults();

  if (results.length === 0) {
    return {
      success: true,
      data: {
        found: false,
        totalChecked: 0,
        organicPosition: null,
        page: 1,
        confidence: 100,
        matchMethod: 'none',
        businessName, keyword,
        location: location || '',
        message: 'No business listings found',
        timestamp: Date.now()
      }
    };
  }

  let match = placeId ? matchBusinessByPlaceId(placeId, results) : null;
  if (!match) match = matchBusinessByName(businessName, results);

  if (match) {
    const page = Math.ceil(match.match.position / 20);
    safeLog('INFO', `✅ FOUND at #${match.match.position}!`);

    return {
      success: true,
      data: {
        found: true,
        totalChecked: results.length,
        organicPosition: match.match.position,
        page,
        confidence: match.confidence,
        matchMethod: match.method,
        businessName, keyword,
        location: location || '',
        matchedName: match.match.name,
        rating: match.match.rating,
        reviewCount: match.match.reviewCount,
        category: match.match.category,
        address: match.match.address,
        placeId: match.match.placeId,
        timestamp: Date.now()
      }
    };
  }

  return {
    success: true,
    data: {
      found: false,
      totalChecked: results.length,
      organicPosition: null,
      page: null,
      confidence: 100,
      matchMethod: 'none',
      businessName, keyword,
      location: location || '',
      message: `Searched ${results.length} but "${businessName}" not found`,
      timestamp: Date.now()
    }
  };
}

// ============================================
// ✅ MESSAGE LISTENER - ALL ACTIONS
// ============================================

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  safeLog('INFO', '📨 Message received:', request.action);

  try {

    // ✅ PING
    if (request.action === 'ping') {
      sendResponse({ ready: true, pageReady: isPageReady() });
      return false;
    }

    // ✅ CHECK READY
    if (request.action === 'checkReady') {
      sendResponse({ ready: isPageReady() });
      return false;
    }

    // ✅ NEW: extractBusinesses (called by updated service-worker)
    if (request.action === 'extractBusinesses') {
      safeLog('INFO', '📤 extractBusinesses called');

      (async () => {
        await waitForResults(5000);
        const businesses = scrapeLocalResults();

        safeLog('INFO', `📤 Returning ${businesses.length} businesses`);

        sendResponse({
          success: true,
          businesses,
          url: window.location.href,
          title: document.title,
          htmlLength: document.documentElement.outerHTML.length,
          debugCounts: {
            dataCid: document.querySelectorAll('[data-cid]').length,
            roleArticle: document.querySelectorAll('[role="article"]').length,
            rllt: document.querySelectorAll('.rllt__details').length,
            headings: document.querySelectorAll('[role="heading"]').length,
            mapsLinks: document.querySelectorAll('a[href*="/maps/place/"]').length
          }
        });
      })();

      return true; // Keep channel open for async
    }

    // ✅ startRankingCheck / scrapeRankings (existing - unchanged)
    if (request.action === 'startRankingCheck' || request.action === 'scrapeRankings') {
      (async () => {
        try {
          const result = await checkBusinessRanking(
            request.businessName,
            request.placeId || null,
            request.keyword,
            request.location || ''
          );
          safeLog('INFO', 'Ranking check result', {
            found: result.data?.found,
            position: result.data?.organicPosition
          });
          sendResponse(result);
        } catch (error) {
          safeLog('ERROR', 'Check failed', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    return false;

  } catch (error) {
    safeLog('ERROR', 'Handler error', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

safeLog('INFO', '✓ All message listeners registered');

// ============================================
// ✅ DEBUG MODE
// ============================================

window.DEBUG_GMB = {
  getAllBusinessCards,
  extractBusinessName,
  extractPlaceId,
  extractRating,
  extractReviewCount,
  extractCategory,
  extractAddress,
  isPageReady,
  scrapeLocalResults,
  cleanName,
  matchBusinessByName,
  matchBusinessByPlaceId,
  checkBusinessRanking,
  getCurrentPageFromURL,
  loadAllResultsViaPagination
};

console.log('✅ GMB CONTENT SCRIPT v5.0 READY');
console.log('🔧 Debug: window.DEBUG_GMB.scrapeLocalResults()');
