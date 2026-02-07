# GitHub Actions Workflows

This directory contains GitHub Actions workflows for building, testing, and releasing the aethermsaid hub Electron application.

## Workflows

### 1. Build and Release (`build-release.yml`)

**Purpose**: Automatically build and release the Electron application for all platforms when a version tag is pushed.

**Triggers**:
- **Automatic**: When a version tag is pushed (e.g., `v0.2.3`, `v1.0.0`)
- **Manual**: Can be triggered manually from the GitHub Actions tab

**Platforms**:
- **Windows**: NSIS installer (x64)
- **macOS**: DMG packages (x64 and arm64/Apple Silicon)
- **Linux**: AppImage and .deb packages

**Usage**:

To create a new release:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Push the tag
git push origin --tags

# 3. GitHub Actions will automatically:
#    - Build the app for all platforms
#    - Create installers/packages
#    - Create a GitHub Release
#    - Upload all artifacts to the release
```

**Manual Trigger**:

1. Go to the "Actions" tab in GitHub
2. Select "Build and Release Electron App"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

### 2. Test Build (`test-build.yml`)

**Purpose**: Test that the application builds successfully on all platforms without creating a release.

**Triggers**:
- Pull requests to `main`, `master`, or `develop` branches
- Pushes to `main`, `master`, or `develop` branches

**Platforms**:
- Windows (windows-latest)
- macOS (macos-latest)
- Linux (ubuntu-latest)

**What it does**:
- Installs dependencies
- Builds the Electron application
- Packages the application (but doesn't publish)
- Ensures the build works on all platforms

## Release Process

### Creating a New Release

1. **Update Version**:
   ```bash
   npm version patch  # 0.2.3 -> 0.2.4
   # or
   npm version minor  # 0.2.3 -> 0.3.0
   # or
   npm version major  # 0.2.3 -> 1.0.0
   ```

2. **Push Tag**:
   ```bash
   git push origin --tags
   ```

3. **Monitor Build**:
   - Go to the "Actions" tab in GitHub
   - Watch the build progress for all platforms
   - Builds typically take 10-20 minutes

4. **Download Release**:
   - Once complete, go to the "Releases" page
   - Find your new release
   - Download the installer for your platform

### Release Artifacts

The release will include:

- **Windows**: `aethermsaid hub-{version}-x64-setup.exe`
- **macOS**: 
  - `aethermsaid hub-{version}-x64.dmg` (Intel Macs)
  - `aethermsaid hub-{version}-arm64.dmg` (Apple Silicon)
- **Linux**:
  - `aethermsaid hub-{version}-x64.AppImage`
  - `aethermsaid hub-{version}-amd64.deb`

## Troubleshooting

### Build Fails on Specific Platform

If a build fails on one platform:

1. Check the Actions logs for that specific platform
2. Common issues:
   - **Windows**: Code signing (optional, can be disabled)
   - **macOS**: Notarization (optional for open-source)
   - **Linux**: Missing system dependencies (already included in workflow)

### Manual Build Locally

To test builds locally before pushing:

```bash
# Build for your current platform
npm run build:electron
npm run package

# Build for specific platforms
npm run package:win
npm run package:mac
npm run package:linux
```

### Secrets Configuration

The workflows use `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional secrets configuration is needed for basic releases.

For advanced features (code signing, notarization), you would need to add secrets:

- **macOS Code Signing**: `APPLE_ID`, `APPLE_PASSWORD`, `CSC_LINK`, `CSC_KEY_PASSWORD`
- **Windows Code Signing**: `CSC_LINK`, `CSC_KEY_PASSWORD`

## Workflow Configuration

### Node.js Version

The workflows use Node.js 20. To change this, modify the `node-version` in both workflow files:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # Change this
```

### Build Timeout

Default timeout is 6 hours. To change it, add to the job:

```yaml
jobs:
  build:
    timeout-minutes: 60  # Set custom timeout
```

### Artifact Retention

Artifacts are kept for 7 days. To change this:

```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    retention-days: 30  # Change this
```

## CI/CD Best Practices

1. **Test Before Release**: Always merge PRs to main first, let test-build run, then create a release tag
2. **Version Bumps**: Use `npm version` to ensure package.json and git tags stay in sync
3. **Changelog**: Update CHANGELOG.md before creating releases
4. **Pre-releases**: For beta versions, use tags like `v1.0.0-beta.1`

## Resources

- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
