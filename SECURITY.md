# Security Policy

## Reporting a Vulnerability

We take the security of aethermsaid hub seriously. If you discover a security vulnerability, please do NOT open a public issue. Instead, please report it privately to msaid mohamed el hadi.

### How to report

Please send an email to **mohamedgb00714@gmail.com**.

We will acknowledge your report within 48 hours and provide a timeline for a fix. We ask that you follow responsible disclosure practices and give us time to address the issue before making it public.

## Security Features

-   **Privacy First**: All data is stored locally in an encrypted SQLite database.
-   **Local AI**: Support for local models (Ollama, Local AI) to keep data off third-party servers.
-   **Secure Storage**: We use the Electron `safeStorage` API to protect encryption keys and sensitive credentials using your OS's native keychain.
-   **No Analytics**: aethermsaid hub does not include any tracking or telemetry.

## Platform Policy Compliance

Certain integrations in aethermsaid hub (specifically WhatsApp, Discord, and Telegram) rely on unofficial automation methods or self-bot configurations. 

These features are:
1.  **Disabled by default** via environment variables (`ENABLE_WHATSAPP`, `ENABLE_DISCORD`).
2.  **Experimental** and intended solely for personal research.
3.  Documented with clear warnings regarding potential account restrictions.

Users are solely responsible for compliance with the Terms of Service of any third-party platform they connect to.
