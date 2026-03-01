// Listen for messages from service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'loadSearchPage') {
    loadSearchPage(request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function loadSearchPage(url) {
  const iframe = document.getElementById('searchFrame');
  
  return new Promise((resolve) => {
    iframe.onload = async () => {
      // Wait for content to load
      await new Promise(r => setTimeout(r, 5000));
      
      // Inject content script into iframe
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Extract business listings
        const businesses = [];
        const cards = iframeDoc.querySelectorAll('.rllt__details');
        
        cards.forEach((card, index) => {
          const nameEl = card.querySelector('.OSrXXb');
          if (nameEl) {
            businesses.push({
              position: index + 1,
              name: nameEl.textContent.trim()
            });
          }
        });
        
        resolve({ success: true, data: businesses });
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    };
    
    iframe.src = url;
  });
}

console.log('Offscreen document ready');
