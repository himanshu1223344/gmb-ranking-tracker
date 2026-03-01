// Detect and filter sponsored/ad listings
const AdDetector = {

  // Main function to check if a business card is an ad
  isAdListing(businessCard) {
    try {
      if (!businessCard) return false;

      // Method 1: Text-based detection
      if (this.hasAdText(businessCard)) return true;

      // Method 2: Attribute-based detection
      if (this.hasAdAttributes(businessCard)) return true;

      // Method 3: Local Service Ad detection
      if (this.isLocalServiceAd(businessCard)) return true;

      // Method 4: Sponsored pin detection
      if (this.hasSponsoredIndicator(businessCard)) return true;

      return false;

    } catch (error) {
      Helpers.log('ERROR', 'Ad detection failed', { msg: error.message });
      // If detection fails, treat as organic so ranking logic continues
      return false;
    }
  },

  // Check for "Sponsored" or "Ad" text
  hasAdText(card) {
    const textContent = (card.textContent || '').toLowerCase();

    const adKeywords = [
      'sponsored',
      'ad ',
      ' ad·',
      'promoted',
      'advertisement',
      'featured'
    ];

    return adKeywords.some(keyword => textContent.includes(keyword));
  },

  // Check for ad-related HTML attributes
  hasAdAttributes(card) {
    const adSelectors = [
      '[data-ad-slot]',
      '[data-ad-format]',
      '[data-sponsored="true"]',
      '.ads-ad',
      '.sponsored-result',
      '.promoted-listing'
    ];

    for (const selector of adSelectors) {
      if (card.querySelector(selector) || card.closest(selector)) {
        return true;
      }
    }
    return false;
  },

  // Check for Local Service Ads (LSA)
  isLocalServiceAd(card) {
    const textContent = (card.textContent || '').toLowerCase();

    const lsaIndicators = [
      'google screened',
      'google guaranteed',
      'local service ad',
      'lsa'
    ];

    return lsaIndicators.some(indicator => textContent.includes(indicator));
  },

  // Check for sponsored visual indicators
  hasSponsoredIndicator(card) {
    // Note: :contains() is not standard; avoid it
    const sponsoredSelectors = [
      '[aria-label*="Sponsored"]',
      '[aria-label*="Advertisement"]',
      '.sponsored-badge',
      '.ad-badge'
    ];

    for (const selector of sponsoredSelectors) {
      if (card.querySelector(selector)) {
        return true;
      }
    }

    // Fallback: small badge with "Ad" text
    const badgeCandidates = card.querySelectorAll('span, div');
    for (const el of badgeCandidates) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text === 'ad' || text === 'sponsored') {
        return true;
      }
    }

    return false;
  },

  // Filter array of cards to get only organic results
  filterOrganicResults(cards) {
    const organic = [];
    const ads = [];

    cards.forEach(card => {
      if (this.isAdListing(card)) {
        ads.push(card);
      } else {
        organic.push(card);
      }
    });

    Helpers.log('INFO', 'Filtered results', {
      total: cards.length,
      organic: organic.length,
      ads: ads.length
    });

    return { organic, ads };
  }
};
