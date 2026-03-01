// Popup UI Logic v3.2 - BULK FIX + LIVE PROGRESS DISPLAY
(function() {
  'use strict';

  console.log('GMB Popup v3.2 initializing - Bulk Fix + Live Progress Display...');

  // Configuration
  const CONFIG = {
    MAX_KEYWORD_LENGTH: 200,
    MAX_LOCATION_LENGTH: 100,
    MAX_BUSINESS_NAME_LENGTH: 150,
    MESSAGE_TIMEOUT: 30000,
    REFRESH_INTERVAL: 5000,
    MAX_RECENT_RESULTS: 10
  };

  // DOM Elements
  const elements = {
    businessNameInput: document.getElementById('business-name'),
    placeIdInput: document.getElementById('place-id'),
    keywordInput: document.getElementById('keyword'),
    locationInput: document.getElementById('location'),
    checkBtn: document.getElementById('check-btn'),
    resultContainer: document.getElementById('result'),
    resultContent: document.getElementById('result-content'),
    
    csvUpload: document.getElementById('csv-upload'),
    fileName: document.getElementById('file-name'),
    startBulkBtn: document.getElementById('start-bulk'),
    progressContainer: document.getElementById('progress-container'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),
    cancelBulkBtn: document.getElementById('cancel-bulk'),
    
    resultsList: document.getElementById('results-list'),
    noResults: document.getElementById('no-results'),
    refreshBtn: document.getElementById('refresh-results'),
    
    viewAllBtn: document.getElementById('view-all-btn'),
    exportBtn: document.getElementById('export-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    downloadTemplate: document.getElementById('download-template')
  };

  let bulkData = null;
  let isBulkProcessing = false;
  let isQuickCheckRunning = false;
  let lastProgressUpdate = Date.now();
  let refreshTimer = null;

  // Live progress container
  let liveProgressContainer = null;
  let liveProgressList = null;

  // Initialize
  init();

  function init() {
    console.log('Initializing popup...');
    createLiveProgressUI();
    attachEventListeners();
    loadRecentResults();
    checkBulkStatus();
    
    refreshTimer = setInterval(() => {
      if (!document.hidden) {
        loadRecentResults();
      }
    }, CONFIG.REFRESH_INTERVAL);
  }

  // Create Live Progress UI
  function createLiveProgressUI() {
    liveProgressContainer = document.createElement('div');
    liveProgressContainer.id = 'live-progress-container';
    liveProgressContainer.style.cssText = `
      display: none;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      max-height: 400px;
      overflow-y: auto;
    `;

    liveProgressContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
          🔍 Live Search Progress
        </h3>
        <span id="live-status" style="font-size: 12px; color: #666;"></span>
      </div>
      <div id="live-progress-list"></div>
    `;

    // Insert after result container
    const quickCheckSection = elements.resultContainer.parentElement;
    quickCheckSection.appendChild(liveProgressContainer);

    liveProgressList = document.getElementById('live-progress-list');
  }

  // Show live progress
  function showLiveProgress(data) {
    liveProgressContainer.style.display = 'block';
    const statusEl = document.getElementById('live-status');

    if (data.status === 'searching') {
      statusEl.textContent = '🔄 Starting search...';
      statusEl.style.color = '#007bff';
      liveProgressList.innerHTML = '<p style="color: #666; font-size: 13px;">Initializing search...</p>';
    }

    else if (data.status === 'checking_page') {
      statusEl.textContent = `🔄 Checking page ${data.currentPage}...`;
      statusEl.style.color = '#007bff';
      
      const pageHeader = document.createElement('div');
      pageHeader.style.cssText = `
        background: #e3f2fd;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #1976d2;
      `;
      pageHeader.innerHTML = `📄 Page ${data.currentPage} - Loading...`;
      liveProgressList.appendChild(pageHeader);
    }

    else if (data.status === 'found_results') {
      statusEl.textContent = `✅ Found ${data.totalBusinesses} businesses so far`;
      statusEl.style.color = '#28a745';

      const lastHeader = liveProgressList.lastElementChild;
      if (lastHeader && lastHeader.style.background === 'rgb(227, 242, 253)') {
        lastHeader.innerHTML = `📄 Page ${data.currentPage} - Found ${data.latestPage.length} businesses`;
        lastHeader.style.background = '#d1ecf1';
        lastHeader.style.color = '#0c5460';
      }

      if (data.latestPage && data.latestPage.length > 0) {
        const businessList = document.createElement('div');
        businessList.style.cssText = `
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 12px;
          font-size: 12px;
        `;

        businessList.innerHTML = data.latestPage.map((b, idx) => `
          <div style="
            padding: 6px 8px;
            border-bottom: ${idx < data.latestPage.length - 1 ? '1px solid #f0f0f0' : 'none'};
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1; overflow: hidden;">
              <span style="font-weight: 500; color: #333;">
                #${b.position}
              </span>
              <span style="color: #666; margin-left: 8px;">
                ${escapeHtml(truncateText(b.name, 50))}
              </span>
            </div>
            ${b.rating ? `
              <span style="font-size: 11px; color: #f59e0b;">
                ⭐ ${b.rating}
              </span>
            ` : ''}
          </div>
        `).join('');

        liveProgressList.appendChild(businessList);
        liveProgressContainer.scrollTop = liveProgressContainer.scrollHeight;
      }
    }

    else if (data.status === 'found') {
      statusEl.textContent = '🎉 Business Found!';
      statusEl.style.color = '#28a745';

      const successBanner = document.createElement('div');
      successBanner.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px;
        border-radius: 8px;
        margin-top: 12px;
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      `;
      successBanner.innerHTML = `
        ✅ FOUND at Position #${data.foundMatch.position} (Page ${data.foundMatch.page})
        <div style="font-size: 12px; font-weight: normal; margin-top: 6px; opacity: 0.9;">
          ${escapeHtml(data.foundMatch.name)}
        </div>
      `;
      liveProgressList.appendChild(successBanner);
      liveProgressContainer.scrollTop = liveProgressContainer.scrollHeight;

      setTimeout(() => {
        liveProgressContainer.style.display = 'none';
        liveProgressList.innerHTML = '';
      }, 5000);
    }

    else if (data.status === 'not_found') {
      statusEl.textContent = '❌ Not Found';
      statusEl.style.color = '#dc3545';

      const notFoundBanner = document.createElement('div');
      notFoundBanner.style.cssText = `
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        padding: 12px;
        border-radius: 6px;
        margin-top: 12px;
        text-align: center;
        font-size: 13px;
      `;
      notFoundBanner.innerHTML = `
        ❌ Business not found in ${data.totalBusinesses} results checked
      `;
      liveProgressList.appendChild(notFoundBanner);

      setTimeout(() => {
        liveProgressContainer.style.display = 'none';
        liveProgressList.innerHTML = '';
      }, 5000);
    }

    else if (data.status === 'error') {
      statusEl.textContent = '⚠️ Error';
      statusEl.style.color = '#dc3545';

      liveProgressList.innerHTML = `
        <div style="
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          font-size: 13px;
        ">
          ⚠️ ${escapeHtml(data.message)}
        </div>
      `;
    }
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Event Listeners
  function attachEventListeners() {
    elements.checkBtn.addEventListener('click', handleQuickCheck);
    elements.csvUpload.addEventListener('change', handleFileSelect);
    elements.startBulkBtn.addEventListener('click', handleBulkStart);
    elements.cancelBulkBtn.addEventListener('click', handleBulkCancel);
    elements.downloadTemplate.addEventListener('click', handleDownloadTemplate);
    elements.refreshBtn.addEventListener('click', () => loadRecentResults(true));
    elements.exportBtn.addEventListener('click', handleExport);
    elements.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    elements.viewAllBtn.addEventListener('click', handleViewAll);
    
    elements.keywordInput.addEventListener('input', validateInputLength);
    elements.businessNameInput.addEventListener('input', validateInputLength);
    elements.locationInput.addEventListener('input', validateInputLength);
    
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    
    console.log('Event listeners attached');
  }

  function validateInputLength(e) {
    const maxLengths = {
      'keyword': CONFIG.MAX_KEYWORD_LENGTH,
      'business-name': CONFIG.MAX_BUSINESS_NAME_LENGTH,
      'location': CONFIG.MAX_LOCATION_LENGTH
    };
    
    const maxLength = maxLengths[e.target.id];
    if (maxLength && e.target.value.length > maxLength) {
      e.target.value = e.target.value.substring(0, maxLength);
      showWarning(`Maximum ${maxLength} characters allowed`);
    }
  }

  async function checkBulkStatus() {
    try {
      const session = await chrome.storage.session.get(['bulkState']);
      if (session.bulkState && session.bulkState.inProgress) {
        isBulkProcessing = true;
        elements.progressContainer.style.display = 'block';
        elements.startBulkBtn.disabled = true;
        
        const completed = session.bulkState.processedCount || 0;
        updateProgress(completed, completed);
        
        showWarning('Bulk operation in progress (detected from previous session)');
      }
    } catch (error) {
      console.warn('Could not check bulk status:', error);
    }
  }

  // Quick Check with loading state
  async function handleQuickCheck() {
    const businessName = elements.businessNameInput.value.trim();
    const placeId = elements.placeIdInput.value.trim();
    const keyword = elements.keywordInput.value.trim();
    const location = elements.locationInput.value.trim();

    if (!businessName || !keyword) {
      showError('Please enter business name and keyword');
      return;
    }

    if (businessName.length < 3) {
      showError('Business name must be at least 3 characters');
      return;
    }

    if (keyword.length < 2) {
      showError('Keyword must be at least 2 characters');
      return;
    }

    if (isQuickCheckRunning) {
      showWarning('A ranking check is already running');
      return;
    }

    isQuickCheckRunning = true;
    setLoadingState(true);
    elements.resultContainer.style.display = 'none';
    
    liveProgressList.innerHTML = '';
    liveProgressContainer.style.display = 'block';

    try {
      console.log('Starting quick ranking check...', { businessName, keyword, location });

      const response = await chrome.runtime.sendMessage({
        action: 'quickRankingCheck',
        data: {
          businessName,
          placeId: placeId || null,
          keyword,
          location: location || ''
        }
      });

      if (response && response.success) {
        showSuccess(`Ranking check started! Watch live progress below.`);
        setTimeout(() => loadRecentResults(true), 2000);
      } else {
        showError(response?.error || 'Failed to start ranking check. Please try again.');
        liveProgressContainer.style.display = 'none';
      }

    } catch (error) {
      console.error('Quick check error:', error);
      showError(error.message || 'An unexpected error occurred. Please try again.');
      liveProgressContainer.style.display = 'none';
    } finally {
      setLoadingState(false);
      isQuickCheckRunning = false;
    }
  }

  function setLoadingState(isLoading) {
    elements.checkBtn.disabled = isLoading;
    elements.checkBtn.querySelector('.btn-text').style.display = isLoading ? 'none' : 'inline';
    elements.checkBtn.querySelector('.btn-loader').style.display = isLoading ? 'inline' : 'none';
  }

  function showSuccess(message) {
    elements.resultContainer.style.display = 'block';
    elements.resultContainer.classList.remove('error');
    elements.resultContainer.style.borderLeftColor = 'var(--secondary-color)';
    elements.resultContent.innerHTML = `
      <div class="result-row">
        <span style="color: var(--secondary-color);">✅ ${escapeHtml(message)}</span>
      </div>
    `;
  }

  function showWarning(message) {
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--warning-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      box-shadow: var(--shadow);
    `;
    tempDiv.textContent = message;
    document.body.appendChild(tempDiv);
    
    setTimeout(() => {
      tempDiv.remove();
    }, 3000);
  }

  function displayResult(data) {
    elements.resultContainer.style.display = 'block';
    elements.resultContainer.classList.remove('error');
    elements.resultContainer.style.borderLeftColor = 'var(--secondary-color)';

    if (data.found) {
      elements.resultContent.innerHTML = `
        <div class="result-row">
          <span class="result-label">🎯 Position:</span>
          <span class="position-badge">#${escapeHtml(data.organicPosition)}</span>
        </div>
        <div class="result-row">
          <span class="result-label">📄 Page:</span>
          <span class="result-value">Page ${escapeHtml(data.page)}</span>
        </div>
        ${data.matchedName ? `
        <div class="result-row">
          <span class="result-label">Matched:</span>
          <span class="result-value">${escapeHtml(data.matchedName)}</span>
        </div>
        ` : ''}
        ${data.rating ? `
        <div class="result-row">
          <span class="result-label">Rating:</span>
          <span class="result-value">⭐ ${escapeHtml(data.rating)}${data.reviewCount ? ` (${escapeHtml(data.reviewCount)} reviews)` : ''}</span>
        </div>
        ` : ''}
        <div class="result-row">
          <span class="result-label">Total Checked:</span>
          <span class="result-value">${escapeHtml(data.totalChecked)} businesses</span>
        </div>
        <div class="result-row">
          <span class="result-label">Confidence:</span>
          <span class="result-value">${escapeHtml(data.confidence)}%</span>
        </div>
        <div class="result-row">
          <span class="result-label">Match Method:</span>
          <span class="result-value">${formatMatchMethod(data.matchMethod)}</span>
        </div>
      `;
    } else {
      elements.resultContent.innerHTML = `
        <div class="result-row">
          <span class="result-value" style="color: var(--danger-color);">
            ❌ Not found in ${data.totalChecked > 0 ? 'top ' + escapeHtml(data.totalChecked) : 'visible'} results
          </span>
        </div>
        ${data.message ? `
        <div class="result-row">
          <span class="result-value" style="font-size: 12px; color: #666;">
            ${escapeHtml(data.message)}
          </span>
        </div>
        ` : ''}
      `;
    }
  }

  function formatMatchMethod(method) {
    const methods = {
      'place_id_exact': '🎯 Place ID - Exact Match (100%)',
      'place_id_partial': '🎯 Place ID - Partial Match (98%)',
      'place_id': '🎯 Place ID Match (100%)',
      'name_exact': '✅ Exact Name Match (95%)',
      'name_fuzzy': '📝 Fuzzy Name Match (85%)',
      'name_partial': '🔤 Partial Name Match (70%)',
      'not_found': '❌ Not Found'
    };
    return methods[method] || escapeHtml(method);
  }

  function showError(message) {
    elements.resultContainer.style.display = 'block';
    elements.resultContainer.classList.add('error');
    elements.resultContainer.style.borderLeftColor = 'var(--danger-color)';
    elements.resultContent.innerHTML = `
      <div class="result-row">
        <span style="color: var(--danger-color);">❌ ${escapeHtml(message)}</span>
      </div>
    `;
  }

  // ============================================
  // ✅ BULK CHECK - FIXED CSV PARSING
  // ============================================

  function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV file is empty or invalid');
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    if (!headers.includes('business_name') || !headers.includes('keyword')) {
      throw new Error('CSV must contain "business_name" and "keyword" columns');
    }
    
    const businessNameIdx = headers.indexOf('business_name');
    const placeIdIdx = headers.indexOf('place_id');
    const keywordIdx = headers.indexOf('keyword');
    const locationIdx = headers.indexOf('location');
    
    const data = [];
    const businessName = null; // Will be set from first row
    const placeId = null; // Will be set from first row
    const location = null; // Will be set from first row
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      const rowBusinessName = values[businessNameIdx]?.trim();
      const rowPlaceId = values[placeIdIdx]?.trim();
      const keyword = values[keywordIdx]?.trim();
      const rowLocation = values[locationIdx]?.trim();
      
      if (keyword) {
        // ✅ For bulk, we only need keywords (business name comes from form)
        data.push({
          keyword: keyword,
          businessName: rowBusinessName || businessName,
          placeId: rowPlaceId || placeId,
          location: rowLocation || location
        });
      }
    }
    
    if (data.length === 0) throw new Error('No valid keyword rows found in CSV');
    if (data.length > 1000) throw new Error('CSV contains too many rows (max 1000)');
    
    return data;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showError('Please select a CSV file');
      elements.csvUpload.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File too large (max 5MB)');
      elements.csvUpload.value = '';
      return;
    }

    elements.fileName.textContent = file.name;
    elements.startBulkBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        bulkData = parseCSV(e.target.result);
        console.log(`Loaded ${bulkData.length} keywords from CSV`);
        elements.fileName.textContent = `${file.name} (${bulkData.length} rows)`;
        elements.startBulkBtn.disabled = false;
        showSuccess(`Loaded ${bulkData.length} keywords successfully`);
      } catch (error) {
        console.error('CSV parse error:', error);
        showError('Failed to parse CSV: ' + error.message);
        resetFileUpload();
      }
    };
    reader.onerror = () => {
      showError('Failed to read file');
      resetFileUpload();
    };
    reader.readAsText(file);
  }

  function resetFileUpload() {
    elements.fileName.textContent = 'Choose CSV file...';
    elements.startBulkBtn.disabled = true;
    elements.csvUpload.value = '';
    bulkData = null;
  }

  // ============================================
  // ✅ BULK START - FIXED TO SEND CORRECT FORMAT
  // ============================================

  async function handleBulkStart() {
    if (!bulkData || bulkData.length === 0) {
      showError('No data to process');
      return;
    }

    // Get business details from form
    const businessName = elements.businessNameInput.value.trim();
    const placeId = elements.placeIdInput.value.trim();
    const location = elements.locationInput.value.trim();

    if (!businessName) {
      showError('Please enter business name in Quick Check section');
      return;
    }

    if (isBulkProcessing) {
      showWarning('Bulk operation already in progress');
      return;
    }

    // ✅ Extract just the keywords array
    const keywords = bulkData.map(row => row.keyword);

    console.log('📦 Starting bulk check:', {
      business: businessName,
      placeId: placeId,
      keywordCount: keywords.length,
      location: location,
      keywords: keywords.slice(0, 3) + '...' // Log first 3
    });

    isBulkProcessing = true;
    lastProgressUpdate = Date.now();
    elements.startBulkBtn.disabled = true;
    elements.progressContainer.style.display = 'block';
    updateProgress(0, keywords.length);

    try {
      // ✅ FIXED: Send data in correct format for service worker
      const response = await chrome.runtime.sendMessage({
        action: 'bulkRankingCheck',
        data: {
          businessName: businessName,
          placeId: placeId || null,
          keywords: keywords, // ✅ Array of keyword strings
          location: location || ''
        }
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to start bulk processing');
      }
      
      console.log('✅ Bulk operation started successfully');
      showSuccess(`Bulk check started for ${keywords.length} keywords`);
      monitorBulkProgress();
      
    } catch (error) {
      console.error('❌ Bulk processing error:', error);
      showError('Bulk processing failed: ' + error.message);
      resetBulkUI();
    }
  }

  function monitorBulkProgress() {
    const checkInterval = setInterval(() => {
      if (!isBulkProcessing) {
        clearInterval(checkInterval);
        return;
      }
      
      const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
      
      if (timeSinceLastUpdate > 60000) {
        clearInterval(checkInterval);
        showWarning('Bulk operation appears stalled. Check Options page for results.');
        resetBulkUI();
      }
    }, 10000);
  }

  async function handleBulkCancel() {
    if (isBulkProcessing) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'cancelBulk' });
        if (response && response.success) {
          showWarning('Bulk operation cancelled');
        }
      } catch (error) {
        console.error('Failed to cancel:', error);
      }
    }
    resetBulkUI();
  }

  function resetBulkUI() {
    elements.progressContainer.style.display = 'none';
    elements.startBulkBtn.disabled = false;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0 / 0';
    elements.progressPercent.textContent = '0%';
    isBulkProcessing = false;
  }

  // ============================================
  // ✅ HANDLE BACKGROUND MESSAGES
  // ============================================

  function handleBackgroundMessage(message, sender, sendResponse) {
    console.log('Popup received message:', message.action);
    
    if (message.action === 'bulkProgress') {
      lastProgressUpdate = Date.now();
      const { completed, total, keyword, percentage } = message.data;
      console.log(`📊 Progress: ${completed}/${total} - ${keyword}`);
      updateProgress(completed, total);
    }
    
    if (message.action === 'bulkComplete') {
      const { total, ranked, notRanked } = message.data;
      console.log('✅ Bulk complete:', message.data);
      showSuccess(`Bulk check complete! ${ranked}/${total} keywords ranked`);
      resetBulkUI();
      setTimeout(() => loadRecentResults(true), 1000);
    }
    
    if (message.action === 'bulkError') {
      console.error('❌ Bulk error:', message.data);
      showError('Bulk check failed: ' + (message.data.error || 'Unknown error'));
      resetBulkUI();
    }
    
    if (message.action === 'liveProgress') {
      showLiveProgress(message.data);
    }
    
    if (message.action === 'rankingCheckComplete') {
      console.log('Ranking check completed, refreshing results');
      loadRecentResults(true);
      
      if (message.data) {
        displayResult(message.data);
      }
    }
    
    if (message.action === 'downloadCSV') {
      downloadCSV(message.data, message.filename);
    }
    
    sendResponse({ received: true });
    return true;
  }

  function updateProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    elements.progressFill.style.width = percent + '%';
    elements.progressText.textContent = `${completed} / ${total}`;
    elements.progressPercent.textContent = `${percent}%`;
  }

  async function loadRecentResults(forceRefresh = false) {
    try {
      const allData = await chrome.storage.local.get(null);
      const rankingKeys = Object.keys(allData).filter(k => k.startsWith('ranking_'));
      
      if (rankingKeys.length === 0) {
        elements.resultsList.style.display = 'none';
        elements.noResults.style.display = 'block';
        return;
      }
      
      const rankings = rankingKeys
        .map(key => allData[key])
        .filter(item => item && item.businessName && item.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, CONFIG.MAX_RECENT_RESULTS);

      if (rankings.length === 0) {
        elements.resultsList.style.display = 'none';
        elements.noResults.style.display = 'block';
        return;
      }

      elements.resultsList.style.display = 'block';
      elements.noResults.style.display = 'none';

      elements.resultsList.innerHTML = rankings.map(r => `
        <div class="result-item">
          <div class="result-item-header">
            <span class="result-business-name">${escapeHtml(r.businessName)}</span>
            <span class="result-position ${r.organicPosition ? '' : 'not-ranked'}">
              ${r.organicPosition ? '#' + r.organicPosition : 'Not Ranked'}
            </span>
          </div>
          <div class="result-keyword">
            🔑 ${escapeHtml(r.keyword)}${r.location ? ' · ' + escapeHtml(r.location) : ''}
            ${r.page ? ` · Page ${r.page}` : ''}
          </div>
          <div class="result-meta">
            <span>${formatDate(r.timestamp)}</span>
            <span class="confidence-badge ${r.confidence >= 95 ? 'high' : ''}">
              ${r.confidence}% confidence
            </span>
          </div>
        </div>
      `).join('');

      if (forceRefresh) {
        console.log('Results refreshed:', rankings.length);
      }

    } catch (error) {
      console.error('Failed to load results:', error);
      elements.noResults.style.display = 'block';
      elements.noResults.innerHTML = '<p>Error loading results. Please try again.</p>';
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const diff = Date.now() - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  async function handleExport() {
    try {
      setLoadingState(true);
      const response = await chrome.runtime.sendMessage({ action: 'exportCSV' });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Export failed');
      }
      showSuccess('Export started! Download will begin shortly.');
    } catch (error) {
      console.error('Export error:', error);
      showError('Export failed: ' + error.message);
    } finally {
      setLoadingState(false);
    }
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `gmb_rankings_${Date.now()}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showSuccess('CSV downloaded successfully!');
  }

  function handleDownloadTemplate(e) {
    e.preventDefault();
    const template = 'business_name,place_id,keyword,location\n' +
                    '"Example Digital Agency","ChIJ123abc","digital marketing agency","Mumbai, India"\n' +
                    '"Smith & Jones Law Firm",,"law firm","New Delhi"\n' +
                    '"Tech Startup Inc","0x123456789","web development","Bangalore"';
    downloadCSV(template, 'gmb_tracker_template.csv');
  }

  function handleViewAll() {
    chrome.runtime.openOptionsPage();
  }

  window.addEventListener('unload', () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });

  console.log('✅ GMB Popup v3.2 initialized successfully - Bulk Fix Complete! 🚀');

})();
