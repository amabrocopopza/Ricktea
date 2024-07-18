const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../sys/logger'); // Ensure logging is available
const dbPath = path.resolve(__dirname, '..', 'sys', 'threads.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error(`⛑️ Error opening database: ${err.message}`);
  } else {
    logger.info(`🥝 Database opened successfully at ${dbPath}`);
  }
});

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS threads (user_id TEXT PRIMARY KEY, thread_id TEXT, timestamp TEXT)", (err) => {
    if (err) {
      logger.error(`⛑️ Error creating table: ${err.message}`);
    } else {
      logger.info("🥝 Table 'threads' ensured to exist.");
    }
  });
});

function getThreadId(user_id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT thread_id FROM threads WHERE user_id = ?", [user_id], (err, row) => {
      if (err) {
        logger.error(`⛑️ Error getting thread ID for user ${user_id}: ${err.message}`);
        return reject(err);
      }
      logger.info(`🥝 Retrieved thread for ${user_id}: ${row ? row.thread_id : 'None'}`);
      resolve(row ? row.thread_id : null);
    });
  });
}

function saveThreadId(user_id, thread_id) {
  const timestamp = Date.now().toString();
  return new Promise((resolve, reject) => {
    db.run("INSERT OR REPLACE INTO threads (user_id, thread_id, timestamp) VALUES (?, ?, ?)", [user_id, thread_id, timestamp], (err) => {
      if (err) {
        logger.error(`⛑️ Error saving thread ID for user ${user_id}: ${err.message}`);
        return reject(err);
      }
      logger.info(`🥝 Saved thread ID ${thread_id} for user ${user_id}`);
      resolve();
    });
  });
}

// Close the database connection when the process exits to free up resources
process.on('exit', () => {
  db.close((err) => {
    if (err) {
      logger.error(`⛑️ Error closing database: ${err.message}`);
    } else {
      logger.info('🥝 Database connection closed.');
    }
  });
});

module.exports = { getThreadId, saveThreadId };
