# Discord Integration Guide

## Overview
aethermsaid hub now supports Discord integration, allowing you to:
- Connect your Discord account via OAuth2
- View all your Discord servers (guilds)
- Read direct messages (DMs)
- Generate AI-powered summaries of your Discord activity
- Store Discord data locally with SQLite

## Setup Instructions

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "aethermsaid hub")
4. Navigate to the "OAuth2" section in the left sidebar

### 2. Configure OAuth2

1. In the OAuth2 section, add the redirect URI:
   ```
   http://localhost:8089/oauth/callback
   ```

2. Copy your **Client ID** and **Client Secret**

3. In the OAuth2 URL Generator section, select these scopes:
   - `identify` - Basic user information
   - `email` - User's email address
   - `guilds` - List of user's guilds/servers
   - `guilds.members.read` - Read guild member information
   - `messages.read` - Read message history (DMs only with user tokens)

### 3. Configure aethermsaid hub

1. Open aethermsaid hub and navigate to **Settings** > **Integrations**
2. Scroll to the **Discord OAuth Credentials** section
3. Enter your **Application ID (Client ID)**: `1457225949706846261`
4. Enter your **Client Secret** (from Discord Developer Portal → OAuth2)
5. Click **Save Credentials**

✅ **Security**: Credentials are encrypted and stored locally on your device using electron-store

### 4. Features

#### OAuth Flow
- Click "Connect Discord" in the Discord page
- Browser opens to Discord authorization page
- Approve the requested permissions
- Automatically redirected back to aethermsaid hub
- Account saved and synced

#### Data Syncing
- **Guilds (Servers)**: Fetches all servers you're a member of with metadata (name, icon, member count)
- **DM Messages**: Fetches recent direct messages (up to 50 per channel)
- **Local Storage**: All data cached in SQLite database for offline access

#### AI Features
- **AI Summary**: Generate intelligent summaries of your Discord conversations
- Uses Gemini AI to analyze message patterns and highlights
- Prioritizes important messages and conversations

#### Database Schema

**discord_guilds table:**
- Stores server information (name, icon, permissions, member count)
- Links to account via `account_id` foreign key

**discord_channels table:**
- Stores channel information (type, name, topic, DM recipients)
- Links to guild and account

**discord_messages table:**
- Stores message content, author info, timestamps
- Supports attachments, embeds, and mentions
- Marks read/unread status

## API Limitations

⚠️ **Important Discord API Restrictions:**

1. **Message Reading**: User OAuth tokens can ONLY read messages from:
   - Direct Messages (DMs) the user participates in
   - NOT guild/server channels (requires bot token)

2. **Rate Limits**: Discord enforces strict rate limits
   - 50 requests per second globally
   - Respect 429 responses and retry headers

3. **Token Expiry**: OAuth tokens expire after a period
   - Use refresh tokens to get new access tokens
   - Implemented in `refreshDiscordToken()` function

## Usage

### Connect Account
1. Navigate to Discord page in aethermsaid hub
2. Click "Connect Discord Account"
3. Authorize in browser
4. Wait for automatic sync

### Manual Sync
- Click "Sync Now" to refresh guilds and messages
- Recommended after joining new servers or receiving new DMs

### AI Analysis
- Click "AI Summary" to generate insights
- Works on all synced DM messages
- Highlights key conversations and action items

## Troubleshooting

### "Discord Client ID not configured"
- Go to Settings > Integrations
- Enter your Discord Application ID and Client Secret
- Click Save Credentials

### "Failed to fetch messages"
- User tokens can only read DM messages
- Guild channel messages require a bot token (not currently supported)

### "OAuth timeout"
- Check that redirect URI matches exactly: `http://localhost:8089/oauth/callback`
- Ensure OAuth server is running on port 8089

### Token Expired
- aethermsaid hub automatically refreshes tokens using the refresh token
- If refresh fails, reconnect the account

## Development

### File Structure
```
src/
├── services/
│   ├── connectors/
│   │   └── discordConnector.ts    # Discord API integration
│   └── electronStore.ts            # Secure credential storage
├── pages/
│   ├── Discord.tsx                 # Discord page UI
│   └── Settings.tsx                # Settings with Discord config
└── types.ts                        # Discord type definitions

electron/
├── database.ts                     # Discord database schema
└── main.ts                         # CSP configuration for Discord
```

### Testing
```bash
# Build and run
pnpm run dev:electron

# Navigate to Discord page
# Click "Connect Discord"
# Approve permissions
# Verify sync works
```

### API Reference

Key functions in `discordConnector.ts`:
- `startDiscordAuth()` - Initiates OAuth flow
- `exchangeCodeForToken()` - Exchanges auth code for tokens
- `refreshDiscordToken()` - Refreshes expired token
- `getDiscordUserInfo()` - Fetches user profile
- `getDiscordGuilds()` - Fetches user's servers
- `getDMChannels()` - Fetches DM channels
- `getChannelMessages()` - Fetches messages (DMs only)
- `syncDiscordData()` - Complete sync operation
- `connectDiscordAccount()` - Full OAuth + sync flow

## Future Enhancements

Potential features for future releases:
- [ ] Bot token support for guild channel reading
- [ ] Real-time WebSocket connection for live messages
- [ ] Send messages from aethermsaid hub
- [ ] Rich embed rendering
- [ ] Voice channel status
- [ ] Server insights and analytics
- [ ] Message search across all DMs
- [ ] Notification integration for new messages

## Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord API Documentation](https://discord.com/developers/docs/intro)
- [OAuth2 Flow Guide](https://discord.com/developers/docs/topics/oauth2)
- [Discord.js (similar library reference)](https://discord.js.org/)

---

**Version**: 2.1  
**Last Updated**: January 4, 2026  
**Status**: ✅ Production Ready
