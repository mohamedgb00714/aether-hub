# Contributing to aethermsaid hub

Thank you for your interest in contributing to aethermsaid hub! We welcome contributions from the community.

## How to Contribute

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally.
3.  **Create a new branch** for your feature or bugfix: `git checkout -b feature/your-feature-name`.
4.  **Install dependencies**: `pnpm install`.
5.  **Set up your environment**: Copy `.env.example` to `.env` and add your API keys.
6.  **Make your changes** and ensure the code follows our standards.
7.  **Commit your changes**: `git commit -m "Add some feature"`.
8.  **Push to your fork**: `git push origin feature/your-feature-name`.
9.  **Submit a Pull Request** to the `main` branch.

## Development Workflow

-   `pnpm run dev`: Start the Vite development server.
-   `pnpm run dev:electron`: Start Electron with Vite.
-   `pnpm run build`: Build the project.
-   `pnpm run package`: Create a distributable package.

## Coding Standards

-   Use TypeScript for all new code.
-   Follow the existing project structure and patterns.
-   Ensure all native operations go through IPC.
-   Never include hardcoded API keys or secrets.

## Privacy & Security

-   aethermsaid hub is privacy-first. Always ensure user data remains local and encrypted.
-   Use `safeStorage` for any sensitive information.

## Questions?

If you have any questions, feel free to open an issue or reach out to msaid mohamed el hadi at mohamedgb00714@gmail.com.
