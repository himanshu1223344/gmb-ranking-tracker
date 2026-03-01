// Handle pagination on Google Maps
const PaginationHandler = {
  
  // Navigate to next page of results
  async navigateToNextPage() {
    try {
      const nextButton = this.findNextButton();
      
      if (!nextButton) {
        Helpers.log('INFO', 'Next button not found');
        return false;
      }
      
      // Check if button is disabled
      if (this.isButtonDisabled(nextButton)) {
        Helpers.log('INFO', 'Next button is disabled - last page reached');
        return false;
      }
      
      // Click next button
      nextButton.click();
      
      Helpers.log('INFO', 'Clicked next page button');
      
      // Wait for new page to load
      await Helpers.sleep(CONFIG.PAGE_LOAD_TIMEOUT);
      
      // Verify page changed
      return await this.verifyPageChange();
      
    } catch (error) {
      Helpers.log('ERROR', 'Failed to navigate to next page', { error: error.message });
      return false;
    }
  },
  
  // Find next page button
  findNextButton() {
    const selectors = [
      CONFIG.SELECTORS.nextButton,
      'button[aria-label="Next page"]',
      'button#pnnext',
      'a#pnnext',
      'button:contains("Next")',
      '[role="button"][aria-label*="Next"]'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button) {
        return button;
      }
    }
    
    return null;
  },
  
  // Check if button is disabled
  isButtonDisabled(button) {
    return (
      button.hasAttribute('disabled') ||
      button.getAttribute('aria-disabled') === 'true' ||
      button.classList.contains('disabled')
    );
  },
  
  // Verify page actually changed after clicking next
  async verifyPageChange() {
    const startTime = Date.now();
    const timeout = 5000;
    
    while (Date.now() - startTime < timeout) {
      const cards = document.querySelectorAll(CONFIG.SELECTORS.businessCard);
      
      if (cards.length > 0) {
        return true;
      }
      
      await Helpers.sleep(500);
    }
    
    return false;
  },
  
  // Get current page number (if visible)
  getCurrentPageNumber() {
    const pageIndicator = document.querySelector('[aria-label*="Page"]');
    
    if (pageIndicator) {
      const match = pageIndicator.textContent.match(/Page (\d+)/);
      return match ? parseInt(match[1]) : 1;
    }
    
    return 1;
  },
  
  // Check if we've reached the end of results
  isLastPage() {
    const endMessages = [
      "You've reached the end",
      "No more results",
      "End of results"
    ];
    
    const pageText = document.body.textContent;
    
    return endMessages.some(msg => pageText.includes(msg));
  }
};
