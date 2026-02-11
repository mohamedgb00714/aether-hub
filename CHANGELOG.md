# Changelog

All notable changes to aether hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/mohamedgb00714/aether-hub/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mohamedgb00714/aether-hub/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mohamedgb00714/aether-hub/releases/tag/v1.0.0
