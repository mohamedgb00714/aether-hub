# LinkedIn Data Cleanup Guide

## Option 1: Using DevTools Console (Recommended)

1. **Open the app** in development mode:
   ```bash
   pnpm run dev:electron
   ```

2. **Open DevTools** (Ctrl+Shift+I or Cmd+Option+I)

3. **Run this command in the Console**:
   ```javascript
   window.electronAPI.db.cleanupLinkedIn().then(result => {
     console.log('✅ Cleanup Result:', result);
     if (result.success) {
       console.table(result.deleteCounts);
     }
   });
   ```

4. **Check the output** - you'll see a summary like:
   ```
   ✅ Cleanup Result: {
     success: true,
     message: "Successfully removed X LinkedIn-related items",
     deleteCounts: {
       accounts: 1,
       emails: 42,
       events: 5,
       notifications: 15,
       github_items: 0,
       folders: 1
     }
   }
   ```

## Option 2: Using HTML Cleanup Tool

1. **Build and run the app**:
   ```bash
   pnpm run dev:electron
   ```

2. **Open the cleanup HTML file** in the app by going to:
   ```
   File > Open File > /path/to/aether-hubelectron/run-linkedin-cleanup.html
   ```

3. **Click the "Remove All LinkedIn Data" button**

4. **View the results** showing exactly what was deleted

## What Gets Removed

The cleanup process removes:
- ✅ All LinkedIn accounts from the `accounts` table
- ✅ All emails associated with LinkedIn accounts
- ✅ All calendar events from LinkedIn accounts
- ✅ All notifications from LinkedIn accounts
- ✅ All GitHub items (if any) linked to LinkedIn accounts
- ✅ LinkedIn account references from folders (or delete empty folders)

## Database Backup (Optional)

Before running cleanup, you can backup your database:

```bash
cp ~/.config/aether-hub-personal-hub/aether-hub.db ~/.config/aether-hub-personal-hub/aether-hub.db.backup
```

To restore:
```bash
cp ~/.config/aether-hub-personal-hub/aether-hub.db.backup ~/.config/aether-hub-personal-hub/aether-hub.db
```

## Verification

After cleanup, verify LinkedIn data is gone:

```javascript
// Check for LinkedIn accounts
window.electronAPI.db.accounts.getByPlatform('linkedin').then(accounts => {
  console.log('LinkedIn accounts:', accounts); // Should be empty array
});
```

## Notes

- The cleanup runs in a transaction - it either completes fully or rolls back on error
- All associated data is removed atomically
- The operation is irreversible (unless you have a backup)
