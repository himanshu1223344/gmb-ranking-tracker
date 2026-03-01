// IndexedDB wrapper for persistent storage
class StorageManager {
  constructor() {
    this.db = null;
    this.dbName = CONFIG.DB_NAME;
    this.dbVersion = CONFIG.DB_VERSION;
  }
  
  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        Helpers.log('ERROR', 'Failed to open IndexedDB', { error: request.error });
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        Helpers.log('INFO', 'IndexedDB opened successfully');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create rankings store
        if (!db.objectStoreNames.contains(CONFIG.STORE_RANKINGS)) {
          const rankingsStore = db.createObjectStore(CONFIG.STORE_RANKINGS, {
            keyPath: 'id',
            autoIncrement: true
          });
          rankingsStore.createIndex('businessName', 'businessName', { unique: false });
          rankingsStore.createIndex('keyword', 'keyword', { unique: false });
          rankingsStore.createIndex('timestamp', 'timestamp', { unique: false });
          rankingsStore.createIndex('placeId', 'placeId', { unique: false });
        }
        
        // Create businesses store
        if (!db.objectStoreNames.contains(CONFIG.STORE_BUSINESSES)) {
          const businessesStore = db.createObjectStore(CONFIG.STORE_BUSINESSES, {
            keyPath: 'id',
            autoIncrement: true
          });
          businessesStore.createIndex('name', 'name', { unique: false });
          businessesStore.createIndex('placeId', 'placeId', { unique: true });
        }
        
        // Create keywords store
        if (!db.objectStoreNames.contains(CONFIG.STORE_KEYWORDS)) {
          const keywordsStore = db.createObjectStore(CONFIG.STORE_KEYWORDS, {
            keyPath: 'id',
            autoIncrement: true
          });
          keywordsStore.createIndex('keyword', 'keyword', { unique: true });
        }
        
        // Create settings store
        if (!db.objectStoreNames.contains(CONFIG.STORE_SETTINGS)) {
          db.createObjectStore(CONFIG.STORE_SETTINGS, {
            keyPath: 'key'
          });
        }
        
        Helpers.log('INFO', 'Database schema created');
      };
    });
  }
  
  // Save ranking result
  async saveRanking(data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_RANKINGS], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_RANKINGS);
      
      const rankingData = {
        businessName: data.businessName,
        placeId: data.placeId,
        keyword: data.keyword,
        location: data.location,
        position: data.position,
        organicPosition: data.organicPosition,
        page: data.page,
        confidence: data.confidence,
        status: data.status || CONFIG.STATUS.COMPLETED,
        timestamp: Date.now(),
        metadata: data.metadata || {}
      };
      
      const request = store.add(rankingData);
      
      request.onsuccess = () => {
        Helpers.log('INFO', 'Ranking saved', { id: request.result });
        resolve(request.result);
      };
      
      request.onerror = () => {
        Helpers.log('ERROR', 'Failed to save ranking', { error: request.error });
        reject(request.error);
      };
    });
  }
  
  // Get rankings with filters
  async getRankings(filters = {}) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_RANKINGS], 'readonly');
      const store = transaction.objectStore(CONFIG.STORE_RANKINGS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Apply filters
        if (filters.businessName) {
          results = results.filter(r => r.businessName === filters.businessName);
        }
        if (filters.keyword) {
          results = results.filter(r => r.keyword === filters.keyword);
        }
        if (filters.limit) {
          results = results.slice(-filters.limit);
        }
        
        // Sort by timestamp descending
        results.sort((a, b) => b.timestamp - a.timestamp);
        
        resolve(results);
      };
      
      request.onerror = () => {
        Helpers.log('ERROR', 'Failed to get rankings', { error: request.error });
        reject(request.error);
      };
    });
  }
  
  // Save business
  async saveBusiness(data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_BUSINESSES], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_BUSINESSES);
      
      const businessData = {
        name: data.name,
        placeId: data.placeId,
        address: data.address,
        phone: data.phone,
        website: data.website,
        category: data.category,
        addedAt: Date.now()
      };
      
      const request = store.add(businessData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // Get all businesses
  async getBusinesses() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_BUSINESSES], 'readonly');
      const store = transaction.objectStore(CONFIG.STORE_BUSINESSES);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // Export all data as JSON
  async exportAllData() {
    const rankings = await this.getRankings();
    const businesses = await this.getBusinesses();
    
    return {
      rankings,
      businesses,
      exportDate: new Date().toISOString(),
      version: CONFIG.VERSION
    };
  }
  
  // Clear all data
  async clearAllData() {
    if (!this.db) await this.init();
    
    const stores = [CONFIG.STORE_RANKINGS, CONFIG.STORE_BUSINESSES, CONFIG.STORE_KEYWORDS];
    
    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    Helpers.log('INFO', 'All data cleared');
  }
}

// Create singleton instance
const storage = new StorageManager();
