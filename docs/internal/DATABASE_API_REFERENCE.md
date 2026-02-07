# aethermsaid hub Database API - Quick Reference

## Import

```typescript
import { db } from './services/database';
```

## 📧 Emails

```typescript
// Get all emails
const emails = await db.emails.getAll();

// Get by account
const accountEmails = await db.emails.getByAccount(accountId);

// Get unread
const unread = await db.emails.getUnread();

// Get by tag
const workEmails = await db.emails.getByTag('work');

// Add/update emails (bulk)
await db.emails.bulkUpsert([
  {
    id: 'email-1',
    accountId: 'account-1',
    subject: 'Test',
    sender: 'test@example.com',
    preview: 'Email preview',
    timestamp: new Date().toISOString(),
    isRead: false,
    isImportant: false,
    labels: [],
    tags: ['work'],
  }
]);

// Update email
await db.emails.update(emailId, {
  isRead: true,
  tags: ['work', 'important'],
  aiSummary: 'AI generated summary',
});

// Delete email
await db.emails.delete(emailId);

// Clear all emails for an account
await db.emails.clearByAccount(accountId);
```

## 📅 Calendar Events

```typescript
// Get all events
const events = await db.events.getAll();

// Get by account
const accountEvents = await db.events.getByAccount(accountId);

// Get upcoming (default 10)
const upcoming = await db.events.getUpcoming(20);

// Get by date range
const startDate = new Date().toISOString();
const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const weekEvents = await db.events.getByDateRange(startDate, endDate);

// Add/update events (bulk)
await db.events.bulkUpsert([
  {
    id: 'event-1',
    accountId: 'account-1',
    title: 'Team Meeting',
    description: 'Weekly sync',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    location: 'Conference Room A',
    attendees: ['person1@example.com', 'person2@example.com'],
    isAllDay: false,
    eventLink: 'https://meet.google.com/abc-defg-hij',
  }
]);

// Update event with AI briefing
await db.events.update(eventId, {
  aiBriefing: 'Meeting about Q1 planning...',
  aiActionItems: 'Prepare budget proposal, Review metrics',
});

// Delete event
await db.events.delete(eventId);

// Clear all events for an account
await db.events.clearByAccount(accountId);
```

## 👤 Accounts

```typescript
// Get all accounts
const accounts = await db.accounts.getAll();

// Get by ID
const account = await db.accounts.getById(accountId);

// Get by platform
const googleAccounts = await db.accounts.getByPlatform('google');
const outlookAccounts = await db.accounts.getByPlatform('outlook');

// Add/update account
await db.accounts.upsert({
  id: 'google-123',
  name: 'John Doe',
  email: 'john@example.com',
  platform: 'google',
  category: 'email',
  isConnected: true,
  accessToken: 'ya29.a0...',
  refreshToken: '1//0g...',
  tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
  color: '#4285F4',
  folderId: 'folder-work',
  ignored: false,
});

// Delete account (cascades to emails, events, etc.)
await db.accounts.delete(accountId);
```

## 📁 Folders

```typescript
// Get all folders
const folders = await db.folders.getAll();

// Get by ID
const folder = await db.folders.getById(folderId);

// Create folder
await db.folders.create({
  id: 'folder-1',
  name: 'Work',
  color: '#FF5722',
  accountIds: ['account-1', 'account-2'],
});

// Update folder
await db.folders.update(folderId, {
  name: 'Work & Personal',
  accountIds: ['account-1', 'account-2', 'account-3'],
});

// Delete folder
await db.folders.delete(folderId);
```

## 🔔 Notifications

```typescript
// Get all notifications
const notifications = await db.notifications.getAll();

// Get unread
const unread = await db.notifications.getUnread();

// Add notifications (bulk)
await db.notifications.bulkUpsert([
  {
    id: 'notif-1',
    accountId: 'slack-account-1',
    type: 'message',
    title: '#general',
    message: 'Hey team, meeting at 3pm',
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: 0,
    actionUrl: 'https://slack.com/...',
  }
]);

// Mark as read
await db.notifications.markAsRead(notificationId);

// Delete notification
await db.notifications.delete(notificationId);
```

## 🐙 GitHub Items

```typescript
// Get all GitHub items
const items = await db.github.getAll();

// Get by account
const accountItems = await db.github.getByAccount(accountId);

// Get by type
const prs = await db.github.getByType('pr');
const issues = await db.github.getByType('issue');
const notifications = await db.github.getByType('notification');

// Add GitHub items (bulk)
await db.github.bulkUpsert([
  {
    id: 'github-pr-12345',
    accountId: 'github-user-1',
    type: 'pr',
    title: 'Add new feature',
    url: 'https://github.com/owner/repo/pull/123',
    repository: 'owner/repo',
    author: 'username',
    state: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-03T12:00:00Z',
    body: 'This PR adds...',
    labels: ['enhancement', 'priority-high'],
    commentsCount: 5,
    isRead: false,
  }
]);

// Mark as read
await db.github.markAsRead(itemId);

// Delete item
await db.github.delete(itemId);

// Clear all GitHub data for account
await db.github.clearByAccount(accountId);
```

## 🔗 Connectors

### Google
```typescript
import { connectGoogleAccount, fetchGmailMessages, fetchCalendarEvents } from './services/connectors/googleAuth';

const account = await connectGoogleAccount();
await db.accounts.upsert(account);

const emails = await fetchGmailMessages(100);
await db.emails.bulkUpsert(emails.map(e => ({ ...e, accountId: account.id })));
```

### Outlook
```typescript
import { connectOutlookAccount, syncOutlookAccount } from './services/connectors/outlookAuth';

const account = await connectOutlookAccount();
await db.accounts.upsert(account);

const { emails, events } = await syncOutlookAccount(account);
await db.emails.bulkUpsert(emails);
await db.events.bulkUpsert(events);
```

### Slack
```typescript
import { connectSlackAccount, syncSlackAccount } from './services/connectors/slackAuth';

const account = await connectSlackAccount();
await db.accounts.upsert(account);

const { notifications } = await syncSlackAccount(account);
await db.notifications.bulkUpsert(notifications);
```

### GitHub
```typescript
import { connectGitHubAccount, syncGitHubAccount } from './services/connectors/githubConnector';

const token = 'ghp_...'; // From user input
const account = await connectGitHubAccount(token);
await db.accounts.upsert(account);

const { items } = await syncGitHubAccount(account);
await db.github.bulkUpsert(items);
```

## 🔄 Auto-Sync

```typescript
import { startAutoSync, stopAutoSync, syncAllAccounts } from './services/autoSync';

// Start automatic syncing (every 5 minutes)
startAutoSync();

// Manual sync
const result = await syncAllAccounts();
console.log(`Synced ${result.synced.length} accounts`);

// Stop auto-sync
stopAutoSync();
```

## 🏷️ Email Tags

Available tags: `'work' | 'personal' | 'important' | 'newsletter' | 'social' | 'promotions' | 'updates' | 'finance' | 'travel'`

```typescript
// Add tag to email
const email = await db.emails.getById(emailId);
await db.emails.update(emailId, {
  tags: [...email.tags, 'work']
});

// Remove tag
await db.emails.update(emailId, {
  tags: email.tags.filter(t => t !== 'work')
});

// Get emails by tag
const workEmails = await db.emails.getByTag('work');
```

## 🎯 Common Patterns

### Filter emails by account and tag
```typescript
const accounts = await db.accounts.getAll();
const activeAccounts = accounts.filter(a => a.isConnected && !a.ignored);

const allEmails = await db.emails.getAll();
const filtered = allEmails
  .filter(e => activeAccounts.some(a => a.id === e.accountId))
  .filter(e => e.tags.includes('work'));
```

### Get today's events
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const todayEvents = await db.events.getByDateRange(
  today.toISOString(),
  tomorrow.toISOString()
);
```

### Get unread count by account
```typescript
const accounts = await db.accounts.getAll();
const unreadEmails = await db.emails.getUnread();

const unreadByAccount = accounts.map(account => ({
  accountId: account.id,
  accountName: account.name,
  unreadCount: unreadEmails.filter(e => e.accountId === account.id).length,
}));
```

### Sync single account
```typescript
const account = await db.accounts.getById(accountId);

if (account.platform === 'google') {
  const [emails, events] = await Promise.all([
    fetchGmailMessages(100),
    fetchCalendarEvents(30)
  ]);
  await db.emails.bulkUpsert(emails.map(e => ({ ...e, accountId: account.id })));
  await db.events.bulkUpsert(events.map(e => ({ ...e, accountId: account.id })));
}
```

## 🐛 Error Handling

```typescript
try {
  const emails = await db.emails.getAll();
} catch (error) {
  console.error('Failed to fetch emails:', error);
  // Database errors are logged in main process
  // Check Electron DevTools console for details
}
```

## 📊 Performance Tips

1. **Use bulk operations** - `bulkUpsert()` is much faster than multiple `upsert()` calls
2. **Filter in SQL** - Use `getByAccount()`, `getByTag()`, `getUnread()` instead of filtering in JS
3. **Limit results** - Use `getUpcoming(limit)` instead of `getAll()` when possible
4. **Index queries** - Database has indexes on `account_id`, `timestamp`, `start_time`
5. **Transactions are automatic** - Bulk operations use transactions for atomicity

## 🔐 Security Notes

- OAuth tokens are stored in SQLite (user data directory)
- For production, consider encrypting the database file
- Never commit API keys or secrets to Git
- Use environment variables for sensitive configuration

## 📝 Type Safety

All database methods are fully typed:

```typescript
import type { Email, Account, CalendarEvent, Notification } from '../types';
import type { GithubItem } from './database';

// TypeScript will enforce correct types
const emails: Email[] = await db.emails.getAll();
const account: Account | undefined = await db.accounts.getById(id);
```
