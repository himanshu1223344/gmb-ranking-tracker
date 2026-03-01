// Options Page Logic - FINAL VERSION v6.1 - WITH HISTORICAL RANK TRACKING
(function() {
  'use strict';

  console.log('🚀 GMB Options Page v6.1 initializing...');

  // ========================================
  // DOM READY CHECK - CRITICAL FIX
  // ========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('✅ DOM Ready - Initializing Options Page');
    
    // Verify critical elements exist
    const criticalElements = [
      'results-tbody',
      'businesses-grid',
      'add-business-btn',
      'save-business-btn',
      'add-business-modal'
    ];
    
    const missing = criticalElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
      console.error('❌ Missing critical elements:', missing);
      return;
    }
    
    setupTabSwitching();
    loadResults();
    loadSettings();
    attachEventListeners();
    
    console.log('✅ Options page initialized successfully');
  }

  // ========================================
  // TAB SWITCHING
  // ========================================
  function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        
        tab.classList.add('active');
        const targetContent = document.getElementById(`${targetTab}-tab`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
        
        // Load data for active tab
        if (targetTab === 'results') loadResults();
        if (targetTab === 'businesses') loadBusinesses();
        if (targetTab === 'logs') loadLogs();
      });
    });
  }

  // ========================================
  // EVENT LISTENERS - NULL SAFE
  // ========================================
  function attachEventListeners() {
    // Results tab
    safeAddListener('export-all-btn', 'click', exportAllResults);
    safeAddListener('clear-all-btn', 'click', clearAllData);
    safeAddListener('search-results', 'input', filterResults);
    
    // Businesses tab
    safeAddListener('add-business-btn', 'click', showAddBusinessModal);
    safeAddListener('save-business-btn', 'click', saveBusiness);
    
    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        resetBusinessForm();
      });
    });
    
    // Close modal on overlay click
    const modal = document.getElementById('add-business-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-overlay')) {
          closeModal();
          resetBusinessForm();
        }
      });
    }
    
    // Settings tab
    safeAddListener('save-settings-btn', 'click', saveSettings);
    safeAddListener('reset-settings-btn', 'click', resetSettings);
    safeAddListener('backup-data-btn', 'click', backupData);
    safeAddListener('restore-data-btn', 'click', () => {
      const fileInput = document.getElementById('restore-file');
      if (fileInput) fileInput.click();
    });
    safeAddListener('restore-file', 'change', restoreData);
    
    // Logs tab
    safeAddListener('clear-logs-btn', 'click', clearLogs);
    safeAddListener('export-logs-btn', 'click', exportLogs);
  }

  function safeAddListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.warn(`⚠️ Element not found: ${elementId}`);
    }
  }

  function closeModal() {
    const modal = document.getElementById('add-business-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // ========================================
  // RESULTS TAB - WITH HISTORICAL TRACKING 📊
  // ========================================
  async function loadResults() {
    try {
      console.log('📊 Loading results with trend analysis...');
      
      const data = await chrome.storage.local.get(null);
      console.log('Raw storage keys:', Object.keys(data));
      
      // Get rankings WITH history
      const rankings = Object.entries(data)
        .filter(([key, value]) => {
          const isRanking = key.startsWith('ranking_history_') || key.startsWith('ranking_');
          const hasValue = value && typeof value === 'object';
          const hasBusinessName = hasValue && value.businessName;
          
          return isRanking && hasValue && hasBusinessName;
        })
        .map(([key, value]) => {
          // Calculate trend data
          let trend = 'new';
          let change = 0;
          let previousPosition = null;
          
          if (value.history && value.history.length > 1) {
            const latest = value.history[value.history.length - 1];
            const previous = value.history[value.history.length - 2];
            
            if (latest.position && previous.position) {
              change = previous.position - latest.position; // Positive = improvement
              previousPosition = previous.position;
              
              if (change > 0) trend = 'up';
              else if (change < 0) trend = 'down';
              else trend = 'same';
            }
          } else if (value.previousPosition && value.latestPosition) {
            change = value.previousPosition - value.latestPosition;
            previousPosition = value.previousPosition;
            
            if (change > 0) trend = 'up';
            else if (change < 0) trend = 'down';
            else trend = 'same';
          }
          
          return {
            storageKey: key,
            ...value,
            trend,
            change,
            previousPosition,
            currentPosition: value.latestPosition || value.organicPosition
          };
        });
      
      console.log('Found rankings:', rankings.length);
      
      // Update stats
      updateStats(rankings);
      
      // Populate table
      const tbody = document.getElementById('results-tbody');
      const emptyState = document.getElementById('no-results-state');
      const tableWrapper = document.querySelector('.table-wrapper');
      
      if (!tbody) {
        console.error('❌ results-tbody not found');
        return;
      }
      
      if (rankings.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">No results found. Start your first ranking check!</td></tr>';
        return;
      }
      
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
      
      tbody.innerHTML = rankings
        .sort((a, b) => (b.lastChecked || b.timestamp) - (a.lastChecked || a.timestamp))
        .map(r => {
          // Trend indicator HTML
          let trendHtml = '';
          if (r.trend === 'up') {
            trendHtml = `<span class="trend-badge trend-up" title="Improved by ${r.change} positions">↑ +${r.change}</span>`;
          } else if (r.trend === 'down') {
            trendHtml = `<span class="trend-badge trend-down" title="Dropped by ${Math.abs(r.change)} positions">↓ ${r.change}</span>`;
          } else if (r.trend === 'same') {
            trendHtml = `<span class="trend-badge trend-same" title="Position unchanged">~ 0</span>`;
          } else {
            trendHtml = `<span class="trend-badge trend-new" title="First check">NEW</span>`;
          }
          
          // Position display
          const positionHtml = r.currentPosition 
            ? `#${r.currentPosition}` 
            : (r.previousPosition ? `Not Ranked (was #${r.previousPosition})` : 'Not Ranked');
          
          // Check count
          const checkCount = r.history ? r.history.length : 1;
          
          return `
            <tr data-storage-key="${escapeHtml(r.storageKey)}">
              <td><strong>${escapeHtml(r.businessName)}</strong></td>
              <td>${escapeHtml(r.keyword)}</td>
              <td>${escapeHtml(r.location || '-')}</td>
              <td class="position-cell ${r.currentPosition ? '' : 'not-ranked'}">
                ${positionHtml}
              </td>
              <td>${trendHtml}</td>
              <td>${r.page || '-'}</td>
              <td>
                <span class="confidence-badge ${r.confidence >= 95 ? 'high' : ''}">
                  ${r.confidence || 100}%
                </span>
              </td>
              <td>
                <div>${new Date(r.lastChecked || r.timestamp).toLocaleDateString()}</div>
                <small style="color: var(--text-secondary); font-size: 11px;">
                  ${checkCount} check${checkCount > 1 ? 's' : ''}
                </small>
              </td>
              <td>
                <button class="action-btn view-history-btn" title="View ranking history" data-storage-key="${escapeHtml(r.storageKey)}">
                  📊 History
                </button>
                <button class="action-btn delete-btn" title="Delete this result">Delete</button>
              </td>
            </tr>
          `;
        }).join('');
      
      // Attach handlers
      attachDeleteHandlers();
      attachHistoryHandlers();
      
      console.log('✅ Results loaded with trend analysis');
      
    } catch (error) {
      console.error('❌ Failed to load results:', error);
      showToast('Failed to load results', 'error');
    }
  }

  function attachDeleteHandlers() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    console.log(`🔘 Attaching handlers to ${deleteButtons.length} delete buttons`);
    
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', handleDeleteClick);
    });
  }

  async function handleDeleteClick(e) {
    const btn = e.target;
    const row = btn.closest('tr');
    const storageKey = row?.getAttribute('data-storage-key');
    
    if (!storageKey) {
      showToast('Error: Could not find storage key', 'error');
      return;
    }

    const business = row.querySelector('td:first-child')?.textContent.trim() || '';
    const keyword = row.querySelector('td:nth-child(2)')?.textContent.trim() || '';

    if (!confirm(`Delete all ranking history for this keyword?\n\n📊 Business: ${business}\n🔍 Keyword: ${keyword}\n\nThis will delete all historical data.`)) {
      return;
    }

    // Disable button during deletion
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    
    try {
      await chrome.storage.local.remove(storageKey);
      console.log('✅ Deleted:', storageKey);
      
      // Animate row removal
      row.style.transition = 'all 0.3s ease';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      
      setTimeout(async () => {
        row.remove();
        
        // Small delay to ensure storage has synced
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reload to update stats
        await loadResults();
        
        showToast('Result deleted successfully', 'success');
      }, 300);
      
    } catch (err) {
      console.error('❌ Delete failed:', err);
      showToast('Delete failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  }

  // ========================================
  // HISTORY VIEW HANDLERS 📊
  // ========================================
  function attachHistoryHandlers() {
    const historyButtons = document.querySelectorAll('.view-history-btn');
    console.log(`📊 Attaching handlers to ${historyButtons.length} history buttons`);
    
    historyButtons.forEach(btn => {
      btn.addEventListener('click', handleViewHistory);
    });
  }

  async function handleViewHistory(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const storageKey = btn.getAttribute('data-storage-key');
    
    if (!storageKey) {
      showToast('Storage key not found', 'error');
      return;
    }
    
    try {
      const data = await chrome.storage.local.get(storageKey);
      const ranking = data[storageKey];
      
      if (!ranking) {
        showToast('Ranking data not found', 'error');
        return;
      }
      
      showHistoryModal(ranking);
      
    } catch (error) {
      console.error('Failed to load history:', error);
      showToast('Failed to load history', 'error');
    }
  }

  function showHistoryModal(ranking) {
    // Remove existing modal if any
    const existingModal = document.getElementById('history-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const history = ranking.history || [];
    
    if (history.length === 0) {
      showToast('No history available for this ranking', 'warning');
      return;
    }
    
    // Generate history table
    const historyRows = history
      .slice()
      .reverse() // Show latest first
      .map((record, index, arr) => {
        const prevRecord = arr[index + 1];
        let changeHtml = '<span style="color: #999;">—</span>';
        
        if (prevRecord && record.position && prevRecord.position) {
          const change = prevRecord.position - record.position;
          if (change > 0) {
            changeHtml = `<span style="color: #2e7d32; font-weight: 600;">↑ +${change}</span>`;
          } else if (change < 0) {
            changeHtml = `<span style="color: #c62828; font-weight: 600;">↓ ${change}</span>`;
          } else {
            changeHtml = `<span style="color: #e65100; font-weight: 600;">~ 0</span>`;
          }
        }
        
        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 12px;">${new Date(record.timestamp).toLocaleString()}</td>
            <td style="padding: 12px; text-align: center; font-weight: 600;">
              ${record.position ? `#${record.position}` : 'Not Ranked'}
            </td>
            <td style="padding: 12px; text-align: center;">${changeHtml}</td>
            <td style="padding: 12px; text-align: center;">${record.page || '-'}</td>
            <td style="padding: 12px; text-align: center;">${record.confidence}%</td>
          </tr>
        `;
      }).join('');
    
    const modalHtml = `
      <div id="history-modal" class="modal" style="display: flex;">
        <div class="modal-overlay"></div>
        <div class="modal-content" style="max-width: 700px;">
          <div class="modal-header">
            <h3>📊 Ranking History</h3>
            <button class="close-history-modal">&times;</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--bg-light); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <div style="font-weight: 600; margin-bottom: 8px;">
                ${escapeHtml(ranking.businessName)} - ${escapeHtml(ranking.keyword)}
              </div>
              <div style="font-size: 12px; color: var(--text-secondary);">
                📍 ${escapeHtml(ranking.location || 'N/A')} | 
                ${history.length} total check${history.length > 1 ? 's' : ''}
              </div>
            </div>
            
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: var(--bg-light); border-bottom: 2px solid var(--border-color);">
                    <th style="padding: 12px; text-align: left;">Date & Time</th>
                    <th style="padding: 12px; text-align: center;">Position</th>
                    <th style="padding: 12px; text-align: center;">Change</th>
                    <th style="padding: 12px; text-align: center;">Page</th>
                    <th style="padding: 12px; text-align: center;">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${historyRows}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline close-history-modal">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Attach close handlers
    document.querySelectorAll('.close-history-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('history-modal').remove();
      });
    });
    
    // Close on overlay click
    const modal = document.getElementById('history-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        const historyModal = document.getElementById('history-modal');
        if (historyModal) {
          historyModal.remove();
          document.removeEventListener('keydown', escapeHandler);
        }
      }
    });
  }

  function updateStats(rankings) {
    const totalChecks = rankings.length;
    const ranked = rankings.filter(r => r.currentPosition).length;
    const notRanked = totalChecks - ranked;
    
    const avgPosition = ranked > 0
      ? Math.round(rankings.filter(r => r.currentPosition).reduce((sum, r) => sum + r.currentPosition, 0) / ranked)
      : 0;
    
    safeSetText('total-checks', totalChecks);
    safeSetText('avg-position', avgPosition || '-');
    safeSetText('ranked-count', ranked);
    safeSetText('not-ranked-count', notRanked);
  }

  function safeSetText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  function filterResults(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#results-tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const isVisible = text.includes(searchTerm);
      row.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount++;
    });
    
    console.log(`Showing ${visibleCount} of ${rows.length} results`);
  }

  async function exportAllResults() {
    try {
      const data = await chrome.storage.local.get(null);
      const rankings = Object.values(data).filter(item => item && item.businessName);
      
      if (rankings.length === 0) {
        showToast('No data to export', 'warning');
        return;
      }
      
      const csv = generateCSV(rankings);
      downloadFile(csv, `gmb_rankings_export_${Date.now()}.csv`, 'text/csv');
      
      showToast(`Exported ${rankings.length} results`, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed', 'error');
    }
  }

  function generateCSV(data) {
    const headers = ['Business Name', 'Keyword', 'Location', 'Current Position', 'Previous Position', 'Change', 'Trend', 'Page', 'Confidence', 'Date', 'Total Checks'];
    const rows = data.map(r => {
      const currentPos = r.latestPosition || r.organicPosition || '';
      const previousPos = r.previousPosition || '';
      const change = r.change || 0;
      const trend = r.trend || 'new';
      const checkCount = r.history ? r.history.length : 1;
      
      return [
        `"${escapeCsv(r.businessName)}"`,
        `"${escapeCsv(r.keyword)}"`,
        `"${escapeCsv(r.location || '')}"`,
        currentPos || 'Not Ranked',
        previousPos || '-',
        change > 0 ? `+${change}` : change,
        trend,
        r.page || '',
        (r.confidence || 100) + '%',
        `"${new Date(r.lastChecked || r.timestamp).toLocaleString()}"`,
        checkCount
      ];
    });
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function clearAllData() {
    if (!confirm('⚠️ WARNING: Delete ALL ranking data including history?\n\nThis cannot be undone!')) {
      return;
    }
    
    try {
      const data = await chrome.storage.local.get(null);
      const rankingKeys = Object.keys(data).filter(k => k.startsWith('ranking_'));
      
      if (rankingKeys.length === 0) {
        showToast('No ranking data to clear', 'warning');
        return;
      }
      
      await chrome.storage.local.remove(rankingKeys);
      
      showToast(`Cleared ${rankingKeys.length} results`, 'success');
      
      await new Promise(resolve => setTimeout(resolve, 200));
      loadResults();
    } catch (err) {
      console.error('Clear failed:', err);
      showToast('Failed to clear data', 'error');
    }
  }

  // ========================================
  // BUSINESSES TAB - WITH EDIT & QUICK TRACK 🚀
  // ========================================
  async function loadBusinesses() {
    const grid = document.getElementById('businesses-grid');
    const emptyState = document.getElementById('no-businesses-state');
    
    if (!grid) {
      console.error('❌ businesses-grid not found');
      return;
    }
    
    try {
      // Get saved businesses from storage
      const { businesses = [] } = await chrome.storage.local.get(['businesses']);
      
      console.log('Loaded businesses:', businesses.length);
      
      if (businesses.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }
      
      grid.style.display = 'grid';
      if (emptyState) emptyState.style.display = 'none';
      
      // ✅ Business cards with EDIT + TRACK buttons
      grid.innerHTML = businesses.map((business, index) => `
        <div class="business-card" data-business-id="${index}">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div class="business-name">${escapeHtml(business.name)}</div>
            <button class="delete-business-btn" data-business-id="${index}" title="Delete business" style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: #ea4335; padding: 0; line-height: 1;">
              ✕
            </button>
          </div>
          
          <div class="business-info">🆔 ${escapeHtml(business.placeId)}</div>
          ${business.location ? `<div class="business-info">📍 ${escapeHtml(business.location)}</div>` : ''}
          ${business.keywords ? `<div class="business-info">🔑 ${escapeHtml(business.keywords)}</div>` : ''}
          
          <!-- Action Buttons Section -->
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <button 
              class="btn btn-outline btn-sm edit-business-btn" 
              data-business-index="${index}"
              title="Edit business details"
              style="flex: 1; justify-content: center;">
              <span>✏️</span>
              <span>Edit</span>
            </button>
            
            <button 
              class="btn btn-primary btn-sm quick-track-btn" 
              data-business-index="${index}"
              title="Start tracking this business"
              style="flex: 1; justify-content: center;">
              <span>🔍</span>
              <span>Track</span>
            </button>
          </div>
          
          <div style="margin-top: 12px; font-size: 11px; color: var(--text-secondary); text-align: center;">
            Added ${new Date(business.addedDate).toLocaleDateString()}
          </div>
        </div>
      `).join('');
      
      // Attach handlers
      attachBusinessHandlers();
      
    } catch (err) {
      console.error('Failed to load businesses:', err);
      grid.innerHTML = '<div class="loading-cell">Failed to load businesses</div>';
    }
  }

  function attachBusinessHandlers() {
    // Delete business handlers
    document.querySelectorAll('.delete-business-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const businessId = parseInt(e.target.getAttribute('data-business-id'));
        
        if (isNaN(businessId)) {
          showToast('Invalid business ID', 'error');
          return;
        }
        
        try {
          const { businesses = [] } = await chrome.storage.local.get(['businesses']);
          
          if (businessId < 0 || businessId >= businesses.length) {
            showToast('Business not found', 'error');
            return;
          }
          
          const businessName = businesses[businessId].name;
          
          if (!confirm(`Delete "${businessName}"?`)) return;
          
          businesses.splice(businessId, 1);
          await chrome.storage.local.set({ businesses });
          
          showToast(`${businessName} deleted`, 'success');
          loadBusinesses();
        } catch (err) {
          console.error('Failed to delete business:', err);
          showToast('Failed to delete business', 'error');
        }
      });
    });
    
    // ✏️ EDIT BUSINESS HANDLERS
    document.querySelectorAll('.edit-business-btn').forEach(btn => {
      btn.addEventListener('click', handleEditBusiness);
    });
    
    // 🔍 QUICK TRACK HANDLERS
    document.querySelectorAll('.quick-track-btn').forEach(btn => {
      btn.addEventListener('click', handleQuickTrack);
    });
  }

  // ========================================
  // EDIT BUSINESS FEATURE ✏️
  // ========================================
  async function handleEditBusiness(e) {
    const btn = e.currentTarget;
    const businessIndex = parseInt(btn.getAttribute('data-business-index'));
    
    if (isNaN(businessIndex)) {
      showToast('Invalid business index', 'error');
      return;
    }
    
    try {
      const { businesses = [] } = await chrome.storage.local.get(['businesses']);
      
      if (businessIndex < 0 || businessIndex >= businesses.length) {
        showToast('Business not found', 'error');
        return;
      }
      
      const business = businesses[businessIndex];
      
      // Show edit modal
      showEditBusinessModal(business, businessIndex);
      
    } catch (error) {
      console.error('Failed to load business for editing:', error);
      showToast('Failed to load business data', 'error');
    }
  }

  function showEditBusinessModal(business, businessIndex) {
    const modal = document.getElementById('add-business-modal');
    
    if (!modal) {
      showToast('Modal not found', 'error');
      return;
    }
    
    // Get form elements
    const nameInput = document.getElementById('new-business-name');
    const placeIdInput = document.getElementById('new-place-id');
    const locationInput = document.getElementById('new-location');
    const keywordsInput = document.getElementById('new-keywords');
    const saveBtn = document.getElementById('save-business-btn');
    const modalTitle = modal.querySelector('.modal-header h3');
    
    // Change modal title
    if (modalTitle) {
      modalTitle.textContent = '✏️ Edit Business';
    }
    
    // Pre-fill form with existing data
    if (nameInput) nameInput.value = business.name || '';
    if (placeIdInput) placeIdInput.value = business.placeId || '';
    if (locationInput) locationInput.value = business.location || '';
    if (keywordsInput) keywordsInput.value = business.keywords || '';
    
    // Make Place ID readonly (can't change it)
    if (placeIdInput) {
      placeIdInput.readOnly = true;
      placeIdInput.style.backgroundColor = 'var(--bg-light)';
      placeIdInput.style.cursor = 'not-allowed';
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Focus first editable field
    if (nameInput) {
      setTimeout(() => nameInput.focus(), 100);
    }
    
    // Change save button
    if (saveBtn) {
      saveBtn.innerHTML = '<span>💾</span><span>Update Business</span>';
      saveBtn.dataset.editMode = 'true';
      saveBtn.dataset.businessIndex = businessIndex;
    }
  }

  // ========================================
  // QUICK TRACK FEATURE - MAIN HANDLER 🎯
  // ========================================
  async function handleQuickTrack(e) {
    const btn = e.currentTarget;
    const businessIndex = parseInt(btn.getAttribute('data-business-index'));
    
    if (isNaN(businessIndex)) {
      showToast('Invalid business index', 'error');
      return;
    }
    
    try {
      // ✅ Get business data from storage
      const { businesses = [] } = await chrome.storage.local.get(['businesses']);
      
      if (businessIndex < 0 || businessIndex >= businesses.length) {
        showToast('Business not found', 'error');
        return;
      }
      
      const business = businesses[businessIndex];
      
      console.log('🚀 Quick Track initiated:', business);
      
      // Validate data
      if (!business.name || !business.placeId) {
        showToast('Business data is incomplete', 'error');
        return;
      }
      
      // Show Quick Track modal with business data
      showQuickTrackModal(business.name, business.placeId, business.location || '', business.keywords || '');
      
    } catch (error) {
      console.error('Failed to get business data:', error);
      showToast('Failed to load business data', 'error');
    }
  }

  // ========================================
  // QUICK TRACK MODAL - BATCH KEYWORD SUPPORT ✅
  // ========================================
  function showQuickTrackModal(businessName, placeId, location, keywords) {
    // Remove existing modal if any
    const existingModal = document.getElementById('quick-track-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // ✅ SMART KEYWORD PARSING: Handle both comma AND space-separated
    let keywordList = [];
    
    if (keywords) {
      // First try comma-separated
      if (keywords.includes(',')) {
        keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
      } else {
        // If no commas, treat entire string as one keyword
        keywordList = [keywords.trim()];
      }
    }
    
    console.log('📋 Parsed keywords:', keywordList);
    console.log('📋 Keyword count:', keywordList.length);
    
    // Create modal HTML
    const modalHtml = `
      <div id="quick-track-modal" class="modal" style="display: flex;" role="dialog" aria-labelledby="quick-track-title" aria-modal="true">
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="quick-track-title">🔍 Quick Track Rankings</h3>
            <button class="close-quick-track-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--bg-light); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <div style="font-weight: 600; margin-bottom: 8px;">📊 ${escapeHtml(businessName)}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">
                🆔 ${escapeHtml(placeId)}<br>
                ${location ? `📍 ${escapeHtml(location)}` : ''}
              </div>
            </div>
            
            ${keywordList.length > 1 ? `
            <div class="form-group">
              <label for="quick-track-keyword">
                Select ONE Keyword to Track <span class="required">*</span>
              </label>
              <select id="quick-track-keyword" class="input-field" required>
                <option value="">-- Select a keyword --</option>
                ${keywordList.map(kw => `<option value="${escapeHtml(kw)}">${escapeHtml(kw)}</option>`).join('')}
              </select>
              <small class="help-text">Choose one keyword from the list above</small>
            </div>
            
            <div style="margin: 16px 0; text-align: center; color: var(--text-secondary); font-size: 14px;">
              — OR —
            </div>
            ` : ''}
            
            <div class="form-group">
              <label for="quick-track-custom-keyword">
                ${keywordList.length > 1 ? 'Enter Custom Keywords' : 'Enter Keywords to Track'} <span class="required">*</span>
              </label>
              <textarea 
                id="quick-track-custom-keyword" 
                class="input-field" 
                placeholder="e.g., Best Gynaecologist in Malad, PCOD Treatment, IVF Specialist"
                rows="3"
                ${keywordList.length <= 1 ? 'required' : ''}>${keywordList.length === 1 ? escapeHtml(keywordList[0]) : ''}</textarea>
              <small class="help-text" style="display: block; margin-top: 8px;">
                💡 <strong>Tip:</strong> Enter multiple keywords separated by comma or new line. They will be processed one by one automatically in the background.
              </small>
            </div>
            
            <div class="form-group">
              <label for="quick-track-location">
                Location <span class="required">*</span>
              </label>
              <input 
                type="text" 
                id="quick-track-location" 
                class="input-field" 
                value="${escapeHtml(location)}"
                placeholder="e.g., Malad, Mumbai"
                required>
              <small class="help-text">Search location (city, area, etc.)</small>
            </div>
          </div>
          <div class="modal-footer">
            <button id="start-quick-track-btn" class="btn btn-primary">
              <span>🚀</span>
              <span>Start Tracking</span>
            </button>
            <button class="btn btn-outline close-quick-track-modal">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Attach event listeners
    const modal = document.getElementById('quick-track-modal');
    
    // Close modal handlers
    document.querySelectorAll('.close-quick-track-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    });
    
    // Start tracking button
    document.getElementById('start-quick-track-btn').addEventListener('click', () => {
      startQuickTrack(businessName, placeId);
    });
    
    // Auto-clear dropdown when custom keyword is typed (only if dropdown exists)
    const customInput = document.getElementById('quick-track-custom-keyword');
    const dropdown = document.getElementById('quick-track-keyword');
    
    if (customInput && dropdown) {
      customInput.addEventListener('input', () => {
        if (customInput.value.trim()) {
          dropdown.value = '';
        }
      });
      
      dropdown.addEventListener('change', () => {
        if (dropdown.value) {
          customInput.value = dropdown.value;
        }
      });
    }
  }

   // ========================================
  // START QUICK TRACK - BATCH KEYWORD PROCESSING 🎯
  // ========================================
  async function startQuickTrack(businessName, placeId) {
    const keywordDropdown = document.getElementById('quick-track-keyword');
    const customKeyword = document.getElementById('quick-track-custom-keyword');
    const locationInput = document.getElementById('quick-track-location');

    if (!customKeyword || !locationInput) {
      showToast('Form elements not found', 'error');
      return;
    }

    const keywordInput = customKeyword.value.trim() || (keywordDropdown ? keywordDropdown.value.trim() : '');
    const location = locationInput.value.trim();

    if (!keywordInput) {
      showToast('⚠️ Please enter at least one keyword', 'warning');
      customKeyword.focus();
      return;
    }

    if (!location) {
      showToast('⚠️ Please enter a location', 'warning');
      locationInput.focus();
      return;
    }

    // Close modal
    const modal = document.getElementById('quick-track-modal');
    if (modal) modal.remove();

    // ✅ PARSE KEYWORDS
    const keywords = keywordInput
      .split(/[\n,]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      showToast('⚠️ No valid keywords found', 'warning');
      return;
    }

    console.log(`🚀 Quick Track - Processing ${keywords.length} keyword(s):`, keywords);

    // ✅ Estimate total time
    const estimatedMinutes = keywords.length <= 3
      ? Math.ceil((keywords.length * 30) / 60)
      : keywords.length <= 8
        ? Math.ceil((keywords.length * 45) / 60)
        : Math.ceil((keywords.length * 60) / 60);

    if (keywords.length > 6) {
      showToast(`⚠️ ${keywords.length} keywords — estimated ~${estimatedMinutes} min. Please keep this tab open!`, 'warning');
      await sleep(3000);
    } else if (keywords.length === 1) {
      showToast(`🔍 Starting rank check for "${businessName}"...`, 'info');
    } else {
      showToast(`🔍 Starting ${keywords.length} rank checks (~${estimatedMinutes} min)...`, 'info');
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const progress = `(${i + 1}/${keywords.length})`;

      console.log(`🔍 Processing keyword ${progress}: ${keyword}`);
      showToast(`🔍 ${progress} Checking: "${keyword}"...`, 'info');

      try {
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve({ success: true }), 8000);
          chrome.runtime.sendMessage({
            action: 'startQuickTrack',
            data: { businessName, placeId, keyword, location }
          }, (res) => {
            clearTimeout(timeout);
            resolve(res || { success: true });
          });
        });

        if (response && response.success) {
          successCount++;
          console.log(`✅ ${progress} Queued: ${keyword}`);
        } else {
          failCount++;
          console.error(`❌ ${progress} Failed: ${keyword}`, response?.error);
          showToast(`❌ ${progress} Failed: "${keyword}"`, 'error');
        }

      } catch (error) {
        failCount++;
        console.error(`❌ ${progress} Error: ${keyword}`, error);
        showToast(`❌ ${progress} Error: "${keyword}"`, 'error');
      }

      // ✅ SMART DELAY with countdown
      if (i < keywords.length - 1) {
        let delayMs;

        // ✅ Extra break every 5 keywords
        if ((i + 1) % 5 === 0) {
          delayMs = randomDelay(120000, 180000); // 2-3 min
          console.log(`☕ Extended break after ${i + 1} keywords: ${Math.round(delayMs / 60000)} min`);
          await sleepWithCountdown(delayMs, `☕ Break after ${i + 1} keywords`);
        } else {
          if (keywords.length <= 3) {
            delayMs = randomDelay(25000, 35000);
          } else if (keywords.length <= 8) {
            delayMs = randomDelay(35000, 50000);
          } else {
            delayMs = randomDelay(45000, 70000);
          }
          console.log(`⏳ Waiting ${Math.round(delayMs / 1000)}s before next keyword`);
          await sleepWithCountdown(delayMs, `⏳ Next keyword`);
        }
      }
    }

    // ✅ FINAL SUMMARY
    if (keywords.length === 1) {
      showToast(successCount > 0
        ? `✅ Tracking queued for "${businessName}"!`
        : `❌ Failed to track "${businessName}"`, successCount > 0 ? 'success' : 'error');
    } else {
      if (successCount === keywords.length) {
        showToast(`✅ All ${keywords.length} keywords queued successfully!`, 'success');
      } else if (successCount > 0) {
        showToast(`⚠️ Done: ${successCount} queued, ${failCount} failed`, 'warning');
      } else {
        showToast(`❌ Failed to queue all keywords`, 'error');
      }
    }

    // Switch to results tab
    setTimeout(() => {
      const resultsTab = document.querySelector('.tab[data-tab="results"]');
      if (resultsTab) resultsTab.click();
    }, 2000);
  }

  // ✅ Sleep with live countdown toast
  async function sleepWithCountdown(ms, label = '⏳ Waiting') {
    const totalSeconds = Math.round(ms / 1000);
    let remaining = totalSeconds;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          const display = remaining >= 60
            ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
            : `${remaining}s`;
          showToast(`${label}: ${display} remaining...`, 'info');
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, ms);
    });
  }

  // ✅ UTILITY: Sleep
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ UTILITY: Random delay
  function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

    // ========================================
  // UTILITY: Sleep function for delays
  // ========================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ========================================
  // ADD/EDIT BUSINESS MODAL FUNCTIONS
  // ========================================
  function showAddBusinessModal() {
    resetBusinessForm();

    const modal = document.getElementById('add-business-modal');
    const nameInput = document.getElementById('new-business-name');

    if (!modal) {
      console.error('❌ Modal not found');
      showToast('Error: Modal not found', 'error');
      return;
    }

    modal.style.display = 'flex';

    if (nameInput) {
      setTimeout(() => nameInput.focus(), 100);
    }
  }

  function resetBusinessForm() {
    const nameInput = document.getElementById('new-business-name');
    const placeIdInput = document.getElementById('new-place-id');
    const locationInput = document.getElementById('new-location');
    const keywordsInput = document.getElementById('new-keywords');
    const saveBtn = document.getElementById('save-business-btn');
    const modalTitle = document.querySelector('#add-business-modal .modal-header h3');

    if (nameInput) nameInput.value = '';
    if (placeIdInput) {
      placeIdInput.value = '';
      placeIdInput.readOnly = false;
      placeIdInput.style.backgroundColor = '';
      placeIdInput.style.cursor = '';
    }
    if (locationInput) locationInput.value = '';
    if (keywordsInput) keywordsInput.value = '';

    if (saveBtn) {
      saveBtn.innerHTML = '<span>💾</span><span>Save Business</span>';
      delete saveBtn.dataset.editMode;
      delete saveBtn.dataset.businessIndex;
    }

    if (modalTitle) {
      modalTitle.textContent = '➕ Add New Business';
    }
  }

  async function saveBusiness() {
    const nameInput = document.getElementById('new-business-name');
    const placeIdInput = document.getElementById('new-place-id');
    const locationInput = document.getElementById('new-location');
    const keywordsInput = document.getElementById('new-keywords');
    const saveBtn = document.getElementById('save-business-btn');

    if (!nameInput || !placeIdInput) {
      console.error('❌ Required input elements not found');
      showToast('Error: Form elements not found', 'error');
      return;
    }

    const name = nameInput.value.trim();
    const placeId = placeIdInput.value.trim();
    const location = locationInput ? locationInput.value.trim() : '';
    const keywords = keywordsInput ? keywordsInput.value.trim() : '';

    // ✅ Validation
    if (!name) {
      showToast('⚠️ Business name is required', 'warning');
      nameInput.focus();
      return;
    }

    if (!placeId) {
      showToast('⚠️ Place ID is required', 'warning');
      placeIdInput.focus();
      return;
    }

    if (!location) {
      showToast('⚠️ Location is required for rank tracking', 'warning');
      if (locationInput) locationInput.focus();
      return;
    }

    // ✅ Disable button to prevent double submit
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>⏳</span><span>Saving...</span>';
    }

    try {
      const { businesses = [] } = await chrome.storage.local.get(['businesses']);

      const isEditMode = saveBtn && saveBtn.dataset.editMode === 'true';
      const businessIndex = isEditMode ? parseInt(saveBtn.dataset.businessIndex) : -1;

      if (isEditMode && businessIndex >= 0 && businessIndex < businesses.length) {
        // ✏️ UPDATE EXISTING
        const oldBusiness = businesses[businessIndex];
        businesses[businessIndex] = {
          ...oldBusiness,
          name,
          placeId: oldBusiness.placeId, // ✅ Never change placeId on edit
          location,
          keywords,
          updatedDate: Date.now()
        };

        await chrome.storage.local.set({ businesses });
        console.log(`✅ Business updated: ${name}`);
        showToast(`✅ "${name}" updated successfully`, 'success');

      } else {
        // ➕ ADD NEW
        // ✅ Check duplicate placeId
        const duplicatePlaceId = businesses.some(b => b.placeId === placeId);
        if (duplicatePlaceId) {
          showToast('⚠️ A business with this Place ID already exists', 'warning');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>💾</span><span>Save Business</span>';
          }
          return;
        }

        // ✅ Check duplicate name (warning only, not block)
        const duplicateName = businesses.some(b => b.name.toLowerCase() === name.toLowerCase());
        if (duplicateName) {
          console.warn(`⚠️ Similar business name already exists: ${name}`);
        }

        businesses.push({
          name,
          placeId,
          location,
          keywords,
          addedDate: Date.now()
        });

        await chrome.storage.local.set({ businesses });
        console.log(`✅ Business added: ${name}`);
        showToast(`✅ "${name}" saved successfully`, 'success');
      }

      closeModal();
      resetBusinessForm();
      loadBusinesses();

    } catch (err) {
      console.error('❌ Failed to save business:', err);
      showToast('❌ Failed to save business. Try again.', 'error');
    } finally {
      // ✅ Always re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾</span><span>Save Business</span>';
      }
    }
  }

  // ========================================
  // SETTINGS TAB
  // ========================================
  async function loadSettings() {
    const settings = await chrome.storage.local.get(['settings']) || { settings: {} };
    const s = settings.settings || {};
    
    safeSetValue('max-pages', s.maxPages || 5);
    safeSetValue('delay-seconds', s.delaySeconds || 5);
    safeSetValue('concurrent-tabs', s.concurrentTabs || 3);
    safeSetChecked('auto-schedule', s.autoSchedule || false);
    safeSetValue('retention-days', s.retentionDays || 90);
    safeSetChecked('debug-mode', s.debugMode || false);
    safeSetChecked('notifications', s.notifications !== false);
    safeSetChecked('visible-mode', s.visibleMode !== false);
  }

  function safeSetValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.value = value;
  }

  function safeSetChecked(elementId, checked) {
    const element = document.getElementById(elementId);
    if (element) element.checked = checked;
  }

  function safeGetValue(elementId, defaultValue = '') {
    const element = document.getElementById(elementId);
    return element ? element.value : defaultValue;
  }

  function safeGetChecked(elementId, defaultValue = false) {
    const element = document.getElementById(elementId);
    return element ? element.checked : defaultValue;
  }

  async function saveSettings() {
    const settings = {
      maxPages: parseInt(safeGetValue('max-pages', '5')),
      delaySeconds: parseInt(safeGetValue('delay-seconds', '5')),
      concurrentTabs: parseInt(safeGetValue('concurrent-tabs', '3')),
      autoSchedule: safeGetChecked('auto-schedule', false),
      retentionDays: parseInt(safeGetValue('retention-days', '90')),
      debugMode: safeGetChecked('debug-mode', false),
      notifications: safeGetChecked('notifications', true),
      visibleMode: safeGetChecked('visible-mode', true)
    };
    
    await chrome.storage.local.set({ settings });
    showToast('Settings saved successfully', 'success');
    
    // Show toast indicator
    const toast = document.getElementById('settings-saved-toast');
    if (toast) {
      toast.style.display = 'flex';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 2000);
    }
  }

  function resetSettings() {
    if (!confirm('Reset all settings to default values?')) return;
    
    safeSetValue('max-pages', 5);
    safeSetValue('delay-seconds', 5);
    safeSetValue('concurrent-tabs', 3);
    safeSetChecked('auto-schedule', false);
    safeSetValue('retention-days', 90);
    safeSetChecked('debug-mode', false);
    safeSetChecked('notifications', true);
    safeSetChecked('visible-mode', true);
    
    saveSettings();
  }

  async function backupData() {
    try {
      const data = await chrome.storage.local.get(null);
      const backup = {
        version: '6.1.0',
        exportDate: new Date().toISOString(),
        totalRecords: Object.keys(data).length,
        data: data
      };
      
      const json = JSON.stringify(backup, null, 2);
      downloadFile(json, `gmb_backup_${Date.now()}.json`, 'application/json');
      
      showToast('Backup created successfully', 'success');
    } catch (err) {
      console.error('Backup failed:', err);
      showToast('Backup failed', 'error');
    }
  }

  async function restoreData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        
        if (!backup.data) {
          throw new Error('Invalid backup file format');
        }
        
        if (!confirm(`Restore backup from ${backup.exportDate}?\n\nThis will overwrite all current data.`)) {
          return;
        }
        
        await chrome.storage.local.clear();
        await chrome.storage.local.set(backup.data);
        
        showToast('Data restored successfully', 'success');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        location.reload();
      } catch (error) {
        console.error('Restore failed:', error);
        showToast('Restore failed: ' + error.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ========================================
  // LOGS TAB
  // ========================================
  async function loadLogs() {
    const logs = await chrome.storage.local.get(['errorLogs']) || { errorLogs: [] };
    const container = document.getElementById('logs-container');
    const emptyState = document.getElementById('no-logs-state');
    
    if (!container) {
      console.error('❌ logs-container not found');
      return;
    }
    
    if (!logs.errorLogs || logs.errorLogs.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    
    container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    container.innerHTML = logs.errorLogs
      .reverse()
      .map(log => `
        <div class="log-entry ${log.level ? log.level.toLowerCase() : 'info'}">
          <span class="log-timestamp">${escapeHtml(log.timestamp)}</span>
          <span class="log-level">${escapeHtml(log.level || 'INFO')}</span>
          <span class="log-message">${escapeHtml(log.message)}</span>
          ${log.data ? '<pre class="log-data">' + escapeHtml(JSON.stringify(log.data, null, 2)) + '</pre>' : ''}
        </div>
      `).join('');
  }

  async function exportLogs() {
    try {
      const logs = await chrome.storage.local.get(['errorLogs']) || { errorLogs: [] };
      
      if (!logs.errorLogs || logs.errorLogs.length === 0) {
        showToast('No logs to export', 'warning');
        return;
      }
      
      const text = logs.errorLogs
        .map(log => `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`)
        .join('\n\n');
      
      downloadFile(text, `gmb_logs_${Date.now()}.txt`, 'text/plain');
      showToast('Logs exported successfully', 'success');
    } catch (err) {
      console.error('Export logs failed:', err);
      showToast('Failed to export logs', 'error');
    }
  }

  async function clearLogs() {
    if (!confirm('Clear all error logs?')) return;
    
    await chrome.storage.local.set({ errorLogs: [] });
    showToast('Logs cleared', 'success');
    loadLogs();
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
  
  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function escapeCsv(text) {
    if (text == null) return '';
    return String(text).replace(/"/g, '""');
  }

  function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  console.log('✅ GMB Options Page v6.1 with Historical Rank Tracking initialized successfully! 🚀');

})();
