// Background Service Worker for GMB Ranking Tracker Pro v6.1 - HISTORICAL TRACKING
'use strict';

console.log('🚀 GMB Service Worker v6.1 Started - Historical Rank Tracking! 🚀');

// ============================================
// 🧠 VISIBLE WINDOW CONFIG
// ============================================

const CONFIG = {
  MAX_SERVICE_WORKER_LIFETIME: 25000,
  
  // ✅ INCREASED DELAYS - Anti-CAPTCHA
  MIN_DELAY_BETWEEN_REQUESTS: 45000,   // 20000 → 45 seconds min
  MAX_DELAY_BETWEEN_REQUESTS: 90000,   // 35000 → 90 seconds max
  
  MAX_RETRIES: 2,
  FETCH_TIMEOUT: 60000,
  MAX_RESULTS_TO_CHECK: 100,
  RESULTS_PER_PAGE: 20,
  
  // ✅ HUMAN BEHAVIOR - More realistic timing
  HUMAN_READING_TIME_MIN: 12000,       // 8000 → 12 seconds
  HUMAN_READING_TIME_MAX: 22000,       // 15000 → 22 seconds
  INITIAL_WARMUP_DELAY: 20000,         // 10000 → 20 seconds
  
  // ✅ SESSION MANAGEMENT - Shorter sessions, longer breaks
  SESSION_MAX_REQUESTS: 6,             // 12 → 6 requests per session
  SESSION_BREAK_MIN: 300000,           // 180000 → 5 minutes
  SESSION_BREAK_MAX: 600000,           // 360000 → 10 minutes
  
  // ✅ BATCH SETTINGS - NEW
  BATCH_SIZE: 3,                       // Keywords per batch before break
  BATCH_BREAK_MIN: 120000,             // 2 min between batches
  BATCH_BREAK_MAX: 240000,             // 4 min between batches
  
  // ✅ VISIBLE WINDOW SETTINGS
  USE_INCOGNITO: false,
  SHOW_WINDOW_VISIBLE: true,
  WINDOW_STATE: 'normal',
  FOCUS_WINDOW: false,
  CLOSE_TAB_AFTER_SEARCH: true,
  TAB_CLOSE_DELAY: 3000,
  CLOSE_INCOGNITO_WINDOW: true,
  
  // ✅ CAPTCHA SETTINGS
  ENABLE_MANUAL_CAPTCHA: true,
  CAPTCHA_DETECTION_TIMEOUT: 5000,
  CAPTCHA_SOLVE_TIMEOUT: 300000,
  SHOW_WINDOW_ON_CAPTCHA: true,
  PAUSE_ON_CAPTCHA: true,
  
  // ✅ HUMAN SIMULATION - NEW
  ENABLE_MOUSE_SIMULATION: true,       // Simulate mouse movements
  ENABLE_SCROLL_SIMULATION: true,      // Simulate random scrolling
  MOUSE_MOVE_ACTIONS: 4,               // How many mouse moves per page
  SCROLL_SIMULATION_DELAY: 6000,       // Wait after scroll simulation
  
  // ✅ URL RANDOMIZATION - NEW
  RANDOMIZE_URL_PARAMS: true,          // Add random params to avoid pattern
  ALTERNATE_DOMAINS: true,             // Rotate between google.co.in / google.com
  DISABLE_PERSONALIZATION: true,       // Add pws=0 param
  
  // ✅ USER AGENT ROTATION - NEW
  ROTATE_USER_AGENT: true,             // Rotate user agents per request
  INJECT_ANTI_WEBDRIVER: true,         // Remove navigator.webdriver flag
  
  // ✅ SEARCH MODE
  SEARCH_MODE: 'local'                 // 'local' or 'web'
};

// Session state
let currentSession = {
  id: null,
  requestCount: 0,
  startTime: null
};

// Persistent state
let bulkOperationInProgress = false;
let bulkQueue = [];
let processedCount = 0;
let activeIncognitoWindows = new Set();
let activeSearchTabs = new Set();
let captchaSolvingInProgress = false;
let currentCaptchaWindow = null;

function log(level, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${level}] ${timestamp}:`, message, data || '');
}

log('INFO', 'Service worker initialized - Local Search Mode with Historical Tracking v6.1');

// ============================================
// 🧠 HUMAN BEHAVIOR FUNCTIONS
// ============================================

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

async function simulateHumanDelay(action = 'reading') {
  let delay;
  switch(action) {
    case 'reading':
      delay = randomBetween(CONFIG.HUMAN_READING_TIME_MIN, CONFIG.HUMAN_READING_TIME_MAX);
      log('DEBUG', `👤 Reading time: ${Math.round(delay/1000)}s`);
      break;
    case 'scrolling':
      delay = randomBetween(2000, 4000);
      log('DEBUG', `👤 Scrolling: ${Math.round(delay/1000)}s`);
      break;
    default:
      delay = randomBetween(3000, 6000);
  }
  await new Promise(resolve => setTimeout(resolve, delay));
}

function initializeSession() {
  currentSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    requestCount: 0,
    startTime: Date.now()
  };
  log('INFO', `🔐 New session: ${currentSession.id}`);
}

function shouldTakeSessionBreak() {
  // ✅ Check request count
  if (currentSession.requestCount >= CONFIG.SESSION_MAX_REQUESTS) {
    return true;
  }
  
  // ✅ Check session age (max 30 min per session)
  const sessionAge = Date.now() - currentSession.startTime;
  if (sessionAge > 30 * 60 * 1000) {
    return true;
  }
  
  return false;
}

async function takeSessionBreak() {
  const breakDuration = randomBetween(CONFIG.SESSION_BREAK_MIN, CONFIG.SESSION_BREAK_MAX);
  log('INFO', `☕ Session break: ${Math.round(breakDuration / 60000)} minutes`);

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '☕ Taking a Break',
    message: `${Math.round(breakDuration / 60000)} min break to avoid detection...`
  }).catch(() => {});

  await new Promise(resolve => setTimeout(resolve, breakDuration));

  // ✅ RESET SESSION AFTER BREAK - this was the bug!
  initializeSession();
  log('INFO', `✅ Session reset after break: ${currentSession.id}`);
}

// ✅ NEW: Force reset session without waiting (call when extension reloads)
function forceResetSession() {
  log('INFO', '🔄 Force resetting session...');
  initializeSession();
}

// ============================================
// 📊 NEW: SAVE RANKING WITH HISTORY v6.1
// ============================================

async function saveRankingWithHistory(businessName, placeId, keyword, location, position, pageNumber, confidence) {
  try {
    // Create consistent storage key (no timestamp in key)
    const sanitizedBusiness = businessName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const sanitizedKeyword = keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const historyKey = `ranking_history_${sanitizedBusiness}_${sanitizedKeyword}`;
    
    log('INFO', '📊 Saving ranking with history:', historyKey);
    
    // Get existing history
    const existing = await chrome.storage.local.get(historyKey);
    const historyData = existing[historyKey] || {
      businessName,
      placeId,
      keyword,
      location,
      history: [],
      firstChecked: Date.now()
    };
    
    // Create new record
    const newRecord = {
      position: position || null,
      page: pageNumber || null,
      confidence: confidence || 100,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    // Add to history
    historyData.history.push(newRecord);
    
    // Calculate trend (compare with previous check)
    if (historyData.history.length > 1) {
      const latest = historyData.history[historyData.history.length - 1];
      const previous = historyData.history[historyData.history.length - 2];
      
      historyData.latestPosition = latest.position;
      historyData.previousPosition = previous.position;
      
      if (latest.position && previous.position) {
        historyData.change = previous.position - latest.position; // Positive = improvement
        
        if (historyData.change > 0) {
          historyData.trend = 'up';
        } else if (historyData.change < 0) {
          historyData.trend = 'down';
        } else {
          historyData.trend = 'same';
        }
      }
    } else {
      historyData.latestPosition = newRecord.position;
      historyData.trend = 'new';
    }
    
    // Update metadata
    historyData.lastChecked = Date.now();
    historyData.confidence = confidence || 100;
    historyData.page = pageNumber || null;
    historyData.location = location; // Update location in case it changed
    
    // Save updated history
    await chrome.storage.local.set({
      [historyKey]: historyData
    });
    
    log('INFO', '✅ Ranking saved with history:', {
      keyword,
      position,
      historyLength: historyData.history.length,
      trend: historyData.trend
    });
    
    return { success: true, historyKey, trend: historyData.trend };
    
  } catch (error) {
    log('ERROR', '❌ Failed to save ranking with history:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// STATE MANAGEMENT
// ============================================

async function restoreState() {
  try {
    const session = await chrome.storage.session.get(['bulkState']);
    if (session.bulkState) {
      bulkOperationInProgress = session.bulkState.inProgress || false;
      processedCount = session.bulkState.processedCount || 0;
      log('INFO', 'Restored state', session.bulkState);
    }
  } catch (error) {
    log('WARN', 'Could not restore state', error.message);
  }
}

async function saveState() {
  try {
    await chrome.storage.session.set({
      bulkState: {
        inProgress: bulkOperationInProgress,
        processedCount: processedCount,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    log('WARN', 'Could not save state', error.message);
  }
}

async function checkIncognitoAccess() {
  return new Promise((resolve) => {
    chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
      if (!isAllowed && CONFIG.USE_INCOGNITO) {
        log('WARN', '⚠️ Incognito access not enabled!');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '⚠️ Enable Incognito Access',
          message: 'Go to chrome://extensions/ → GMB Tracker → Enable "Allow in incognito"'
        }).catch(() => {});
      }
      resolve(isAllowed);
    });
  });
}

restoreState();
initializeSession();

// ============================================
// SIDE PANEL SUPPORT
// ============================================

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    log('INFO', 'Side panel opened');
  } catch (error) {
    log('ERROR', 'Failed to open side panel', error.message);
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'GMB Ranking Tracker',
        message: 'Look for the side panel on the right.'
      });
    } catch (e) {}
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  
  if (tab.url && (
    tab.url.includes('google.com/search') ||
    tab.url.includes('google.co.in/search') ||
    tab.url.includes('google.com/maps')
  )) {
    try {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'popup/popup.html',
        enabled: true
      });
    } catch (e) {}
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('INFO', 'Message received', { action: request.action });

  try {
    if (request.action === 'contentScriptReady') {
      sendResponse({ success: true, message: 'Acknowledged' });
      return false;
    }

    if (request.action === 'quickRankingCheck') {
      handleQuickRankingCheck(request.data, sendResponse);
      return true;
    }

    if (request.action === 'bulkRankingCheck') {
      handleBulkRankingCheck(request.data, sendResponse);
      return true;
    }

    if (request.action === 'cancelBulk') {
      handleCancelBulk(sendResponse);
      return true;
    }

    if (request.action === 'exportCSV') {
      handleExportCSV(sendResponse);
      return true;
    }

    if (request.action === 'getStats') {
      handleGetStats(sendResponse);
      return true;
    }

    if (request.action === 'startQuickTrack') {
      handleQuickTrack(request.data, sendResponse);
      return true;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;

  } catch (error) {
    log('ERROR', 'Error handling message', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

function sendLiveProgress(data) {
  try {
    chrome.runtime.sendMessage({ action: 'liveProgress', data: data });
  } catch (e) {}
}

// ============================================
// 🚀 QUICK TRACK HANDLER - WITH HISTORY
// ============================================

async function handleQuickTrack(data, sendResponse) {
  const { businessName, placeId, keyword, location } = data;

  log('INFO', '🚀 Quick Track started', { businessName, placeId, keyword, location });

  // ✅ Respond immediately - prevents options page timeout
  try { sendResponse({ success: true, message: 'Quick Track started' }); } catch(e) {}

  try {
    if (!businessName || !keyword) {
      throw new Error('Missing required data for Quick Track');
    }

    const searchQuery = keyword + (location ? ' ' + location : '');
    let allBusinesses = [];
    let currentPage = 1;
    let foundMatch = null;
    const maxPages = 2;

    log('INFO', '🔍 Starting Quick Track search...');

    // ✅ Session check
    if (typeof shouldTakeSessionBreak === 'function' && shouldTakeSessionBreak()) {
      log('INFO', '☕ Session limit reached, taking break...');
      await takeSessionBreak();
    }

    // ✅ Warmup delay
    const warmupDelay = randomBetween(CONFIG.INITIAL_WARMUP_DELAY, CONFIG.INITIAL_WARMUP_DELAY * 1.5);
    log('INFO', `👤 Quick Track warmup: ${Math.round(warmupDelay / 1000)}s`);

    try {
      chrome.runtime.sendMessage({
        action: 'liveProgress',
        data: { status: 'warming_up', message: `⏳ Warming up ${Math.round(warmupDelay / 1000)}s before search...`, keyword }
      }).catch(() => {});
    } catch(e) {}

    await new Promise(resolve => setTimeout(resolve, warmupDelay));

    while (!foundMatch && currentPage <= maxPages) {
      log('INFO', `📄 Quick Track - Checking page ${currentPage}`);

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: { status: 'searching', message: `🔍 Searching page ${currentPage}...`, currentPage, keyword }
        }).catch(() => {});
      } catch(e) {}

      const start = (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;

      const { windowId, tabId } = await createVisibleIncognitoWindow(searchQuery, start);
      await simulateHumanDelay('reading');
      const html = await getHTMLFromTabWithCaptchaCheck(tabId, windowId, keyword);
      await closeIncognitoWindow(windowId);

      currentSession.requestCount++;
      log('DEBUG', `📊 Session requests: ${currentSession.requestCount}/${CONFIG.SESSION_MAX_REQUESTS}`);

      const pageBusinesses = extractBusinessesFromHTML(html, 'quick');

      if (pageBusinesses.length === 0) {
        log('WARN', `⚠️ No businesses found on page ${currentPage}, stopping`);
        try {
          chrome.runtime.sendMessage({
            action: 'liveProgress',
            data: { status: 'no_results', message: `⚠️ No businesses found on page ${currentPage}`, currentPage, keyword }
          }).catch(() => {});
        } catch(e) {}
        break;
      }

      const adjustedBusinesses = pageBusinesses.map(b => {
        const absolutePosition = b.position + (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;
        const correctPage = Math.ceil(absolutePosition / CONFIG.RESULTS_PER_PAGE);
        return { ...b, position: absolutePosition, page: correctPage };
      });

      allBusinesses = allBusinesses.concat(adjustedBusinesses);
      log('INFO', `📋 Page ${currentPage}: Found ${adjustedBusinesses.length} businesses (total: ${allBusinesses.length})`);

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'found_results',
            message: `Found ${adjustedBusinesses.length} businesses on page ${currentPage}`,
            currentPage,
            totalBusinesses: allBusinesses.length,
            businesses: allBusinesses
          }
        }).catch(() => {});
      } catch(e) {}

      const match = findBusinessMatch(adjustedBusinesses, businessName, placeId);
      if (match) {
        foundMatch = match;
        log('INFO', `✅ Quick Track FOUND at position #${match.position}`);

        try {
          chrome.runtime.sendMessage({
            action: 'liveProgress',
            data: {
              status: 'found',
              message: `✅ Found at position #${match.position}`,
              currentPage,
              totalBusinesses: allBusinesses.length,
              businesses: allBusinesses,
              foundMatch: match
            }
          }).catch(() => {});
        } catch(e) {}

        break;
      }

      if (currentPage < maxPages) {
        const pageDelay = randomBetween(8000, 15000);
        log('DEBUG', `⏳ Page delay: ${Math.round(pageDelay / 1000)}s before next page`);

        try {
          chrome.runtime.sendMessage({
            action: 'liveProgress',
            data: {
              status: 'page_delay',
              message: `⏳ Waiting ${Math.round(pageDelay / 1000)}s before page ${currentPage + 1}...`,
              currentPage,
              totalBusinesses: allBusinesses.length
            }
          }).catch(() => {});
        } catch(e) {}

        await new Promise(resolve => setTimeout(resolve, pageDelay));
      }

      currentPage++;
    }

    // ✅ Handle not found
    if (!foundMatch) {
      log('INFO', `❌ Quick Track: "${businessName}" not found in top ${allBusinesses.length} results`);

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'not_found',
            message: `❌ Not found in ${allBusinesses.length} results`,
            currentPage,
            totalBusinesses: allBusinesses.length,
            businesses: allBusinesses
          }
        }).catch(() => {});
      } catch(e) {}
    }

    // ✅ Save with history
    const saveResult = await saveRankingWithHistory(
      businessName,
      placeId,
      keyword,
      location,
      foundMatch ? foundMatch.position : null,
      foundMatch ? foundMatch.page : null,
      foundMatch ? foundMatch.confidence : 100
    );

    log('INFO', `💾 Saved: position=${foundMatch?.position}, trend=${saveResult?.trend}`);

    // ✅ Notification
    if (foundMatch) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '✅ Quick Track Complete!',
        message: `${businessName}\nKeyword: "${keyword}"\nPosition: #${foundMatch.position}\nTrend: ${saveResult?.trend || 'new'}`
      }).catch(() => {});
    } else {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '❌ Not Found',
        message: `${businessName}\nKeyword: "${keyword}"\nNot in top ${maxPages * CONFIG.RESULTS_PER_PAGE} results`
      }).catch(() => {});
    }

    // ✅ Notify options/popup
    chrome.runtime.sendMessage({
      action: 'quickTrackComplete',
      data: {
        found: !!foundMatch,
        position: foundMatch ? foundMatch.position : null,
        confidence: foundMatch ? foundMatch.confidence : null,
        trend: saveResult?.trend || 'new',
        keyword,
        businessName,
        totalChecked: allBusinesses.length
      }
    }).catch(() => {});

    log('INFO', '✅ Quick Track complete with history', {
      found: !!foundMatch,
      position: foundMatch?.position,
      trend: saveResult?.trend
    });

  } catch (error) {
    log('ERROR', 'Quick Track failed', error.message);

    try {
      chrome.runtime.sendMessage({
        action: 'liveProgress',
        data: { status: 'error', message: `❌ Error: ${error.message}`, keyword }
      }).catch(() => {});
    } catch(e) {}

    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '❌ Quick Track Failed',
      message: `Keyword: "${keyword}"\nError: ${error.message}`
    }).catch(() => {});

    chrome.runtime.sendMessage({
      action: 'quickTrackError',
      data: { error: error.message, keyword }
    }).catch(() => {});
  }
}

// ============================================
// ✅ CAPTCHA DETECTION
// ============================================

async function detectCaptcha(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        
        // ✅ LEVEL 1: DOM Element Checks
        const domChecks = [
          // reCAPTCHA iframes
          !!document.querySelector('iframe[src*="recaptcha"]'),
          !!document.querySelector('iframe[src*="google.com/recaptcha"]'),
          !!document.querySelector('iframe[src*="recaptcha.google.com"]'),
          
          // CAPTCHA containers
          !!document.querySelector('#captcha'),
          !!document.querySelector('.g-recaptcha'),
          !!document.querySelector('#recaptcha'),
          !!document.querySelector('[aria-label*="reCAPTCHA"]'),
          !!document.querySelector('[data-sitekey]'),
          !!document.querySelector('.recaptcha-checkbox'),
          !!document.querySelector('#recaptcha-anchor'),
          !!document.querySelector('div[class*="captcha"]'),
          !!document.querySelector('form[action*="captcha"]'),
          
          // Google specific CAPTCHA containers
          !!document.querySelector('#captcha-form'),
          !!document.querySelector('.captcha-container'),
          !!document.querySelector('[id*="captcha"]'),
          !!document.querySelector('input[name="captcha"]'),
        ];
        
        // ✅ LEVEL 2: Text Content Checks (body text)
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const titleText = (document.title || '').toLowerCase();
        const bodyHTML = (document.body?.innerHTML || '').toLowerCase();
        
        const textChecks = [
          // English patterns
          bodyText.includes('unusual traffic'),
          bodyText.includes("i'm not a robot"),
          bodyText.includes('verify you\'re not a robot'),
          bodyText.includes('please solve this captcha'),
          bodyText.includes('complete the security check'),
          bodyText.includes('confirm you\'re not a robot'),
          bodyText.includes('automated queries'),
          bodyText.includes('sending automated queries'),
          bodyText.includes('computer or network may be sending'),
          bodyText.includes('this page checks to see if it\'s really you'),
          bodyText.includes('blocked'),
          bodyText.includes('access denied'),
          bodyText.includes('why did this happen'),
          
          // Title checks
          titleText.includes('before you continue'),
          titleText.includes('captcha'),
          titleText.includes('unusual traffic'),
          titleText.includes('blocked'),
          titleText.includes('security check'),
          titleText.includes('verify'),
          
          // URL/HTML pattern checks
          bodyHTML.includes('recaptcha/api.js'),
          bodyHTML.includes('www.google.com/recaptcha'),
          bodyHTML.includes('recaptcha.net'),
          bodyHTML.includes('sorry/index'),
          bodyHTML.includes('ipv4/sorry'),
        ];
        
        // ✅ LEVEL 3: URL Checks
        const currentUrl = window.location.href.toLowerCase();
        const urlChecks = [
          currentUrl.includes('sorry/index'),
          currentUrl.includes('ipv4/sorry'),
          currentUrl.includes('/sorry?'),
          currentUrl.includes('google.com/sorry'),
          currentUrl.includes('accounts.google.com/v3/signin'),
        ];
        
        // ✅ LEVEL 4: Network/Script Checks
        const scriptChecks = [
          !!document.querySelector('script[src*="recaptcha"]'),
          !!document.querySelector('script[src*="recaptcha/api"]'),
        ];
        
        // Combine all checks
        const allChecks = [...domChecks, ...textChecks, ...urlChecks, ...scriptChecks];
        const hasCaptcha = allChecks.some(check => check === true);
        
        // ✅ Determine CAPTCHA type for better logging
        let captchaType = 'none';
        if (hasCaptcha) {
          if (currentUrl.includes('sorry')) {
            captchaType = 'google_sorry_page';
          } else if (document.querySelector('iframe[src*="recaptcha"]')) {
            captchaType = 'recaptcha_v2';
          } else if (document.querySelector('[data-sitekey]')) {
            captchaType = 'recaptcha_v3';
          } else if (bodyText.includes('unusual traffic')) {
            captchaType = 'unusual_traffic_block';
          } else if (titleText.includes('before you continue')) {
            captchaType = 'consent_gate';
          } else {
            captchaType = 'unknown_block';
          }
        }
        
        // ✅ Collect evidence for debugging
        const evidence = [];
        if (domChecks.some(c => c)) evidence.push('dom_elements_found');
        if (textChecks.some(c => c)) evidence.push('block_text_found');
        if (urlChecks.some(c => c)) evidence.push('sorry_url_detected');
        if (scriptChecks.some(c => c)) evidence.push('recaptcha_script_found');
        
        return {
          hasCaptcha,
          captchaType,
          evidence,
          pageTitle: document.title,
          pageUrl: window.location.href,
          htmlLength: document.documentElement.outerHTML.length,
          bodyTextSnippet: bodyText.substring(0, 200) // First 200 chars for debugging
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      const detection = results[0].result;
      
      if (detection.hasCaptcha) {
        log('WARN', `🤖 CAPTCHA detected!`, {
          type: detection.captchaType,
          evidence: detection.evidence,
          title: detection.pageTitle,
          url: detection.pageUrl
        });
      } else {
        log('DEBUG', '✅ No CAPTCHA detected', {
          title: detection.pageTitle,
          htmlLength: detection.htmlLength
        });
      }
      
      return detection;
    }
    
    return { hasCaptcha: false, captchaType: 'none', evidence: [] };
    
  } catch (error) {
    log('ERROR', 'CAPTCHA detection failed', error.message);
    // ✅ Return safe default - don't crash the flow
    return { hasCaptcha: false, captchaType: 'detection_error', evidence: [error.message] };
  }
}


// ============================================
// ✅ SHOW WINDOW FOR MANUAL CAPTCHA SOLVING
// ============================================

async function showWindowForCaptcha(windowId, keyword) {
  log('INFO', '🤖 CAPTCHA detected! Showing window for manual solving...');
  
  captchaSolvingInProgress = true;
  currentCaptchaWindow = windowId;
  
  await chrome.windows.update(windowId, {
    focused: true,
    state: 'normal',
    drawAttention: true
  });
  
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '🤖 CAPTCHA Detected!',
    message: `Please solve CAPTCHA for keyword: "${keyword}"\nYou have 5 minutes...`,
    requireInteraction: true,
    priority: 2
  });
  
  sendLiveProgress({
    status: 'captcha_detected',
    message: `🤖 CAPTCHA detected for "${keyword}". Please solve it manually...`,
    keyword: keyword
  });
  
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(async () => {
      try {
        const tabs = await chrome.tabs.query({ windowId: windowId });
        if (tabs.length === 0) {
          clearInterval(checkInterval);
          reject(new Error('Window closed'));
          return;
        }
        
        const tabId = tabs[0].id;
        const captchaStatus = await detectCaptcha(tabId);
        
        if (!captchaStatus.hasCaptcha) {
          clearInterval(checkInterval);
          captchaSolvingInProgress = false;
          currentCaptchaWindow = null;
          
          log('INFO', '✅ CAPTCHA solved!');
          
          await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: '✅ CAPTCHA Solved!',
            message: 'Continuing with ranking check...'
          });
          
          sendLiveProgress({
            status: 'captcha_solved',
            message: `✅ CAPTCHA solved! Continuing...`,
            keyword: keyword
          });
          
          resolve(true);
        }
        
        if (Date.now() - startTime > CONFIG.CAPTCHA_SOLVE_TIMEOUT) {
          clearInterval(checkInterval);
          captchaSolvingInProgress = false;
          currentCaptchaWindow = null;
          reject(new Error('CAPTCHA solve timeout'));
        }
      } catch (error) {
        clearInterval(checkInterval);
        captchaSolvingInProgress = false;
        currentCaptchaWindow = null;
        reject(error);
      }
    }, 2000);
  });
}

// ============================================
// ✅ CREATE VISIBLE WINDOW - LOCAL SEARCH
// ============================================

async function createVisibleIncognitoWindow(searchQuery, start = 0) {
  const searchUrl = `https://www.google.co.in/search?q=${encodeURIComponent(searchQuery)}&tbm=lcl&start=${start}`;
  
  log('INFO', `🗺️ Opening LOCAL search window: ${searchUrl}`);
  
  const hasAccess = await checkIncognitoAccess();
  
  if (!hasAccess && CONFIG.USE_INCOGNITO) {
    log('WARN', 'Incognito access denied, falling back to normal mode');
  }
  
  const window = await chrome.windows.create({
    url: searchUrl,
    incognito: CONFIG.USE_INCOGNITO && hasAccess,
    focused: CONFIG.FOCUS_WINDOW,
    state: CONFIG.WINDOW_STATE,
    width: 1200,
    height: 800,
    left: 100,
    top: 100
  });
  
  activeIncognitoWindows.add(window.id);
  
  if (window.tabs && window.tabs[0]) {
    activeSearchTabs.add(window.tabs[0].id);
    return { windowId: window.id, tabId: window.tabs[0].id };
  }
  
  throw new Error('Failed to create visible window');
}

// ============================================
// ✅ GET HTML - SIMPLE & RELIABLE
// ============================================

async function getHTMLFromTabWithCaptchaCheck(tabId, windowId, keyword) {
  try {
    log('DEBUG', '⏳ Waiting for page to load...');

    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!isReady && attempts < maxAttempts) {
      try {
        const tab = await chrome.tabs.get(tabId);

        if (tab.status === 'complete' && tab.url && !tab.url.includes('chrome://')) {

          // ✅ Safe anti-detection injection - never throws
          if (CONFIG.INJECT_ANTI_WEBDRIVER) {
            try {
              await injectAntiDetection(tabId);
            } catch(e) {
              // Non-critical - continue
            }
          }

          isReady = true;
          log('DEBUG', `✅ Page ready: ${tab.url}`);
          break;
        }

        log('DEBUG', `⏳ Loading... Status: ${tab.status}, Attempt: ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

      } catch (error) {
        log('ERROR', 'Tab access error', error.message);
        throw new Error('Tab was closed or inaccessible');
      }
    }

    if (!isReady) {
      throw new Error('Timeout: Page did not load in 60 seconds');
    }

    // ✅ Wait for full page render
    log('DEBUG', '⏳ Waiting for page rendering...');
    await new Promise(resolve => setTimeout(resolve, CONFIG.CAPTCHA_DETECTION_TIMEOUT || 3000));

    // ✅ Simulate human behavior
    if (CONFIG.ENABLE_MOUSE_SIMULATION || CONFIG.ENABLE_SCROLL_SIMULATION) {
      log('DEBUG', '👤 Simulating human page behavior...');
      try {
        await simulateHumanPageBehavior(tabId);
      } catch(e) {
        // Non-critical
      }
    }

    // ✅ CAPTCHA check
    log('DEBUG', '🔍 Checking for CAPTCHA...');
    let captchaStatus = { hasCaptcha: false };
    try {
      captchaStatus = await detectCaptcha(tabId);
    } catch(e) {
      log('WARN', 'CAPTCHA detection failed (non-critical)', e.message);
    }

    if (captchaStatus.hasCaptcha && CONFIG.ENABLE_MANUAL_CAPTCHA) {
      log('WARN', '🤖 CAPTCHA detected! Pausing for manual solve...');

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'captcha_detected',
            message: `🤖 CAPTCHA detected for "${keyword}". Please solve manually...`,
            keyword
          }
        }).catch(() => {});
      } catch(e) {}

      await showWindowForCaptcha(windowId, keyword);

      const postCaptchaDelay = randomBetween(5000, 10000);
      log('INFO', `✅ CAPTCHA solved! Waiting ${Math.round(postCaptchaDelay / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, postCaptchaDelay));

      try {
        await simulateHumanPageBehavior(tabId);
      } catch(e) {}

    } else if (!captchaStatus.hasCaptcha) {
      log('DEBUG', '✅ No CAPTCHA detected, proceeding...');
    }

    // ✅ Verify page still valid
    const currentTab = await chrome.tabs.get(tabId).catch(() => null);
    if (!currentTab || currentTab.url.includes('sorry/index')) {
      throw new Error('Google blocked request - "sorry" page detected');
    }

    // ✅ Try content script extraction first (most accurate)
    log('DEBUG', '📤 Trying content script extraction...');
    try {
      const msgResult = await chrome.tabs.sendMessage(tabId, { action: 'extractBusinesses' });
      if (msgResult && msgResult.success && msgResult.businesses && msgResult.businesses.length > 0) {
        log('INFO', `✅ Content script extracted ${msgResult.businesses.length} businesses`);
        log('DEBUG', `Debug counts: ${JSON.stringify(msgResult.debugCounts || {})}`);
        return JSON.stringify({ __preExtracted: true, businesses: msgResult.businesses });
      } else {
        log('WARN', `⚠️ Content script returned 0 businesses - falling back to HTML`);
        if (msgResult && msgResult.debugCounts) {
          log('DEBUG', `Debug counts: ${JSON.stringify(msgResult.debugCounts)}`);
        }
      }
    } catch(msgError) {
      log('WARN', '⚠️ Content script message failed - falling back to HTML', msgError.message);
    }

    // ✅ Fallback: Extract raw HTML
    log('DEBUG', 'Extracting HTML...');
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        html: document.documentElement.outerHTML,
        url: window.location.href,
        title: document.title,
        readyState: document.readyState
      })
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Could not extract HTML from page');
    }

    const { html, url, title } = results[0].result;
    log('DEBUG', `✅ Got HTML: ${html.length} chars | URL: ${url} | Title: ${title}`);

    if (html.length < 1000) {
      throw new Error(`Page HTML too short (${html.length} chars) - possible block`);
    }

    // ✅ Detect Google block page
    if (
      html.includes('our systems have detected unusual traffic') ||
      html.includes('sorry/index') ||
      html.includes('recaptcha/api.js') ||
      title.includes('Before you continue')
    ) {
      log('WARN', '🚫 Google block page detected in HTML!');

      if (CONFIG.ENABLE_MANUAL_CAPTCHA) {
        try {
          chrome.runtime.sendMessage({
            action: 'liveProgress',
            data: {
              status: 'captcha_detected',
              message: `🚫 Google block detected for "${keyword}". Solve CAPTCHA...`,
              keyword
            }
          }).catch(() => {});
        } catch(e) {}

        await showWindowForCaptcha(windowId, keyword);
        await new Promise(resolve => setTimeout(resolve, 5000));

        log('INFO', '🔄 Retrying HTML extraction after CAPTCHA solve...');
        const retryResults = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.documentElement.outerHTML
        });

        if (retryResults && retryResults[0] && retryResults[0].result) {
          log('INFO', `✅ Retry successful: ${retryResults[0].result.length} chars`);
          return retryResults[0].result;
        }
      }

      throw new Error('Google blocked request - CAPTCHA page detected');
    }

    return html;

  } catch (error) {
    log('ERROR', 'Failed to get HTML', error.message);
    throw error;
  }
}

// ============================================
// ✅ CLOSE WINDOW
// ============================================

async function closeIncognitoWindow(windowId) {
  if (CONFIG.CLOSE_INCOGNITO_WINDOW) {
    await new Promise(resolve => setTimeout(resolve, CONFIG.TAB_CLOSE_DELAY));
    try {
      await chrome.windows.remove(windowId);
      activeIncognitoWindows.delete(windowId);
      log('DEBUG', `🗑️ Closed window: ${windowId}`);
    } catch (error) {
      log('WARN', `Could not close window ${windowId}`);
    }
  }
}

// ============================================
// SINGLE MODE WITH VISIBLE WINDOW - WITH HISTORY
// ============================================

async function handleQuickRankingCheck(data, sendResponse) {
  const { businessName, placeId, keyword, location } = data;

  log('INFO', '🔍 Starting ranking check (LOCAL SEARCH)', { businessName, keyword });

  try {
    if (typeof shouldTakeSessionBreak === 'function' && shouldTakeSessionBreak()) {
      await takeSessionBreak();
    }

    const searchQuery = keyword + (location ? ' ' + location : '');
    let allBusinesses = [];
    let currentPage = 1;
    let foundMatch = null;

    try {
      chrome.runtime.sendMessage({
        action: 'liveProgress',
        data: {
          status: 'searching',
          message: 'Starting local search...',
          currentPage: 0,
          totalBusinesses: 0,
          businesses: []
        }
      }).catch(() => {});
    } catch(e) {}

    while (!foundMatch && allBusinesses.length < CONFIG.MAX_RESULTS_TO_CHECK) {
      log('INFO', `📄 Checking page ${currentPage}`);

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'checking_page',
            message: `Checking page ${currentPage} of local results...`,
            currentPage,
            totalBusinesses: allBusinesses.length,
            businesses: allBusinesses
          }
        }).catch(() => {});
      } catch(e) {}

      const start = (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;

      const { windowId, tabId } = await createVisibleIncognitoWindow(searchQuery, start);
      await simulateHumanDelay('reading');
      const html = await getHTMLFromTabWithCaptchaCheck(tabId, windowId, keyword);
      await closeIncognitoWindow(windowId);

      const pageBusinesses = extractBusinessesFromHTML(html, 'single');

      if (pageBusinesses.length === 0) {
        log('WARN', `⚠️ No businesses found on page ${currentPage}, stopping`);
        break;
      }

      const adjustedBusinesses = pageBusinesses.map(b => {
        const absolutePosition = b.position + (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;
        const correctPage = Math.ceil(absolutePosition / CONFIG.RESULTS_PER_PAGE);
        return { ...b, position: absolutePosition, page: correctPage };
      });

      allBusinesses = allBusinesses.concat(adjustedBusinesses);
      log('INFO', `📋 Page ${currentPage}: ${adjustedBusinesses.length} businesses (total: ${allBusinesses.length})`);

      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'found_results',
            message: `Found ${adjustedBusinesses.length} local businesses`,
            currentPage,
            totalBusinesses: allBusinesses.length,
            businesses: allBusinesses,
            latestPage: adjustedBusinesses
          }
        }).catch(() => {});
      } catch(e) {}

      const match = findBusinessMatch(adjustedBusinesses, businessName, placeId);
      if (match) {
        foundMatch = match;
        log('INFO', `✅ FOUND at position #${match.position}`);

        try {
          chrome.runtime.sendMessage({
            action: 'liveProgress',
            data: {
              status: 'found',
              message: `✅ FOUND at #${match.position}`,
              currentPage,
              totalBusinesses: allBusinesses.length,
              businesses: allBusinesses,
              foundMatch: match
            }
          }).catch(() => {});
        } catch(e) {}

        break;
      }

      await new Promise(resolve => setTimeout(resolve, randomBetween(5000, 10000)));
      currentPage++;
    }

    if (!foundMatch && allBusinesses.length > 0) {
      try {
        chrome.runtime.sendMessage({
          action: 'liveProgress',
          data: {
            status: 'not_found',
            message: `❌ Not found in ${allBusinesses.length} results`,
            currentPage,
            totalBusinesses: allBusinesses.length,
            businesses: allBusinesses
          }
        }).catch(() => {});
      } catch(e) {}
    }

    // ✅ Save with history
    const saveResult = await saveRankingWithHistory(
      businessName,
      placeId,
      keyword,
      location,
      foundMatch ? foundMatch.position : null,
      foundMatch ? foundMatch.page : null,
      foundMatch ? foundMatch.confidence : 100
    );

    log('INFO', `💾 Saved: position=${foundMatch?.position}, trend=${saveResult?.trend}`);

    // ✅ Notification
    try {
      if (foundMatch) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '✅ Business Found!',
          message: `Keyword: "${keyword}"\nRank #${foundMatch.position}\n"${foundMatch.name}"\nTrend: ${saveResult?.trend || 'new'}`
        }).catch(() => {});
      } else {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '❌ Not Found',
          message: `Keyword: "${keyword}"\n"${businessName}" not found in top ${allBusinesses.length} results`
        }).catch(() => {});
      }
    } catch(e) {}

    // ✅ Notify options/popup
    try {
      chrome.runtime.sendMessage({
        action: 'rankingCheckComplete',
        data: {
          found: !!foundMatch,
          position: foundMatch ? foundMatch.position : null,
          confidence: foundMatch ? foundMatch.confidence : null,
          trend: saveResult?.trend || 'new',
          keyword,
          businessName,
          totalChecked: allBusinesses.length
        }
      }).catch(() => {});
    } catch(e) {}

    sendResponse({
      success: true,
      data: {
        found: !!foundMatch,
        position: foundMatch ? foundMatch.position : null,
        trend: saveResult?.trend || 'new'
      }
    });

  } catch (error) {
    log('ERROR', 'Check failed', error.message);

    try {
      chrome.runtime.sendMessage({
        action: 'liveProgress',
        data: {
          status: 'error',
          message: `❌ Error: ${error.message}`,
          currentPage: 0,
          totalBusinesses: 0,
          businesses: []
        }
      }).catch(() => {});
    } catch(e) {}

    try { sendResponse({ success: false, error: error.message }); } catch(e) {}
  }
}

// ============================================
// BULK MODE WITH VISIBLE WINDOW - WITH HISTORY
// ============================================

async function handleBulkRankingCheck(data, sendResponse) {
  const { businessName, placeId, keywords, location } = data;
  
  log('INFO', '📦 Starting BULK (LOCAL SEARCH)', { 
    business: businessName,
    keywordCount: keywords.length 
  });

  if (bulkOperationInProgress) {
    sendResponse({ success: false, error: 'Bulk already in progress' });
    return;
  }

  bulkOperationInProgress = true;
  bulkQueue = keywords;
  processedCount = 0;
  await saveState();

  try {
    sendResponse({ success: true, message: 'Bulk started with local search' });

    const results = [];
    const startTime = Date.now();

    // ✅ Extended warmup delay
    const initialWarmup = randomBetween(
      CONFIG.INITIAL_WARMUP_DELAY,
      CONFIG.INITIAL_WARMUP_DELAY * 2
    );
    log('INFO', `👤 Warming up: ${Math.round(initialWarmup / 1000)}s`);

    sendLiveProgress({
      status: 'warming_up',
      message: `⏳ Warming up ${Math.round(initialWarmup / 1000)}s before bulk start...`,
      currentKeyword: 0,
      totalKeywords: keywords.length,
      processed: 0,
      ranked: 0
    });

    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🚀 Bulk Starting',
      message: `${keywords.length} keywords queued. Starting in ${Math.round(initialWarmup / 1000)}s...`
    }).catch(() => {});

    await new Promise(resolve => setTimeout(resolve, initialWarmup));

    // ✅ Reset session at bulk start
    initializeSession();

    for (let i = 0; i < keywords.length; i++) {

      // ✅ Cancelled check
      if (!bulkOperationInProgress) {
        log('INFO', '🛑 Bulk cancelled by user');
        break;
      }

      // ✅ BATCH BREAK - Every BATCH_SIZE keywords take longer rest
      if (i > 0 && i % CONFIG.BATCH_SIZE === 0) {
        const batchNum = Math.floor(i / CONFIG.BATCH_SIZE);
        const batchBreak = randomBetween(CONFIG.BATCH_BREAK_MIN, CONFIG.BATCH_BREAK_MAX);

        log('INFO', `🛑 Batch ${batchNum} complete. Break: ${Math.round(batchBreak / 60000)} min`);

        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: `☕ Batch ${batchNum} Complete`,
          message: `${i}/${keywords.length} done.\nResting ${Math.round(batchBreak / 60000)} min to avoid CAPTCHA...`
        }).catch(() => {});

        sendLiveProgress({
          status: 'batch_break',
          message: `☕ Batch ${batchNum} complete. Resting ${Math.round(batchBreak / 60000)} min (anti-CAPTCHA)...`,
          currentKeyword: i,
          totalKeywords: keywords.length,
          processed: processedCount,
          ranked: results.filter(r => r.found).length,
          batchNum,
          breakDuration: Math.round(batchBreak / 60000)
        });

        await new Promise(resolve => setTimeout(resolve, batchBreak));

        // ✅ Reset session after batch break
        initializeSession();
        log('INFO', `🔄 Session reset after batch ${batchNum} break`);
      }

      // ✅ Session break check
      if (shouldTakeSessionBreak()) {
        log('INFO', '☕ Session limit reached, taking session break...');

        sendLiveProgress({
          status: 'session_break',
          message: `☕ Session break (${currentSession.requestCount} requests done)...`,
          currentKeyword: i,
          totalKeywords: keywords.length,
          processed: processedCount,
          ranked: results.filter(r => r.found).length
        });

        await takeSessionBreak();
      }

      const keyword = keywords[i].trim();
      if (!keyword) {
        log('WARN', `Skipping empty keyword at index ${i}`);
        continue;
      }

      log('INFO', `\n📊 [${i + 1}/${keywords.length}] "${keyword}"`);

      // ✅ Notify progress with full details
      notifyProgress(i + 1, keywords.length, keyword);

      sendLiveProgress({
        status: 'checking_keyword',
        message: `🔍 [${i + 1}/${keywords.length}] Checking: "${keyword}"`,
        currentKeyword: i + 1,
        totalKeywords: keywords.length,
        keyword,
        processed: processedCount,
        ranked: results.filter(r => r.found).length
      });

      let retries = 0;
      let success = false;

      while (retries <= CONFIG.MAX_RETRIES && !success) {
        try {
          const searchQuery = keyword + (location ? ' ' + location : '');
          let allBusinesses = [];
          let currentPage = 1;
          let foundMatch = null;

          while (!foundMatch && allBusinesses.length < CONFIG.MAX_RESULTS_TO_CHECK) {

            // ✅ Cancelled mid-keyword check
            if (!bulkOperationInProgress) break;

            const start = (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;

            log('INFO', `📄 [${keyword}] Page ${currentPage} (start: ${start})`);

            sendLiveProgress({
              status: 'checking_page',
              message: `📄 "${keyword}" - Checking page ${currentPage}...`,
              currentKeyword: i + 1,
              totalKeywords: keywords.length,
              keyword,
              currentPage,
              processed: processedCount,
              ranked: results.filter(r => r.found).length
            });

            // ✅ Open window with randomized URL
            const { windowId, tabId } = await createVisibleIncognitoWindow(searchQuery, start);

            // ✅ Human reading delay
            await simulateHumanDelay('reading');

            // ✅ Get HTML with full anti-detection
            const html = await getHTMLFromTabWithCaptchaCheck(tabId, windowId, keyword);

            // ✅ Close window
            await closeIncognitoWindow(windowId);

            // ✅ Increment session counter
            currentSession.requestCount++;
            log('DEBUG', `📊 Session: ${currentSession.requestCount}/${CONFIG.SESSION_MAX_REQUESTS} requests`);

            const pageBusinesses = extractBusinessesFromHTML(html, 'bulk');

            if (pageBusinesses.length === 0) {
              log('WARN', `No businesses on page ${currentPage} for "${keyword}"`);
              break;
            }

            const adjustedBusinesses = pageBusinesses.map(b => {
              const absolutePosition = b.position + (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;
              const correctPage = Math.ceil(absolutePosition / CONFIG.RESULTS_PER_PAGE);
              return { ...b, position: absolutePosition, page: correctPage };
            });

            allBusinesses = allBusinesses.concat(adjustedBusinesses);

            // ✅ Deduplicate
            const seen = new Set();
            allBusinesses = allBusinesses.filter(b => {
              const key = b.placeId || cleanName(b.name);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            sendLiveProgress({
              status: 'found_results',
              message: `Found ${adjustedBusinesses.length} businesses on page ${currentPage}`,
              currentKeyword: i + 1,
              totalKeywords: keywords.length,
              keyword,
              currentPage,
              totalBusinesses: allBusinesses.length,
              businesses: allBusinesses,
              processed: processedCount,
              ranked: results.filter(r => r.found).length
            });

            const match = findBusinessMatch(adjustedBusinesses, businessName, placeId);
            if (match) {
              foundMatch = match;
              log('INFO', `✅ [${keyword}] Found at #${match.position} (confidence: ${match.confidence}%)`);

              sendLiveProgress({
                status: 'keyword_found',
                message: `✅ "${keyword}" → Position #${match.position}`,
                currentKeyword: i + 1,
                totalKeywords: keywords.length,
                keyword,
                position: match.position,
                confidence: match.confidence,
                processed: processedCount,
                ranked: results.filter(r => r.found).length + 1
              });

              break;
            }

            // ✅ Inter-page delay
            if (allBusinesses.length < CONFIG.MAX_RESULTS_TO_CHECK) {
              const pageDelay = randomBetween(8000, 15000);
              log('DEBUG', `⏳ Page delay: ${Math.round(pageDelay / 1000)}s`);
              await new Promise(resolve => setTimeout(resolve, pageDelay));
            }

            currentPage++;
          }

          // ✅ Not found on any page
          if (!foundMatch) {
            log('INFO', `❌ [${keyword}] Not found in ${allBusinesses.length} results`);

            sendLiveProgress({
              status: 'keyword_not_found',
              message: `❌ "${keyword}" → Not ranked in top ${allBusinesses.length}`,
              currentKeyword: i + 1,
              totalKeywords: keywords.length,
              keyword,
              processed: processedCount,
              ranked: results.filter(r => r.found).length
            });
          }

          // ✅ Save with history
          const saveResult = await saveRankingWithHistory(
            businessName,
            placeId,
            keyword,
            location,
            foundMatch ? foundMatch.position : null,
            foundMatch ? foundMatch.page : null,
            foundMatch ? foundMatch.confidence : 100
          );

          results.push({
            keyword,
            found: !!foundMatch,
            position: foundMatch ? foundMatch.position : null,
            confidence: foundMatch ? foundMatch.confidence : null,
            trend: saveResult.trend || 'new'
          });

          success = true;

        } catch (error) {
          log('ERROR', `Failed: "${keyword}"`, { retry: retries, error: error.message });
          retries++;

          if (retries <= CONFIG.MAX_RETRIES) {
            const retryDelay = 15000 * retries; // 15s, 30s per retry
            log('INFO', `🔄 Retry ${retries}/${CONFIG.MAX_RETRIES} in ${retryDelay / 1000}s...`);

            sendLiveProgress({
              status: 'retrying',
              message: `🔄 "${keyword}" failed. Retry ${retries}/${CONFIG.MAX_RETRIES} in ${retryDelay / 1000}s...`,
              currentKeyword: i + 1,
              totalKeywords: keywords.length,
              keyword,
              retryNum: retries
            });

            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            log('ERROR', `❌ "${keyword}" failed after all retries`);
            results.push({
              keyword,
              found: false,
              error: error.message,
              trend: 'error'
            });
          }
        }
      }

      processedCount++;
      await saveState();

      // ✅ Inter-keyword delay (skip after last keyword)
      if (i < keywords.length - 1 && bulkOperationInProgress) {
        const keywordDelay = randomBetween(
          CONFIG.MIN_DELAY_BETWEEN_REQUESTS,
          CONFIG.MAX_DELAY_BETWEEN_REQUESTS
        );
        log('DEBUG', `👤 Next keyword in: ${Math.round(keywordDelay / 1000)}s`);

        sendLiveProgress({
          status: 'keyword_delay',
          message: `⏳ Next keyword in ${Math.round(keywordDelay / 1000)}s...`,
          currentKeyword: i + 1,
          totalKeywords: keywords.length,
          processed: processedCount,
          ranked: results.filter(r => r.found).length,
          nextKeyword: keywords[i + 1] || null
        });

        await new Promise(resolve => setTimeout(resolve, keywordDelay));
      }
    }

    // ✅ Final summary
    const ranked = results.filter(r => r.found).length;
    const notRanked = results.filter(r => !r.found && !r.error).length;
    const errors = results.filter(r => r.error).length;
    const totalTime = Math.round((Date.now() - startTime) / 60000);

    log('INFO', `✅ Bulk complete: ${ranked} ranked | ${notRanked} not ranked | ${errors} errors | ${totalTime} min`);

    sendLiveProgress({
      status: 'bulk_complete',
      message: `✅ Done! ${ranked} ranked | ${notRanked} not ranked | ${errors} errors`,
      currentKeyword: keywords.length,
      totalKeywords: keywords.length,
      processed: processedCount,
      ranked,
      notRanked,
      errors,
      totalTime,
      results
    });

    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '✅ Bulk Complete!',
      message: `${ranked} ranked | ${notRanked} not ranked | ${errors} errors\nTime: ${totalTime} min`
    }).catch(() => {});

    chrome.runtime.sendMessage({
      action: 'bulkComplete',
      data: {
        total: results.length,
        ranked,
        notRanked,
        errors,
        totalTime,
        results
      }
    }).catch(() => {});

    bulkOperationInProgress = false;
    await saveState();

  } catch (error) {
    log('ERROR', 'Bulk failed', error);

    bulkOperationInProgress = false;
    await saveState();

    sendLiveProgress({
      status: 'bulk_error',
      message: `❌ Bulk failed: ${error.message}`,
      currentKeyword: 0,
      totalKeywords: keywords.length
    });

    chrome.runtime.sendMessage({
      action: 'bulkError',
      data: { error: error.message }
    }).catch(() => {});
  }
}

function extractBusinessesFromHTML(html, mode = 'single') {

  // ✅ CHECK 1: Pre-extracted from content script - USE DIRECTLY
  if (typeof html === 'string' && html.startsWith('{"__preExtracted":true')) {
    try {
      const data = JSON.parse(html);
      if (data.__preExtracted && Array.isArray(data.businesses) && data.businesses.length > 0) {
        log('INFO', `✅ Using pre-extracted businesses: ${data.businesses.length} (mode: ${mode})`);
        return data.businesses;
      }
    } catch(e) {
      log('WARN', 'Pre-extracted JSON parse failed, falling back to HTML parsing', e.message);
    }
  }

  // ✅ CHECK 2: Fallback HTML parsing
  const businesses = [];

  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Strategy 1: rllt__details
  const localPackPattern = /<div[^>]*class="[^"]*rllt__details[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let matches = [...html.matchAll(localPackPattern)];

  // Strategy 2: VkpGBb
  if (matches.length === 0) {
    const altPattern = /<div[^>]*class="[^"]*VkpGBb[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    matches = [...html.matchAll(altPattern)];
  }

  // Strategy 3: data-cid elements
  if (matches.length === 0) {
    const cidPattern = /<div[^>]*data-cid="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
    const cidMatches = [...html.matchAll(cidPattern)];
    if (cidMatches.length > 0) {
      log('DEBUG', `Found ${cidMatches.length} data-cid elements`);
      cidMatches.forEach((match, index) => {
        const cardHtml = match[2];
        const placeId = match[1];
        const name = extractNameFromCardHtml(cardHtml);
        if (name) {
          businesses.push({
            position: index + 1,
            name,
            placeId,
            rating: extractRatingFromCardHtml(cardHtml),
            reviewCount: extractReviewCountFromCardHtml(cardHtml),
            source: 'html_cid'
          });
        }
      });
      log('DEBUG', `Found ${businesses.length} local businesses via data-cid (${mode})`);
      return businesses;
    }
  }

  log('DEBUG', `Found ${matches.length} local businesses (${mode})`);

  matches.forEach((match, index) => {
    const cardHtml = match[1];
    const name = extractNameFromCardHtml(cardHtml);
    
    let placeId = null;
    const cidMatch = cardHtml.match(/data-cid="([^"]+)"/i);
    if (cidMatch) placeId = cidMatch[1];

    if (name) {
      businesses.push({
        position: index + 1,
        name,
        placeId,
        rating: extractRatingFromCardHtml(cardHtml),
        reviewCount: extractReviewCountFromCardHtml(cardHtml),
        source: 'local_search'
      });
    }
  });

  return businesses;
}

// ✅ HELPER: Extract name from card HTML
function extractNameFromCardHtml(cardHtml) {
  const namePatterns = [
    /<div[^>]*class="[^"]*OSrXXb[^"]*"[^>]*>(.*?)<\/div>/i,
    /<span[^>]*class="[^"]*OSrXXb[^"]*"[^>]*>(.*?)<\/span>/i,
    /<div[^>]*role="heading"[^>]*>(.*?)<\/div>/i,
    /<h3[^>]*class="[^"]*qBF1Pd[^"]*"[^>]*>(.*?)<\/h3>/i,
    /<div[^>]*class="[^"]*dbg0pd[^"]*"[^>]*>(.*?)<\/div>/i,
    /<div[^>]*class="[^"]*fontHeadlineSmall[^"]*"[^>]*>(.*?)<\/div>/i,
    /<span[^>]*class="[^"]*fontHeadlineSmall[^"]*"[^>]*>(.*?)<\/span>/i
  ];

  for (const pattern of namePatterns) {
    const nameMatch = cardHtml.match(pattern);
    if (nameMatch && nameMatch[1]) {
      const name = decodeHtml(nameMatch[1].replace(/<[^>]*>/g, '').trim());
      const cleaned = cleanBusinessName(name);
      if (cleaned.length > 2) return cleaned;
    }
  }
  return '';
}

// ✅ HELPER: Extract rating from card HTML
function extractRatingFromCardHtml(cardHtml) {
  const ratingPatterns = [
    /aria-label="([^"]*\d+\.?\d*)\s*star/i,
    /(\d+\.?\d*)\s*stars?/i,
    /(\d+\.?\d*)\s*<\/span>/
  ];
  for (const pattern of ratingPatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 5) return val;
    }
  }
  return null;
}

// ✅ HELPER: Extract review count from card HTML
function extractReviewCountFromCardHtml(cardHtml) {
  const reviewPatterns = [
    /\(([0-9,]+)\)/,
    /([0-9,]+)\s*reviews?/i,
    /reviews?[^>]*>([0-9,]+)</i
  ];
  for (const pattern of reviewPatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
  }
  return null;
}


// ============================================
// MATCHING
// ============================================

function findBusinessMatch(businesses, targetName, targetPlaceId) {
  if (businesses.length === 0) return null;
  
  const targetClean = cleanName(targetName);
  const targetFirstWord = targetClean.split(/\s+/)[0];
  
  if (targetPlaceId) {
    const placeIdMatch = businesses.find(b => b.placeId === targetPlaceId);
    if (placeIdMatch) {
      return { ...placeIdMatch, confidence: 100, method: 'place_id_exact' };
    }
  }
  
  const exactMatch = businesses.find(b => cleanName(b.name) === targetClean);
  if (exactMatch) {
    return { ...exactMatch, confidence: 95, method: 'name_exact' };
  }
  
  const firstWordMatches = businesses.filter(b => {
    const bClean = cleanName(b.name);
    const bFirstWord = bClean.split(/\s+/)[0];
    return bFirstWord === targetFirstWord;
  });
  
  if (firstWordMatches.length === 0) return null;
  
  const containsMatch = firstWordMatches.find(b => {
    const bClean = cleanName(b.name);
    return bClean.includes(targetClean) || targetClean.includes(bClean);
  });
  
  if (containsMatch) {
    return { ...containsMatch, confidence: 85, method: 'name_fuzzy' };
  }
  
  if (firstWordMatches.length === 1) {
    return { ...firstWordMatches[0], confidence: 80, method: 'name_fuzzy' };
  }
  
  return null;
}

function cleanBusinessName(name) {
  if (!name) return '';
  return name.replace(/Ꮇy Ad Centre.*$/i, '').replace(/\s*Ad\s*$/i, '').replace(/Sponsored/gi, '').replace(/·.*$/i, '').trim();
}

function cleanName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(html) {
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
  return html.replace(/&[#\w]+;/g, match => entities[match] || match);
}

// ============================================
// OTHER HANDLERS
// ============================================

async function handleCancelBulk(sendResponse) {
  bulkOperationInProgress = false;
  bulkQueue = [];
  processedCount = 0;
  captchaSolvingInProgress = false;
  currentCaptchaWindow = null;
  
  for (const windowId of activeIncognitoWindows) {
    try {
      await chrome.windows.remove(windowId);
    } catch (e) {}
  }
  activeIncognitoWindows.clear();
  activeSearchTabs.clear();
  
  await saveState();
  sendResponse({ success: true, message: 'Cancelled' });
}

async function handleExportCSV(sendResponse) {
  try {
    const data = await chrome.storage.local.get(null);
    const rankings = Object.values(data).filter(item => 
      item && item.history && Array.isArray(item.history) && item.businessName
    );

    if (rankings.length === 0) {
      sendResponse({ success: false, error: 'No data' });
      return;
    }

    let csv = 'Business Name,Place ID,Keyword,Location,Position,Page,Confidence,Trend,Date\n';
    
    rankings.forEach(r => {
      const latest = r.history[r.history.length - 1];
      csv += `"${escapeCsv(r.businessName)}","${escapeCsv(r.placeId || '')}","${escapeCsv(r.keyword)}","${escapeCsv(r.location || '')}",`;
      csv += `${latest.position || 'Not Found'},${latest.page || '1'},${latest.confidence}%,${r.trend || 'new'},"${new Date(latest.timestamp).toLocaleString()}"\n`;
    });

    chrome.runtime.sendMessage({
      action: 'downloadCSV',
      data: csv,
      filename: `gmb_rankings_${Date.now()}.csv`
    }).catch(() => {});

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetStats(sendResponse) {
  try {
    const data = await chrome.storage.local.get(null);
    const rankings = Object.values(data).filter(item => 
      item && item.history && Array.isArray(item.history) && item.businessName
    );

    const positions = rankings.map(r => {
      const latest = r.history[r.history.length - 1];
      return latest.position;
    }).filter(Boolean);

    const stats = {
      totalChecks: rankings.length,
      ranked: positions.length,
      notRanked: rankings.length - positions.length,
      avgPosition: positions.length > 0 ? Math.round(positions.reduce((a,b) => a+b, 0) / positions.length) : 0,
      lastCheck: rankings.length > 0 ? Math.max(...rankings.map(r => r.lastChecked)) : null
    };

    sendResponse({ success: true, data: stats });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// HELPERS
// ============================================

function notifyProgress(completed, total, currentKeyword) {
  chrome.runtime.sendMessage({
    action: 'bulkProgress',
    data: { completed, total, keyword: currentKeyword, percentage: Math.round((completed / total) * 100) }
  }).catch(() => {});
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

function escapeCsv(value) {
  if (!value) return '';
  return String(value).replace(/"/g, '""');
}

// ============================================
// 📦 MIGRATION: OLD DATA → HISTORICAL FORMAT
// ============================================

async function migrateOldRankingsToHistory() {
  try {
    log('INFO', '🔄 Starting migration to historical format...');
    
    const allData = await chrome.storage.local.get(null);
    const oldKeys = Object.keys(allData).filter(key => 
      key.startsWith('ranking_') && !key.startsWith('ranking_history_')
    );
    
    log('INFO', `Found ${oldKeys.length} old records to migrate`);
    
    if (oldKeys.length === 0) {
      log('INFO', '✅ No old records to migrate');
      return;
    }
    
    const historyMap = {};
    
    // Group old records by business+keyword
    for (const key of oldKeys) {
      const record = allData[key];
      if (!record.businessName || !record.keyword) continue;
      
      const sanitizedBusiness = record.businessName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const sanitizedKeyword = record.keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const historyKey = `ranking_history_${sanitizedBusiness}_${sanitizedKeyword}`;
      
      if (!historyMap[historyKey]) {
        historyMap[historyKey] = {
          businessName: record.businessName,
          placeId: record.placeId,
          keyword: record.keyword,
          location: record.location,
          history: [],
          firstChecked: record.timestamp
        };
      }
      
      historyMap[historyKey].history.push({
        position: record.organicPosition,
        page: record.page,
        confidence: record.confidence || 100,
        timestamp: record.timestamp,
        date: new Date(record.timestamp).toISOString()
      });
    }
    
    // Save consolidated history
    for (const [historyKey, historyData] of Object.entries(historyMap)) {
      // Sort by timestamp
      historyData.history.sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate trend
      if (historyData.history.length > 1) {
        const latest = historyData.history[historyData.history.length - 1];
        const previous = historyData.history[historyData.history.length - 2];
        
        historyData.latestPosition = latest.position;
        historyData.previousPosition = previous.position;
        
        if (latest.position && previous.position) {
          historyData.change = previous.position - latest.position;
          historyData.trend = historyData.change > 0 ? 'up' : historyData.change < 0 ? 'down' : 'same';
        }
      } else {
        historyData.latestPosition = historyData.history[0]?.position;
        historyData.trend = 'new';
      }
      
      historyData.lastChecked = historyData.history[historyData.history.length - 1].timestamp;
      historyData.confidence = historyData.history[historyData.history.length - 1].confidence;
      historyData.page = historyData.history[historyData.history.length - 1].page;
      
      await chrome.storage.local.set({ [historyKey]: historyData });
    }
    
    // Delete old records
    await chrome.storage.local.remove(oldKeys);
    
    log('INFO', `✅ Migration complete! Migrated ${Object.keys(historyMap).length} history records`);
    
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '✅ Data Migrated',
      message: `${Object.keys(historyMap).length} rankings converted to historical format`
    }).catch(() => {});
    
  } catch (error) {
    log('ERROR', '❌ Migration failed:', error.message);
  }
}

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🗺️ Local Search Mode v6.1!',
      message: 'Now with Historical Rank Tracking!'
    }).catch(() => {});
  }
  
  // Run migration on install/update
  migrateOldRankingsToHistory();
});

async function cleanupOldData() {
  try {
    const data = await chrome.storage.local.get(null);
    const cutoffDate = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const keysToDelete = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('ranking_history_') && value.lastChecked && value.lastChecked < cutoffDate) {
        keysToDelete.push(key);
      }
    }
    
    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
      log('INFO', 'Cleaned old data', { deleted: keysToDelete.length });
    }
  } catch (e) {}
}

cleanupOldData();

log('INFO', '✅ v6.1 Ready - 🗺️ Local Search + 📊 Historical Tracking! 🚀');


