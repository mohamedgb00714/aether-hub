# aethermsaid hub Open Source Migration & Security Hardening Plan

This document outlines the required steps to safely transition **aethermsaid hub** to an open-source repository.

## 1. Credentials & Secret Removal 🛑
- [x] **Delete `appinformations`**: This file contains production API keys (Google, GitHub, Resend) and must be removed before the first public commit.
- [x] **Scrub Hardcoded Encryption Keys**: 
    - Replace `'aether-hub-secure-key-v1'` in [electron/main.ts](electron/main.ts) with `process.env.AETHER_ENCRYPTION_KEY` or a generated local secret.
    - Replace `'aether-hub-secure-key-v1'` in [electron/addon-server.ts](electron/addon-server.ts).
- [ ] **Remove sensitive history**: If secrets were previously committed, use a tool like `bfg-repo-cleaner` or `git filter-repo` to purge them from the history before pushing to a public remote.

## 2. Secure Local Storage Architecture 🔒
- [x] **Transition to `safeStorage`**: Instead of a static encryption key in `electron-store`, use Electron's [safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) which uses the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service).
- [x] **Implement `.env` support**: Ensure all service-level API keys (Gemini, Resend, etc.) are pulled from `process.env` in both the main and renderer processes.

## 3. Repository Configuration 🛠️
- [x] **Update `.gitignore`**:
    ```ignore
    # Databases
    *.db
    *.sqlite
    *.sqlite-journal

    # WhatsApp Session Data
    .wwebjs_cache/
    .wwebjs_auth/

    # Security
    appinformations
    .env
    .env.*
    ```
- [x] **Create `.env.example`**: Provide a template for contributors to set up their own local keys.
- [x] **Update `package.json`**:
    - Add `"license": "MIT"` or `"AGPL-3.0-only"`.
    - Populate `"repository"`, `"bugs"`, and `"homepage"` fields.

## 4. Documentation Strategy 📖
- [x] **`README.md`**: Update with setup instructions and a "Privacy First" disclaimer.
- [x] **`CONTRIBUTING.md`**: Define the workflow for PRs and issues.
- [x] **`SECURITY.md`**: Provide a private channel for reporting vulnerabilities.
- [x] **`LICENSE`**: Add the full text of your chosen license.

## 5. Monetization Integration 💰
- [ ] **Plugin Infrastructure**: Abstract the connector logic (WhatsApp, Resend) so that "Pro" versions can be offered as gated binary extensions while core code remains open.
- [ ] **API Proxying**: Update [src/services/geminiService.ts](src/services/geminiService.ts) to optionally support a managed endpoint for users who prefer a subscription over managing their own API keys.

## 6. Rebranding & Identity 🏷️
- [x] **New Brand Identity**: Successfully transitioned from NexusAI to **aethermsaid hub**.
- [x] **Author Information**: Updated all metadata (package.json, LICENSE, etc.) to **msaid mohamed el hadi**.
- [x] **Website & Domain**: Updated all URLs to use `https://aethermsaid.com`.
- [x] **Protocol Registry**: Updated custom protocol to `aethermsaid://`.
