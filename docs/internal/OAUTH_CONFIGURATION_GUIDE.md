# OAuth Configuration Guide

This guide will help you set up OAuth applications for Outlook, Slack, and GitHub integration in aethermsaid hub.

---

## 🔷 Microsoft Outlook Configuration

### Step 1: Create Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**

### Step 2: Configure Application

**Basic Settings:**
- **Name:** `aethermsaid hub` (or your preferred name)
- **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
- **Redirect URI:** 
  - Type: **Web**
  - URI: `http://localhost:8089/oauth/callback`

Click **Register**

### Step 3: API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add these scopes:
   - `openid`
   - `profile`
   - `email`
   - `offline_access`
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Calendars.Read`
   - `User.Read`

4. Click **Grant admin consent** (if you're an admin) or request admin approval

### Step 4: Get Client ID

1. Go to **Overview**
2. Copy the **Application (client) ID**
3. Open `/src/services/connectors/outlookAuth.ts`
4. Replace this line:

```typescript
const MICROSOFT_CLIENT_ID = ''; // Your Client ID here
```

With:

```typescript
const MICROSOFT_CLIENT_ID = '12345678-1234-1234-1234-123456789abc'; // Your actual Client ID
```

### Step 5: Authentication Settings (Optional - For Production)

1. Go to **Authentication**
2. Under **Advanced settings**:
   - **Allow public client flows:** YES (for desktop app)
   - **Supported account types:** Personal Microsoft accounts and organizational accounts

### Notes:
- ⚠️ **No Client Secret needed** for public client flow (desktop app)
- For production, consider using MSAL (Microsoft Authentication Library) for better security
- Tokens are stored locally in SQLite database

---

## 💬 Slack Configuration

### Step 1: Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**

### Step 2: Basic Information

**App Name:** `aethermsaid hub` (or your preferred name)
**Development Slack Workspace:** Choose your workspace

Click **Create App**

### Step 3: OAuth & Permissions

1. Go to **OAuth & Permissions** from sidebar
2. Under **Redirect URLs**, click **Add New Redirect URL**:
   - URL: `http://localhost:8089/oauth/callback`
   - Click **Add**
   - Click **Save URLs**

### Step 4: Scopes

Scroll to **Bot Token Scopes** and add:

**Required scopes:**
- `channels:read` - View basic channel info
- `channels:history` - View messages in public channels
- `groups:read` - View basic private channel info  
- `groups:history` - View messages in private channels
- `im:read` - View basic DM info
- `im:history` - View messages in DMs
- `mpim:read` - View basic group DM info
- `mpim:history` - View messages in group DMs
- `users:read` - View people in workspace
- `team:read` - View workspace info

**User Token Scopes** (optional):
- `identity.basic`
- `identity.email`

### Step 5: Get Credentials

1. Go to **Basic Information**
2. Scroll to **App Credentials**
3. Copy:
   - **Client ID**
   - **Client Secret** ⚠️ **Keep this secret!**

4. Open `/src/services/connectors/slackAuth.ts`
5. Replace:

```typescript
const SLACK_CLIENT_ID = ''; // Your Client ID here
const SLACK_CLIENT_SECRET = ''; // Your Client Secret here
```

With your actual credentials:

```typescript
const SLACK_CLIENT_ID = '1234567890.1234567890';
const SLACK_CLIENT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
```

### Step 6: Install App

1. Go to **OAuth & Permissions**
2. Click **Install to Workspace**
3. Review permissions and click **Allow**

### Step 7: Invite Bot to Channels

In Slack, invite your bot to channels you want to sync:

```
/invite @aethermsaid hub
```

### Notes:
- ⚠️ **Never commit Client Secret to Git** - Use environment variables in production
- Bot needs to be invited to channels to read messages
- DMs and private channels require explicit access
- Consider using [Slack Events API](https://api.slack.com/apis/connections/events-api) for real-time updates

---

## 🐙 GitHub Configuration

### Step 1: Generate Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**

### Step 2: Configure Token

**Note:** `aethermsaid hub Desktop Access`

**Expiration:** Choose expiration (e.g., 90 days, No expiration)

**Select scopes:**
- ✅ `repo` - Full control of private repositories
  - Includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`
- ✅ `notifications` - Access notifications
- ✅ `read:user` - Read user profile data
- ✅ `user:email` - Access user email addresses (optional)

### Step 3: Generate and Copy Token

1. Click **Generate token**
2. **⚠️ Copy the token immediately** - You won't see it again!
   - Format: `ghp_abcd1234efgh5678ijkl9012mnop3456qrst7890`

### Step 4: Use Token in App

The token is entered by users when connecting their GitHub account:

```typescript
// In your Accounts.tsx or connection flow:
import { connectGitHubAccount } from './services/connectors/githubConnector';

const handleConnectGitHub = async () => {
  const token = prompt('Enter your GitHub Personal Access Token:');
  if (!token) return;
  
  try {
    const account = await connectGitHubAccount(token);
    await db.accounts.upsert(account);
    alert('GitHub account connected!');
  } catch (error) {
    alert('Failed to connect GitHub: ' + error.message);
  }
};
```

### Notes:
- ⚠️ **Store tokens securely** - They're stored encrypted in SQLite
- **Token permissions can't be changed** - Generate new token if you need different scopes
- **Revoke old tokens** at [github.com/settings/tokens](https://github.com/settings/tokens)
- Consider using [GitHub Apps](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps) for organization-wide integration

---

## 🔐 Security Best Practices

### For Development:

1. **Use .env file** for secrets:

```env
# .env.local (DO NOT COMMIT)
MICROSOFT_CLIENT_ID=your-client-id
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
```

2. **Load in connector files:**

```typescript
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
```

3. **Add to .gitignore:**

```gitignore
.env
.env.local
.env.production
*.secret
```

### For Production:

1. **Use Electron Secure Storage:**

```typescript
import Store from 'electron-store';

const secureStore = new Store({
  encryptionKey: process.env.ENCRYPTION_KEY,
});

// Store credentials
secureStore.set('microsoft_client_id', clientId);
```

2. **Environment-based Configuration:**

```typescript
const isDev = process.env.NODE_ENV === 'development';

const MICROSOFT_CLIENT_ID = isDev 
  ? 'dev-client-id-123' 
  : process.env.PROD_MICROSOFT_CLIENT_ID;
```

3. **OAuth State Verification:**

```typescript
// Generate random state
const state = crypto.randomUUID();
sessionStorage.setItem('oauth_state', state);

// Verify on callback
const returnedState = params.get('state');
if (returnedState !== sessionStorage.getItem('oauth_state')) {
  throw new Error('State mismatch - possible CSRF attack');
}
```

4. **Token Encryption in Database:**

Consider encrypting access tokens before storing:

```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const secretKey = process.env.TOKEN_ENCRYPTION_KEY;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  // ... encryption logic
}
```

---

## 🧪 Testing OAuth Flows

### Test Outlook Connection:

```bash
# In browser DevTools console after connecting:
const accounts = await window.electronAPI.db.accounts.getAll();
const outlookAccount = accounts.find(a => a.platform === 'outlook');
console.log('Token expires:', new Date(outlookAccount.tokenExpiresAt));
```

### Test Slack Connection:

```bash
# Verify bot has access to channels:
const notifications = await window.electronAPI.db.notifications.getAll();
const slackNotifs = notifications.filter(n => n.accountId.startsWith('slack-'));
console.log(`Synced ${slackNotifs.length} Slack messages`);
```

### Test GitHub Connection:

```bash
# Check PR/Issue sync:
const items = await window.electronAPI.db.github.getAll();
console.log(`PRs: ${items.filter(i => i.type === 'pr').length}`);
console.log(`Issues: ${items.filter(i => i.type === 'issue').length}`);
```

---

## 📚 Additional Resources

### Microsoft:
- [Microsoft Identity Platform Docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Graph API Reference](https://docs.microsoft.com/en-us/graph/api/overview)
- [OAuth 2.0 Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Slack:
- [Slack API Documentation](https://api.slack.com/docs)
- [OAuth Guide](https://api.slack.com/authentication/oauth-v2)
- [Scopes Reference](https://api.slack.com/scopes)

### GitHub:
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub API](https://docs.github.com/en/rest)
- [GitHub Apps vs OAuth](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps)

---

## ❓ Troubleshooting

### "Redirect URI mismatch"
**Solution:** Ensure redirect URI in OAuth provider matches exactly: `http://localhost:8089/oauth/callback`

### "Invalid scope"
**Solution:** Check that all requested scopes are added in OAuth provider settings

### "Token expired"
**Solution:** Automatic token refresh is implemented. If it fails, user needs to re-authenticate

### "CORS error"
**Solution:** OAuth flows should open in browser, not in-app. Ensure `window.electronAPI.oauth.openExternal()` is used

### "Port 8089 in use"
**Solution:** OAuth server port is hardcoded. Change `OAUTH_PORT` in `electron/main.ts` and update redirect URIs

---

## ✅ Configuration Checklist

- [ ] Azure AD app created with correct redirect URI
- [ ] Microsoft Graph API permissions granted
- [ ] Client ID added to `outlookAuth.ts`
- [ ] Slack app created with correct redirect URI
- [ ] Slack bot scopes configured
- [ ] Slack Client ID and Secret added to `slackAuth.ts`
- [ ] Slack app installed to workspace
- [ ] Slack bot invited to relevant channels
- [ ] GitHub Personal Access Token generated
- [ ] GitHub token scopes include `repo` and `notifications`
- [ ] All credentials stored securely (not committed to Git)
- [ ] .env file added to .gitignore
- [ ] OAuth server running on port 8089
- [ ] Test connections work for all platforms

---

**Need help?** Check the implementation docs:
- [SQLITE_IMPLEMENTATION_COMPLETE.md](./SQLITE_IMPLEMENTATION_COMPLETE.md) - Full implementation guide
- [DATABASE_API_REFERENCE.md](./DATABASE_API_REFERENCE.md) - Database API quick reference
