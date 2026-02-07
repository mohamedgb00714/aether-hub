#!/usr/bin/env node

/**
 * LinkedIn Data Cleanup Script
 * Removes all LinkedIn accounts and associated data from the database
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// Get database path (same location as Electron app uses)
const userDataPath = path.join(os.homedir(), '.config', 'aether-hub-personal-hub');
const DB_PATH = path.join(userDataPath, 'aether-hub.db');

console.log('🔵 Starting LinkedIn data cleanup...');
console.log(`📁 Database: ${DB_PATH}`);

const db = new Database(DB_PATH);

try {
  // Begin transaction for atomicity
  db.prepare('BEGIN TRANSACTION').run();

  // 1. Find all LinkedIn account IDs
  const linkedinAccounts = db.prepare(
    "SELECT id FROM accounts WHERE platform = 'linkedin'"
  ).all();

  if (linkedinAccounts.length === 0) {
    console.log('✅ No LinkedIn accounts found in database');
    db.prepare('ROLLBACK').run();
    process.exit(0);
  }

  const accountIds = linkedinAccounts.map(acc => acc.id);
  console.log(`📊 Found ${accountIds.length} LinkedIn account(s): ${accountIds.join(', ')}`);

  // 2. Delete associated data from all tables
  const deleteCounts = {
    emails: 0,
    events: 0,
    notifications: 0,
    github_items: 0,
    folders: 0,
    accounts: 0
  };

  // Delete emails
  for (const accountId of accountIds) {
    const result = db.prepare('DELETE FROM emails WHERE account_id = ?').run(accountId);
    deleteCounts.emails += result.changes;
  }

  // Delete events
  for (const accountId of accountIds) {
    const result = db.prepare('DELETE FROM events WHERE account_id = ?').run(accountId);
    deleteCounts.events += result.changes;
  }

  // Delete notifications
  for (const accountId of accountIds) {
    const result = db.prepare('DELETE FROM notifications WHERE account_id = ?').run(accountId);
    deleteCounts.notifications += result.changes;
  }

  // Delete GitHub items (if any)
  for (const accountId of accountIds) {
    const result = db.prepare('DELETE FROM github_items WHERE account_id = ?').run(accountId);
    deleteCounts.github_items += result.changes;
  }

  // Update folders (remove LinkedIn account IDs from account_ids JSON)
  const folders = db.prepare('SELECT id, account_ids FROM folders').all();
  for (const folder of folders) {
    try {
      const accountIdsArray = JSON.parse(folder.account_ids);
      const filtered = accountIdsArray.filter(id => !accountIds.includes(id));
      
      if (filtered.length !== accountIdsArray.length) {
        if (filtered.length === 0) {
          // Delete folder if no accounts left
          const result = db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
          deleteCounts.folders += result.changes;
        } else {
          // Update folder with filtered accounts
          db.prepare('UPDATE folders SET account_ids = ? WHERE id = ?').run(
            JSON.stringify(filtered),
            folder.id
          );
        }
      }
    } catch (e) {
      console.warn(`⚠️  Could not parse folder ${folder.id} account_ids`);
    }
  }

  // Delete LinkedIn accounts
  const result = db.prepare("DELETE FROM accounts WHERE platform = 'linkedin'").run();
  deleteCounts.accounts = result.changes;

  // Commit transaction
  db.prepare('COMMIT').run();

  // Print summary
  console.log('\n✅ LinkedIn data cleanup completed successfully!\n');
  console.log('📊 Deletion Summary:');
  console.log(`   - Accounts:       ${deleteCounts.accounts}`);
  console.log(`   - Emails:         ${deleteCounts.emails}`);
  console.log(`   - Events:         ${deleteCounts.events}`);
  console.log(`   - Notifications:  ${deleteCounts.notifications}`);
  console.log(`   - GitHub Items:   ${deleteCounts.github_items}`);
  console.log(`   - Folders:        ${deleteCounts.folders}`);
  console.log(`\n🎉 Total items removed: ${Object.values(deleteCounts).reduce((a, b) => a + b, 0)}`);

} catch (error) {
  // Rollback on error
  db.prepare('ROLLBACK').run();
  console.error('❌ Error during cleanup:', error);
  process.exit(1);
} finally {
  db.close();
}
