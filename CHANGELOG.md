# Changelog

All notable changes to aether hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-02-15

### Added
- **Automation Results Page** 📊 - New dedicated page for viewing browser automation run history and analysis:
  - Stats overview cards: total runs, success rate, failed count, average duration
  - Filter tabs by status (All/Completed/Failed/Running)
  - Expandable automation cards with full run history per automation
  - Per-run details: status badges, timestamps, duration, error messages
  - AI-powered analysis generation per run result via Gemini
  - Result detail modal with raw output, errors, and AI analysis display
  - Search by automation name or task description
- **Automation Results sidebar link** in AI Agents menu group
- **Automation API types** added to `ElectronAPI` interface (16 typed methods)

### Changed
- **Dashboard completely redesigned** 🎨 - Modern unified single-scroll layout replacing old tab-based view:
  - Removed tab navigation (overview/inbox/calendar/activity) in favor of unified dashboard
  - New hero header with greeting, date, time, search bar, sync button, and account filter
  - 5 clickable stat cards row (Emails, Meetings, Messages, PRs, Automations) linking to respective pages
  - Collapsible AI Daily Briefing dark-mode card with calendar + email summaries
  - Bento grid layout: Today's Agenda (7-col), Important Emails (5-col), GitHub (5-col), Messages (4-col), Automations (3-col)
  - Integrated Automations widget showing running/completed status with links to results page
  - Intelligence Feed section with news sources in dark-mode card
  - Simplified sync status bar replacing the old footer component
  - Retained event detail modal and email reply modal with improved styling
- Dashboard now uses `react-router-dom` navigation (`Link`, `useNavigate`) instead of internal tab state

### Technical Details
- New file: `src/pages/AutomationResults.tsx` - Full automation results page with history, filtering, and AI analysis
- New route: `/automation-results` added to App.tsx routing
- New sidebar link: "Auto Results" with `ChartBarIcon` in AI Agents menu group
- Updated `src/types.ts`: Added `automation` interface to `ElectronAPI` with all 16 IPC method types
- Dashboard reduced from tab-based architecture to single unified view for better UX

---

## [1.1.0] - 2026-02-11

### Added
- **AI Agents System** 🎯 - 11 specialized AI agents organized in 3 categories:
  - **Core Life** (4 agents): Financial Planner 💰, Legal Info ⚖️, Planner 📅, Study 📚
  - **Productivity** (4 agents): Email Assistant ✉️, Notes & Knowledge 📝, Freelancer 💼, Coding & Technical 💻
  - **Lifestyle** (3 agents): Wellness & Routine 🏥, Shopping & Decision 🛒, Travel Planner 🧳
- Agent registry system with categorization and search capabilities
- Individual chat interfaces for each agent with example prompts
- Custom tools for each agent (40+ tools total) using LangChain's DynamicStructuredTool
- Agent-specific persistent storage for personalized recommendations
- Markdown rendering in agent chat responses with external link handling
- Tool usage tracking displayed in agent conversations

### Fixed
- Import statement syntax error in App.tsx (removed space in component name)
- ReactMarkdown className prop error - wrapped in div with prose styling instead
- NotesOverlay initialization error with totalNotes variable

### Changed
- Updated README.md to include AI Agents feature in features table
- Updated .github/copilot-instructions.md with comprehensive AI Agents documentation
- Documentation now includes agent creation guide with code examples

### Technical Details
- All agents extend BaseAgent class for consistent behavior
- Shared chat instance via getSharedChat() for improved performance
- Type-safe tool implementations using zod schemas
- Integration with existing database services (emails, events, notes, etc.)
- Support for all 6 AI providers (Gemini, OpenAI, Anthropic, OpenRouter, Ollama, Local AI)

---

## [1.0.0] - Previous Release

### Features
- Multi-account sync (Gmail, Outlook, Slack, WhatsApp, Telegram, Discord, GitHub)
- AI Intelligence Engine with 6 provider support
- LangChain Agent with 26+ database tools
- Knowledge Base system
- Automations with browser-use
- Watch System with cross-platform monitoring
- Browser extensions (Chrome & Firefox)
- Floating widgets (microphone overlay, sticky notes)
- Email campaigns via Resend integration
- YouTube channel analysis
- Voice control with speech recognition
- And 50+ additional features

---

[Unreleased]: https://github.com/mohamedgb00714/aether-hub/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/mohamedgb00714/aether-hub/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mohamedgb00714/aether-hub/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mohamedgb00714/aether-hub/releases/tag/v1.0.0
