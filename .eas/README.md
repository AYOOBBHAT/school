# EAS Workflows Configuration

This directory contains EAS Workflows for automated CI/CD builds of the mobile app.

## Workflows

### Production Builds
- **File**: `create-production-builds.yml`
- **Purpose**: Creates production builds for Android (App Bundle) and iOS (App Store)
- **Run**: `npx eas-cli@latest workflow:run create-production-builds.yml`

### Preview Builds
- **File**: `create-preview-builds.yml`
- **Purpose**: Creates preview builds for Android (APK) and iOS (Simulator)
- **Run**: `npx eas-cli@latest workflow:run create-preview-builds.yml`

## Monorepo Setup

Since this is a Turborepo monorepo, the workflows are configured at the root level. When running workflows, you may need to:

1. **Run from root**: The workflow files are at `.eas/workflows/` at the project root
2. **Mobile app location**: The mobile app is located at `apps/mobile/`
3. **EAS configuration**: The `eas.json` file is in `apps/mobile/eas.json`

## Running Workflows

### First Time Setup

Before running workflows, you need to create at least one build manually to gather credentials:

```bash
cd apps/mobile
npx eas-cli@latest build --platform all
```

### Running Workflows

From the project root:

```bash
# Production builds
npx eas-cli@latest workflow:run create-production-builds.yml

# Preview builds
npx eas-cli@latest workflow:run create-preview-builds.yml
```

**Note**: If EAS doesn't automatically detect the mobile app location, you may need to run the workflow command from the `apps/mobile` directory or specify the project path.

## GitHub Integration

To set up automated builds on GitHub:

1. Link your GitHub repository in the EAS dashboard
2. Workflows will automatically trigger on pushes (if configured)
3. Build status will be reported back to GitHub

## Build Profiles

The workflows use the following profiles from `apps/mobile/eas.json`:

- **production**: For App Store/Play Store releases
- **preview**: For internal testing (APK/Simulator builds)
