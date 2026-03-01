// Main scraping logic for extracting business rankings
const Scraper = {
  
  // Detect which Google page we're on
  detectPageType() {
    const path = window.location.pathname;
    const url = window.location.href;
    
    if (path.includes('/maps')) {
      return 'maps';
    } else if (path.includes('/search') && url.includes('udm=1')) {
      return 'places_search';
    } else if (path.includes('/search')) {
      return 'web_search';
    }
    
    return 'unknown';
  },
  
  // Extract all business cards from current page
  async extractBusinessCards() {
    try {
      const pageType = this.detectPageType();
      Helpers.log('INFO', `Detected page type: ${pageType}`);
      
      // Wait for results to load
      await this.waitForResults(pageType);
      
      let cards;
      
      if (pageType === 'places_search') {
        // Google Search Places layout selectors
        cards = document.querySelectorAll('div[jsname][data-hveid][jsaction*="mouseover"]');
        
        // Fallback selectors for Places
        if (cards.length === 0) {
          cards = document.querySelectorAll('.rllt__link, .VkpGBb, div[data-cid]');
        }
      } else {
        // Google Maps selectors
        cards = document.querySelectorAll(CONFIG.SELECTORS.businessCard);
      }
      
      if (cards.length === 0) {
        Helpers.log('WARN', 'No business cards found on page');
        return [];
      }
      
      Helpers.log('INFO', `Found ${cards.length} business cards`);
      return Array.from(cards);
      
    } catch (error) {
      Helpers.log('ERROR', 'Failed to extract business cards', { error: error.message });
      return [];
    }
  },
  
  // Wait for Google results to load
  async waitForResults(pageType, timeout = CONFIG.PAGE_LOAD_TIMEOUT) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      let cards;
      
      if (pageType === 'places_search') {
        cards = document.querySelectorAll('div[jsname][data-hveid], .rllt__link, .VkpGBb');
      } else {
        cards = document.querySelectorAll(CONFIG.SELECTORS.businessCard);
      }
      
      if (cards.length > 0) {
        await Helpers.sleep(1000);
        return true;
      }
      
      await Helpers.sleep(500);
    }
    
    throw new Error('Timeout waiting for results to load');
  },
  
  // Extract data from a single business card
  extractBusinessData(card, index) {
    try {
      const pageType = this.detectPageType();
      
      const data = {
        index: index,
        businessName: this.extractBusinessName(card, pageType),
        placeId: this.extractPlaceId(card, pageType),
        rating: this.extractRating(card, pageType),
        reviewCount: this.extractReviewCount(card, pageType),
        category: this.extractCategory(card, pageType),
        address: this.extractAddress(card, pageType),
        phone: this.extractPhone(card, pageType),
        website: this.extractWebsite(card, pageType),
        isAd: AdDetector.isAdListing(card)
      };
      
      return data;
      
    } catch (error) {
      Helpers.log('ERROR', 'Failed to extract business data', { 
        error: error.message,
        index 
      });
      return null;
    }
  },
  
  // Extract business name
  extractBusinessName(card, pageType) {
    let selectors = [];
    
    if (pageType === 'places_search') {
      selectors = [
        'div[role="heading"]',
        'span[role="heading"]',
        '.OSrXXb',
        '.rllt__details > div:first-child',
        'h3',
        'span'
      ];
    } else {
      selectors = [
        CONFIG.SELECTORS.businessName,
        '.qBF1Pd',
        'h3',
        'h2',
        '[aria-label*="Business"]'
      ];
    }
    
    for (const selector of selectors) {
      const element = card.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return 'Unknown Business';
  },
  
  // Extract Place ID
  extractPlaceId(card, pageType) {
    if (pageType === 'places_search') {
      // Check data-cid attribute
      const cid = card.getAttribute('data-cid');
      if (cid) return cid;
      
      // Check link href
      const link = card.querySelector('a[href*="ludocid"], a[href*="lrd="]');
      if (link) {
        const href = link.getAttribute('href');
        return Helpers.extractPlaceIdFromUrl(href);
      }
    } else {
      const link = card.querySelector(CONFIG.SELECTORS.placeLink);
      
      if (link) {
        const href = link.getAttribute('href');
        return Helpers.extractPlaceIdFromUrl(href);
      }
      
      const cidElement = card.querySelector('[data-cid]');
      if (cidElement) {
        return cidElement.getAttribute('data-cid');
      }
    }
    
    return null;
  },
  
  // Extract rating
  extractRating(card, pageType) {
    if (pageType === 'places_search') {
      const ratingSpan = card.querySelector('span[aria-label*="star"], .Yi40Hd');
      
      if (ratingSpan) {
        const text = ratingSpan.textContent || ratingSpan.getAttribute('aria-label') || '';
        const match = text.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      }
    } else {
      const ratingElement = card.querySelector(CONFIG.SELECTORS.rating);
      
      if (ratingElement) {
        const ariaLabel = ratingElement.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/(\d+\.?\d*)\s*stars?/i);
        return match ? parseFloat(match[1]) : null;
      }
    }
    
    return null;
  },
  
  // Extract review count
  extractReviewCount(card, pageType) {
    if (pageType === 'places_search') {
      const reviewSpan = card.querySelector('span[aria-label*="review"]');
      
      if (reviewSpan) {
        const text = reviewSpan.textContent || reviewSpan.getAttribute('aria-label') || '';
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
    } else {
      const reviewElement = card.querySelector(CONFIG.SELECTORS.reviewCount);
      
      if (reviewElement) {
        const text = reviewElement.textContent || '';
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
    }
    
    return 0;
  },
  
  // Extract category
  extractCategory(card, pageType) {
    if (pageType === 'places_search') {
      const categoryElement = card.querySelector('.rllt__details > div:nth-child(2)');
      return categoryElement ? categoryElement.textContent.trim() : null;
    } else {
      const categoryElement = card.querySelector(CONFIG.SELECTORS.category);
      return categoryElement ? categoryElement.textContent.trim() : null;
    }
  },
  
  // Extract address
  extractAddress(card, pageType) {
    if (pageType === 'places_search') {
      const addressElement = card.querySelector('.rllt__details > div:last-child, span[class*="address"]');
      return addressElement ? addressElement.textContent.trim() : null;
    } else {
      const addressElement = card.querySelector(CONFIG.SELECTORS.address);
      return addressElement ? addressElement.textContent.trim() : null;
    }
  },
  
  // Extract phone
  extractPhone(card, pageType) {
    const phoneElement = card.querySelector(CONFIG.SELECTORS.phone);
    return phoneElement ? phoneElement.textContent.trim() : null;
  },
  
  // Extract website
  extractWebsite(card, pageType) {
    const websiteLink = card.querySelector('a[data-value="Website"]');
    return websiteLink ? websiteLink.getAttribute('href') : null;
  },
  
  // Find specific business and return its ranking
  async findBusinessRanking(targetBusinessName, targetPlaceId, maxPages = CONFIG.MAX_PAGES_TO_CHECK) {
    let organicPosition = 0;
    let currentPage = 1;
    let totalCardsChecked = 0;
    
    try {
      while (currentPage <= maxPages) {
        Helpers.log('INFO', `Scanning page ${currentPage}...`);
        
        const cards = await this.extractBusinessCards();
        
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          totalCardsChecked++;
          
          // Skip ads - don't count toward position
          if (AdDetector.isAdListing(card)) {
            Helpers.log('INFO', `Skipping ad at raw position ${totalCardsChecked}`);
            continue;
          }
          
          // Increment organic position counter
          organicPosition++;
          
          // Extract business data
          const businessData = this.extractBusinessData(card, organicPosition);
          
          if (!businessData) continue;
          
          // Check for match
          const matchResult = this.matchBusiness(
            businessData,
            targetBusinessName,
            targetPlaceId
          );
          
          if (matchResult.isMatch) {
            Helpers.log('INFO', `✓ Found ${targetBusinessName} at organic position ${organicPosition}`, {
              page: currentPage,
              confidence: matchResult.confidence
            });
            
            return {
              found: true,
              organicPosition: organicPosition,
              rawPosition: totalCardsChecked,
              page: currentPage,
              indexOnPage: i + 1,
              businessData: businessData,
              confidence: matchResult.confidence,
              matchMethod: matchResult.method
            };
          }
        }
        
        // Try to navigate to next page
        const hasNextPage = await PaginationHandler.navigateToNextPage();
        
        if (!hasNextPage) {
          Helpers.log('INFO', 'No more pages available');
          break;
        }
        
        currentPage++;
        
        // Random delay between pages
        await Helpers.sleep(Helpers.randomDelay(3000, 5000));
      }
      
      // Business not found
      Helpers.log('WARN', `Business not found in top ${organicPosition} organic results`);
      
      return {
        found: false,
        organicPosition: null,
        status: CONFIG.STATUS.NOT_FOUND,
        totalChecked: organicPosition,
        pagesScanned: currentPage
      };
      
    } catch (error) {
      Helpers.log('ERROR', 'Error during ranking search', { 
        error: error.message,
        page: currentPage 
      });
      
      return {
        found: false,
        error: error.message,
        status: CONFIG.STATUS.FAILED
      };
    }
  },
  
  // Match business using multiple methods
  matchBusiness(businessData, targetName, targetPlaceId) {
    // Method 1: Place ID match (100% accurate)
    if (targetPlaceId && businessData.placeId === targetPlaceId) {
      return {
        isMatch: true,
        confidence: 100,
        method: 'place_id'
      };
    }
    
    // Method 2: Fuzzy name match
    const nameMatch = Helpers.fuzzyMatch(
      Helpers.sanitizeName(businessData.businessName),
      Helpers.sanitizeName(targetName)
    );
    
    if (nameMatch >= CONFIG.FUZZY_MATCH_THRESHOLD) {
      return {
        isMatch: true,
        confidence: Math.round(nameMatch * 100),
        method: 'fuzzy_name'
      };
    }
    
    // Method 3: Exact name match (case-insensitive)
    if (Helpers.sanitizeName(businessData.businessName) === Helpers.sanitizeName(targetName)) {
      return {
        isMatch: true,
        confidence: 98,
        method: 'exact_name'
      };
    }
    
    return {
      isMatch: false,
      confidence: Math.round(nameMatch * 100),
      method: 'none'
    };
  },
  
  // Scroll to load more results (for infinite scroll interface)
  async scrollToLoadMore(container, maxScrolls = 10) {
    let scrollCount = 0;
    let previousHeight = 0;
    
    while (scrollCount < maxScrolls) {
      const currentHeight = container.scrollHeight;
      
      // No more content to load
      if (currentHeight === previousHeight) {
        break;
      }
      
      // Scroll to bottom
      container.scrollTo(0, currentHeight);
      
      await Helpers.sleep(CONFIG.SCROLL_DELAY);
      
      previousHeight = currentHeight;
      scrollCount++;
    }
    
    Helpers.log('INFO', `Scrolled ${scrollCount} times`);
  }
};
