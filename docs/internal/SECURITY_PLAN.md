# aethermsaid hub Security Plan

## Overview

This document outlines the security architecture, data handling practices, and privacy controls implemented in aethermsaid hub Electron. As a privacy-first application, aethermsaid hub is designed to keep all user data local and secure.

## Current Security Measures

### 1. Application Security Architecture

#### Context Isolation
- **Enabled**: Context isolation is enforced in all renderer processes
- **Node Integration**: Disabled in renderer to prevent direct access to Node.js APIs
- **Sandboxing**: Renderer processes run in sandboxed environments
- **IPC Bridge**: All main process communication goes through secure `contextBridge` in preload script

#### Content Security Policy (CSP)
- Enforced CSP headers prevent unauthorized script execution
- Allows only necessary domains (Google AI endpoints)
- Blocks unsafe-eval and inline scripts
- Protects against XSS attacks

### 2. Data Storage Security

#### Encrypted Storage
- **electron-store**: All credentials and sensitive settings stored with encryption
- **Encryption Key**: `aether-hub-secure-key-v1` (hardcoded for development)
- **Production Recommendation**: Use environment variable or OS keychain for encryption key

#### Secure Credential Storage
Encrypted storage for:
- OAuth tokens (access_token, refresh_token)
- API keys (Gemini, OpenRouter, ElevenLabs, Resend, Discord)
- Account credentials
- Privacy settings

#### SQLite Database
- Local storage in user's data directory
- No cloud backup by default
- Contains:
  - Account information (with tokens)
  - Emails (subject, sender, preview, full content)
  - Calendar events
  - Messages (WhatsApp, Discord)
  - Chat histories
  - User activities
  - Knowledge insights

### 3. Network Security

#### Local-First Architecture
- All data processing happens locally
- No automatic cloud synchronization
- API calls are stateless (Gemini, OpenRouter)
- User data is never sent to third-party training systems

#### OAuth Security
- Local OAuth callback server (127.0.0.1:8089)
- Redirect URIs are localhost-only
- Authorization codes handled securely
- Tokens stored encrypted immediately after retrieval

## Data Classification

### Highly Sensitive Data
**Requires Encryption & Cleanup Options**

1. **Email Content**
   - Full email bodies
   - Attachments
   - Recipient lists
   - Sensitive subjects

2. **Message Content**
   - WhatsApp message bodies
   - Discord message content
   - Chat histories
   - Direct messages

3. **Credentials**
   - OAuth tokens
   - API keys
   - Passwords (if any)

### Moderately Sensitive Data
**Metadata - Can be retained for functionality**

1. **Communication Metadata**
   - Timestamps
   - Sender/recipient identifiers
   - Message counts
   - Read/unread status

2. **Account Information**
   - Account names
   - Email addresses
   - Platform identifiers

### Non-Sensitive Data
**Aggregated & Anonymized**

1. **Usage Statistics**
   - Action types
   - Platform usage counts
   - No personal identifiers

## Data Retention Policies

### Default Retention Periods

1. **Email Content**: Retained until user deletion
2. **Message Content**: Retained until user deletion
3. **Chat Histories**: Retained until session deletion
4. **User Activities**: 90 days (configurable)
5. **Conversation Summaries**: Retained until manual deletion
6. **Knowledge Insights**: Retained until manual deletion

### Automatic Cleanup

1. **Old Activities**: Activities older than configured retention period are automatically deleted
2. **Disconnected Accounts**: Option to delete all data when account is disconnected
3. **Session Data**: Temporary session data cleared on app restart

## Sensitive Data Handling Procedures

### 1. Data Minimization

#### Email Processing
- Store only necessary fields (subject, sender, preview)
- Full body content optional (user-configurable)
- Attachments not downloaded by default
- AI summaries replace full content when possible

#### Message Processing
- Store message metadata primarily
- Full message content stored temporarily for AI processing
- Option to auto-delete message bodies after AI analysis

### 2. Data Deletion

#### Complete Data Deletion
Users can delete:
- Individual emails, messages, events
- All data for a specific account
- All data for a specific platform
- All chat histories
- All knowledge insights

#### Selective Content Removal
- Remove email bodies while keeping metadata
- Remove message content while keeping summaries
- Clear AI-generated content
- Preserve structure, remove sensitive content

### 3. AI Processing

#### Stateless Processing
- Gemini API calls are stateless
- No conversation history sent to AI
- Only current context included in prompts
- User data never used for model training

#### Data Sent to AI
- Email subjects and previews (for summaries)
- Calendar event details (for briefings)
- Message content (for insights)
- User explicitly controls what goes to AI

## Data Cleanup Functions

### Database Cleanup Operations

#### 1. Clear Email Content
```typescript
// Removes email bodies and sensitive content
// Keeps: subject, sender, timestamp, metadata
// Removes: full content, recipient details, AI suggestions
```

#### 2. Clear Message Content
```typescript
// Removes message bodies from WhatsApp/Discord
// Keeps: timestamps, sender IDs, metadata
// Removes: message text, media URLs
```

#### 3. Clear Chat Histories
```typescript
// Deletes all chat sessions and messages
// Option to keep summaries
```

#### 4. Clear User Activities
```typescript
// Deletes activity logs older than specified days
// Preserves aggregated insights
```

### Secure Deletion Process

1. **Verification**: Confirm deletion scope with user
2. **Backup Prompt**: Optional export before deletion
3. **Execution**: Run DELETE queries on SQLite database
4. **VACUUM**: Reclaim disk space after deletion
5. **Verification**: Confirm data no longer accessible
6. **Log**: Record deletion event (no content details)

## Privacy Controls

### User-Facing Controls

#### 1. Data Retention Settings
- Configure how long to keep emails
- Configure how long to keep messages
- Configure activity log retention
- Auto-cleanup schedules

#### 2. Selective Sync
- Choose which account types to sync
- Exclude specific folders/channels
- Limit date ranges for sync
- Skip attachments/media

#### 3. AI Opt-out
- Disable AI processing per account
- Clear existing AI insights
- Prevent specific data types from AI
- Local-only mode (no API calls)

#### 4. Data Export
- Export data before deletion
- JSON format for portability
- Encrypted backup option

### Emergency Privacy Mode

#### Panic Button Features
1. **Quick Clear**
   - Clear all sensitive content immediately
   - Keep only essential metadata
   - Disable all sync operations

2. **Account Lockdown**
   - Disconnect all accounts
   - Clear all OAuth tokens
   - Stop all background processes

3. **Data Wipe**
   - Complete database deletion
   - Clear all settings
   - Remove session data

## API Key Security

### Storage
- All API keys encrypted in electron-store
- Never logged or displayed in plaintext
- Masked in UI (show first/last 4 chars only)

### Transmission
- HTTPS only for all API calls
- Keys in Authorization headers (never URL params)
- No caching of API responses with keys

### Rotation
- Support for key updates without data loss
- Old keys securely wiped on update
- Prompt for re-authentication when tokens expire

## Compliance Considerations

### GDPR Compliance
- **Right to Access**: Export functionality
- **Right to Deletion**: Complete data removal
- **Data Minimization**: Configurable retention
- **Purpose Limitation**: Clear data usage policies
- **Storage Limitation**: Retention periods enforced

### CCPA Compliance
- User control over data collection
- Disclosure of data categories collected
- Deletion capabilities
- No sale of personal information

## Incident Response Plan

### Data Breach Response

1. **Detection**
   - Monitor for unauthorized access
   - Check database file permissions
   - Audit log analysis

2. **Containment**
   - Revoke compromised tokens
   - Disconnect affected accounts
   - Clear sensitive data

3. **Investigation**
   - Identify scope of breach
   - Determine affected data
   - Root cause analysis

4. **Recovery**
   - Re-encrypt database
   - Rotate all API keys
   - Reconnect accounts with new tokens

5. **Notification**
   - Inform affected users
   - Provide remediation steps
   - Document incident

### Lost Device Protocol

1. **Remote Actions** (if implemented)
   - Revoke OAuth tokens remotely
   - Invalidate session

2. **Local Protection**
   - Disk encryption recommended
   - Lock screen after inactivity
   - Encrypted backups only

## Security Audit Checklist

### Regular Audits (Quarterly)

- [ ] Review encryption implementation
- [ ] Check for outdated dependencies (npm audit)
- [ ] Verify CSP headers
- [ ] Test data deletion functions
- [ ] Review access logs
- [ ] Update API keys if needed
- [ ] Check for exposed credentials in logs
- [ ] Verify secure storage permissions

### Code Review (Per Release)

- [ ] No secrets in source code
- [ ] Secure IPC channel usage
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in renderer
- [ ] No eval() or similar unsafe functions

## Future Enhancements

### Planned Security Improvements

1. **Enhanced Encryption**
   - Use OS keychain for encryption keys
   - Per-account encryption
   - End-to-end encryption for backups

2. **Biometric Authentication**
   - Face ID / Touch ID on macOS
   - Windows Hello integration
   - App unlock on startup

3. **Audit Logging**
   - Track all data access
   - Log all deletions
   - Export audit trail

4. **Data Anonymization**
   - Automatic PII detection
   - Redaction options
   - Anonymized analytics mode

5. **Security Hardening**
   - Certificate pinning for API calls
   - Runtime integrity checks
   - Tamper detection

## Contact & Reporting

### Security Vulnerabilities
For security issues, please report to:
- **Email**: mohamedgb00714@gmail.com
- **Author**: msaid mohamed el hadi
- **Private**: Do not disclose publicly until patched

### Privacy Questions
For privacy-related questions:
- **Documentation**: See this file and README.md
- **Support**: [support channel TBD]

---

**Last Updated**: 2026-01-04  
**Version**: 2.0  
**Status**: Active
