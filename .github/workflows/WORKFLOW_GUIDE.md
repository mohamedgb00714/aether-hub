# GitHub Actions CI/CD Workflow

This document provides a visual overview of the CI/CD workflows for building and releasing aethermsaid hub.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Developer Actions                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              Push Commits                   Push Version Tag
              to main/develop               (npm version patch)
                    │                             │
                    ▼                             ▼
         ┌──────────────────────┐    ┌──────────────────────┐
         │   Test Build         │    │  Build & Release     │
         │   Workflow           │    │  Workflow            │
         └──────────────────────┘    └──────────────────────┘
                    │                             │
                    │                             │
         ┌──────────┴──────────┐      ┌──────────┴──────────┐
         │                     │      │                     │
         ▼                     ▼      ▼                     ▼
    ┌─────────┐         ┌─────────┐  ┌─────────┐     ┌─────────┐
    │ Windows │         │  macOS  │  │  Linux  │     │ Create  │
    │  Build  │         │  Build  │  │  Build  │     │ Release │
    └─────────┘         └─────────┘  └─────────┘     └─────────┘
         │                     │           │               │
         │ (Test only)         │           │               │
         └─────────┬───────────┴───────────┘               │
                   │                                       │
                   ▼                                       ▼
            ✓ Build Success               ┌────────────────────────────┐
            (No Release)                  │   GitHub Release Created   │
                                          │                            │
                                          │  • Windows NSIS installer  │
                                          │  • macOS DMG (x64 + arm64) │
                                          │  • Linux AppImage + deb    │
                                          └────────────────────────────┘
```

## Workflow Details

### 1. Test Build Workflow
**Triggered by:** Push to main/master/develop OR Pull Request

```
Developer → Push/PR → GitHub Actions → Build on 3 platforms → ✓ Pass/Fail
```

**Purpose:** Validate that code builds successfully on all platforms
**Output:** Build status (no artifacts published)
**Duration:** ~10-15 minutes

### 2. Build & Release Workflow
**Triggered by:** Push version tag (v*) OR Manual workflow dispatch

```
Developer → npm version → git push --tags → GitHub Actions
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ▼                               ▼                               ▼
            Build Windows                   Build macOS                     Build Linux
            (NSIS x64)                    (DMG x64+arm64)                (AppImage + deb)
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    ▼
                                          Upload to GitHub Release
                                          with auto-generated notes
```

**Purpose:** Build installers and create a public release
**Output:** GitHub Release with 5 installer files
**Duration:** ~15-20 minutes

## Platform-Specific Outputs

| Platform | Installer Type | Architecture | File Name Pattern |
|----------|----------------|--------------|-------------------|
| Windows | NSIS | x64 | `aethermsaid hub-{version}-x64-setup.exe` |
| macOS | DMG | x64 (Intel) | `aethermsaid hub-{version}-x64.dmg` |
| macOS | DMG | arm64 (Apple Silicon) | `aethermsaid hub-{version}-arm64.dmg` |
| Linux | AppImage | x64 | `aethermsaid hub-{version}-x64.AppImage` |
| Linux | Debian Package | amd64 | `aethermsaid hub-{version}-amd64.deb` |

## Release Timeline

```
T+0:00    Developer runs: npm version patch && git push --tags
T+0:01    GitHub Actions triggered (3 parallel builds start)
T+0:02    Dependencies installed on all platforms
T+0:05    Electron app built on all platforms
T+0:10    Windows build completes (NSIS installer created)
T+0:12    Linux build completes (AppImage + deb created)
T+0:15    macOS build completes (2 DMG files created)
T+0:16    Release job downloads all artifacts
T+0:17    GitHub Release created with all 5 installers
T+0:18    Users can download installers from Releases page
```

## Step-by-Step Build Process

### Phase 1: Environment Setup
```
1. Checkout repository
2. Setup Node.js 20 with npm cache
3. Install npm dependencies (npm ci)
4. Install OS-specific dependencies (Linux only)
```

### Phase 2: Build Application
```
5. Run Vite build (React app)
6. Compile TypeScript (Electron main process)
7. Bundle preload script (esbuild)
```

### Phase 3: Package Installers
```
8. electron-builder packages for target OS
   - Windows: Create NSIS installer
   - macOS: Create DMG files (x64 + arm64)
   - Linux: Create AppImage + .deb package
```

### Phase 4: Artifact Management
```
9. Upload artifacts to GitHub Actions
10. Retain for 7 days
```

### Phase 5: Release Creation (Tag-based only)
```
11. Download all artifacts from build jobs
12. Create GitHub Release
13. Attach all installers to release
14. Generate release notes from commits
```

## Manual Workflow Trigger

You can manually trigger builds from the GitHub UI:

```
GitHub → Actions → Build and Release → Run workflow → Select branch → Run
```

This is useful for:
- Testing the build process
- Creating builds from a specific branch
- Debugging build issues

## Monitoring Builds

### View Build Status

1. Go to repository on GitHub
2. Click "Actions" tab
3. See all workflow runs with status badges
4. Click on a run to see detailed logs

### Build Status Badges

- ✅ Success: All platforms built successfully
- ❌ Failure: One or more platforms failed
- ⏳ In Progress: Build currently running

### Detailed Logs

Each job provides detailed logs:
- npm install output
- Build process output
- electron-builder output
- Error messages and stack traces

## Troubleshooting Guide

### Build Fails on Single Platform

If Windows builds but macOS fails:
1. Click on the failed job (macOS)
2. Expand the failed step
3. Look for error messages
4. Common issues: Missing dependencies, TypeScript errors

### All Platforms Fail

If all builds fail:
1. Check for syntax errors in code
2. Verify package.json scripts are correct
3. Test build locally: `npm run build:electron`
4. Check Node.js version compatibility

### Release Not Created

If builds succeed but no release appears:
1. Verify the tag format matches `v*` (e.g., v0.2.4)
2. Check that the tag was pushed: `git push origin --tags`
3. Look at the "release" job logs in GitHub Actions

## Best Practices

1. **Always test locally first**
   ```bash
   npm run build:electron
   npm run package
   ```

2. **Use semantic versioning**
   ```bash
   npm version patch  # 0.2.3 → 0.2.4
   npm version minor  # 0.2.3 → 0.3.0
   npm version major  # 0.2.3 → 1.0.0
   ```

3. **Review changes before releasing**
   - Merge PRs to main
   - Wait for test build to pass
   - Then create version tag

4. **Monitor the build**
   - Don't walk away after pushing tag
   - Watch for failures
   - Be ready to fix issues

5. **Test downloaded installers**
   - Download from release page
   - Install on actual target OS
   - Verify app works correctly

## Security Notes

- `GITHUB_TOKEN` is automatically provided (no setup needed)
- Code signing is optional (not configured by default)
- Installers are not signed (users may see security warnings)
- For production, consider adding code signing certificates

## Additional Resources

- [Workflow Files](.github/workflows/)
- [Release Guide](../RELEASE_GUIDE.md)
- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
