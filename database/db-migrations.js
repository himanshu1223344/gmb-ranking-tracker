// Database migration utilities
const DBMigrations = {
  
  // Run all migrations up to current version
  async migrate(db, oldVersion, newVersion) {
    console.log(`Migrating database from v${oldVersion} to v${newVersion}`);
    
    // Run migrations sequentially
    for (let v = oldVersion + 1; v <= newVersion; v++) {
      const migrationFn = this[`migrateToV${v}`];
      
      if (migrationFn) {
        await migrationFn.call(this, db);
        console.log(`Migration to v${v} complete`);
      }
    }
  },
  
  // Migration to version 1 (initial schema)
  migrateToV1(db) {
    console.log('Creating initial database schema...');
    // Schema is created in storage.js onupgradeneeded
  }
  
  // Future migrations would be added here:
  // migrateToV2(db) { ... }
  // migrateToV3(db) { ... }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DBMigrations;
}
