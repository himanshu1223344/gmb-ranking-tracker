// lib/helpers.js - Utility functions and logging for GMB Ranking Tracker

const Helpers = {
  /**
   * Enhanced logging function with levels and structured data
   * @param {string} level - Log level: 'INFO', 'WARN', 'ERROR', 'DEBUG'
   * @param {string} message - Main log message
   * @param {object} data - Optional additional data to log
   */
  log: function(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[GMB-Tracker ${level}] ${timestamp}:`;
    
    if (level === 'ERROR') {
      console.error(prefix, message, data || '');
    } else if (level === 'WARN') {
      console.warn(prefix, message, data || '');
    } else if (level === 'DEBUG') {
      console.debug(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  },

  /**
   * Sanitize and normalize business names for comparison
   * @param {string} name - Business name to sanitize
   * @returns {string} Cleaned business name
   */
  sanitizeBusinessName: function(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  },

  /**
   * Extract domain from URL
   * @param {string} url - URL string
   * @returns {string} Domain name
   */
  extractDomain: function(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      this.log('WARN', 'Failed to extract domain from URL', { url, error: e.message });
      return '';
    }
  },

  /**
   * Format date for display
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate: function(date) {
    const d = date instanceof Date ? date : new Date(date);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return d.toLocaleDateString('en-US', options);
  },

  /**
   * Deep clone an object
   * @param {object} obj - Object to clone
   * @returns {object} Cloned object
   */
  deepClone: function(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      this.log('ERROR', 'Failed to deep clone object', e);
      return obj;
    }
  },

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  generateId: function() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Calculate fuzzy match score between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Match score (0-1)
   */
  fuzzyMatch: function(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = this.sanitizeBusinessName(str1);
    const s2 = this.sanitizeBusinessName(str2);
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Calculate Levenshtein distance
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - (distance / maxLen);
  },

  /**
   * Validate if string is a valid URL
   * @param {string} str - String to validate
   * @returns {boolean} True if valid URL
   */
  isValidUrl: function(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get storage data with error handling
   * @param {string|array} keys - Storage keys to retrieve
   * @returns {Promise<object>} Storage data
   */
  getStorage: async function(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (e) {
      this.log('ERROR', 'Failed to get storage', { keys, error: e.message });
      return {};
    }
  },

  /**
   * Set storage data with error handling
   * @param {object} data - Data to store
   * @returns {Promise<boolean>} Success status
   */
  setStorage: async function(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (e) {
      this.log('ERROR', 'Failed to set storage', { error: e.message });
      return false;
    }
  },

  /**
   * Send message to background/service worker
   * @param {object} message - Message object
   * @returns {Promise<object>} Response from background
   */
  sendMessage: async function(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (e) {
      this.log('ERROR', 'Failed to send message', { message, error: e.message });
      return { success: false, error: e.message };
    }
  },

  /**
   * Check if element is visible in viewport
   * @param {Element} element - DOM element
   * @returns {boolean} True if visible
   */
  isElementVisible: function(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Element>} Found element or null
   */
  waitForElement: function(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          this.log('WARN', 'Element not found within timeout', { selector, timeout });
          resolve(null);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }
};

// Make Helpers available globally for content scripts
if (typeof window !== 'undefined') {
  window.Helpers = Helpers;
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Helpers;
}
