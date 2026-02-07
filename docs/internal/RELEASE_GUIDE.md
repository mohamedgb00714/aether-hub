# Release and Distribution Guide

This guide explains how to build, package, and release the aethermsaid hub Electron application for Windows, macOS, and Linux.

## Quick Start

### Automated Release via GitHub Actions

The easiest way to create a release is using the automated GitHub Actions workflow:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Push the tag to trigger the release
git push origin --tags

# 3. GitHub Actions will automatically build for all platforms and create a release
```

That's it! The GitHub Actions workflow will:
- Build the app for Windows, macOS, and Linux
- Create installers for each platform
- Upload them to a new GitHub Release

## Manual Local Build

If you want to build locally:

### Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)

### Build Commands

```bash
# Install dependencies
npm install

# Build and package for all platforms
npm run build:electron
npm run package

# Or build for specific platforms
npm run package:win     # Windows NSIS installer
npm run package:mac     # macOS DMG (Intel and Apple Silicon)
npm run package:linux   # Linux AppImage and .deb
```

### Platform-Specific Notes

#### Windows
- **Output**: `release/{version}/aethermsaid hub-{version}-x64-setup.exe`
- **Installer Type**: NSIS (allows custom install directory)
- **Requirements**: Can be built on any OS with electron-builder

#### macOS
- **Output**: 
  - `release/{version}/aethermsaid hub-{version}-x64.dmg` (Intel)
  - `release/{version}/aethermsaid hub-{version}-arm64.dmg` (Apple Silicon)
- **Requirements**: Building on macOS is recommended for best results
- **Code Signing**: Optional for distribution (requires Apple Developer account)

#### Linux
- **Output**: 
  - `release/{version}/aethermsaid hub-{version}-x64.AppImage` (Universal)
  - `release/{version}/aethermsaid hub-{version}-amd64.deb` (Debian/Ubuntu)
- **Requirements**: Can be built on any OS
- **Installation**:
  ```bash
  # AppImage (all distros)
  chmod +x aethermsaid hub-*.AppImage
  ./aethermsaid hub-*.AppImage
  
  # Debian/Ubuntu
  sudo dpkg -i aethermsaid hub-*.deb
  ```

## GitHub Actions Workflows

### 1. Build and Release Workflow

**File**: `.github/workflows/build-release.yml`

**Triggers**:
- Pushing a version tag (e.g., `v0.2.3`, `v1.0.0`)
- Manual trigger from GitHub Actions UI

**What it does**:
1. Checks out the code
2. Sets up Node.js 20
3. Installs dependencies
4. Builds the Electron app
5. Packages for Windows, macOS, and Linux
6. Creates a GitHub Release with all installers

### 2. Test Build Workflow

**File**: `.github/workflows/test-build.yml`

**Triggers**:
- Pull requests to main/master/develop
- Pushes to main/master/develop

**What it does**:
1. Tests that the app builds successfully on all platforms
2. Ensures no build regressions
3. Does NOT create a release

## Release Process Step-by-Step

### 1. Prepare for Release

Before creating a release, ensure:

- [ ] All changes are committed and pushed
- [ ] Tests pass locally
- [ ] Version number follows semantic versioning
- [ ] CHANGELOG is updated (if you maintain one)

### 2. Update Version

Use npm's built-in version command to update package.json and create a git tag:

```bash
# Patch release (0.2.3 -> 0.2.4) - Bug fixes
npm version patch

# Minor release (0.2.3 -> 0.3.0) - New features, backward compatible
npm version minor

# Major release (0.2.3 -> 1.0.0) - Breaking changes
npm version major

# Pre-release (for testing)
npm version prerelease --preid=beta  # 0.2.3 -> 0.2.4-beta.0
```

This command will:
- Update version in `package.json`
- Create a git commit with the message "0.2.4" (or whatever version)
- Create a git tag `v0.2.4`

### 3. Push to GitHub

```bash
# Push commits and tags
git push origin main
git push origin --tags
```

### 4. Monitor Build

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. You should see "Build and Release Electron App" running
4. Click on it to see progress for each platform
5. Wait for all builds to complete (usually 10-20 minutes)

### 5. Verify Release

1. Go to the "Releases" page in your GitHub repository
2. Find your new release (it will be named after your tag, e.g., "v0.2.4")
3. Verify all installers are attached:
   - aethermsaid hub-{version}-x64-setup.exe (Windows)
   - aethermsaid hub-{version}-x64.dmg (macOS Intel)
   - aethermsaid hub-{version}-arm64.dmg (macOS Apple Silicon)
   - aethermsaid hub-{version}-x64.AppImage (Linux)
   - aethermsaid hub-{version}-amd64.deb (Linux Debian/Ubuntu)

### 6. Download and Test

Download the installer for your platform and test:

```bash
# Windows: Run the .exe installer
aethermsaid hub-{version}-x64-setup.exe

# macOS: Open the .dmg and drag to Applications
open aethermsaid hub-{version}-x64.dmg

# Linux: Install and run
# AppImage
chmod +x aethermsaid hub-{version}-x64.AppImage
./aethermsaid hub-{version}-x64.AppImage

# Or .deb
sudo dpkg -i aethermsaid hub-{version}-amd64.deb
aether-hub-personal-hub
```

## Manual Workflow Trigger

You can also manually trigger a build without creating a tag:

1. Go to GitHub → Actions tab
2. Select "Build and Release Electron App"
3. Click "Run workflow"
4. Select your branch
5. Click "Run workflow" button

This is useful for testing the build process without creating an official release.

## Troubleshooting

### Build Fails on GitHub Actions

**Check the logs**:
1. Go to Actions tab
2. Click on the failed workflow
3. Click on the failed job
4. Expand the failed step to see the error

**Common issues**:

- **Dependencies**: Make sure `package.json` lists all required dependencies
- **Build scripts**: Verify `build:electron` and `package:*` scripts work locally
- **Node version**: Workflows use Node 20, ensure compatibility

### Build Works Locally but Fails on CI

- Check Node.js version (local vs CI)
- Look for environment-specific dependencies
- Ensure all dependencies are in `package.json`, not just globally installed

### Windows Build Fails with Code Signing Error

If you see errors about code signing:

**Option 1**: Disable code signing (for open source projects):
```json
// electron-builder.json
{
  "win": {
    "certificateFile": null,
    "certificatePassword": null
  }
}
```

**Option 2**: Add code signing certificate as GitHub secret

### macOS Notarization Fails

Notarization is optional for open source projects. To disable:

```json
// electron-builder.json
{
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false
  }
}
```

### Large Artifact Size

The installers include all dependencies. To reduce size:

1. Review `dependencies` in `package.json`
2. Move dev-only packages to `devDependencies`
3. Use `asar` packing (already enabled)
4. Consider excluding unnecessary files in `electron-builder.json`

## Advanced Configuration

### Code Signing (Optional)

For production releases, you may want to code sign:

#### Windows Code Signing

1. Get a code signing certificate
2. Add GitHub secrets:
   - `CSC_LINK`: Base64-encoded certificate
   - `CSC_KEY_PASSWORD`: Certificate password

#### macOS Code Signing

1. Get an Apple Developer account
2. Add GitHub secrets:
   - `APPLE_ID`: Your Apple ID
   - `APPLE_PASSWORD`: App-specific password
   - `CSC_LINK`: Base64-encoded certificate
   - `CSC_KEY_PASSWORD`: Certificate password

### Auto-Update

The app is already configured for auto-updates via GitHub Releases:

```json
// electron-builder.json
{
  "publish": {
    "provider": "github",
    "owner": "mohamedgb00714",
    "repo": "aether-hubelectron"
  }
}
```

Users will automatically get update notifications when a new release is published.

## Versioning Strategy

We recommend following [Semantic Versioning](https://semver.org/):

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New features, backward compatible
- **PATCH** version (0.0.X): Bug fixes, backward compatible

Example progression:
- v0.2.3 → v0.2.4 (bug fixes)
- v0.2.4 → v0.3.0 (new features)
- v0.3.0 → v1.0.0 (major release, breaking changes)

## Resources

- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
