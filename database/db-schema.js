// IndexedDB Schema Definition
const DB_SCHEMA = {
  name: 'GMBRankingDB',
  version: 1,
  
  stores: {
    rankings: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'businessName', keyPath: 'businessName', unique: false },
        { name: 'keyword', keyPath: 'keyword', unique: false },
        { name: 'timestamp', keyPath: 'timestamp', unique: false },
        { name: 'placeId', keyPath: 'placeId', unique: false }
      ]
    },
    
    businesses: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'placeId', keyPath: 'placeId', unique: true }
      ]
    },
    
    keywords: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'keyword', keyPath: 'keyword', unique: true }
      ]
    },
    
    settings: {
      keyPath: 'key'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DB_SCHEMA;
}
