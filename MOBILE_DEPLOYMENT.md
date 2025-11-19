# Mobile App Deployment Guide

This guide will walk you through deploying your Expo React Native mobile app to iOS App Store and Google Play Store.

## Prerequisites

1. **Expo Account** (free tier works)
   - Sign up at [expo.dev](https://expo.dev)
   - Install Expo CLI: `npm install -g eas-cli`

2. **Apple Developer Account** (for iOS - $99/year)
   - Required for App Store distribution
   - Sign up at [developer.apple.com](https://developer.apple.com)

3. **Google Play Developer Account** (for Android - $25 one-time)
   - Required for Play Store distribution
   - Sign up at [play.google.com/console](https://play.google.com/console)

## Step-by-Step Deployment

### Step 1: Install EAS CLI

**Option A: Install globally (requires sudo)**
```bash
sudo npm install -g eas-cli
```

**Option B: Use npx (no installation needed - recommended)**
```bash
# Just use npx eas-cli instead of eas
npx eas-cli login
npx eas-cli build:configure
# etc.
```

**Option C: Configure npm to use user directory (best for Linux)**
```bash
# Create directory for global packages
mkdir ~/.npm-global

# Configure npm to use it
npm config set prefix '~/.npm-global'

# Add to PATH (add this to ~/.bashrc or ~/.zshrc)
export PATH=~/.npm-global/bin:$PATH

# Then install
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
# If using npx (recommended)
npx eas-cli login

# If installed globally
eas login
```

### Step 3: Configure Your App

Navigate to your mobile app directory:

```bash
cd apps/mobile
```

### Step 4: Initialize EAS

```bash
eas build:configure
```

This will create an `eas.json` file. You can customize it later.

### Step 5: Update app.json

Make sure your `app.json` has all required fields:

```json
{
  "expo": {
    "name": "School SaaS",
    "slug": "school-saas",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.schoolsaas"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.schoolsaas"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

### Step 6: Set Environment Variables

Create a `.env` file in `apps/mobile/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_API_URL=https://your-backend.railway.app
```

**Important**: For production, use your Railway backend URL, not localhost!

### Step 7: Create EAS Build Configuration

Create or update `eas.json` in `apps/mobile/`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "bundleIdentifier": "com.yourcompany.schoolsaas"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 8: Build for Android (APK for Testing)

```bash
eas build --platform android --profile preview
```

This creates an APK you can install directly on Android devices for testing.

### Step 9: Build for Android (Play Store)

```bash
eas build --platform android --profile production
```

This creates an AAB (Android App Bundle) file for Google Play Store.

### Step 10: Build for iOS (TestFlight)

```bash
eas build --platform ios --profile production
```

This creates an IPA file for TestFlight/App Store.

### Step 11: Submit to Google Play Store

1. **Create App in Play Console**:
   - Go to [play.google.com/console](https://play.google.com/console)
   - Click "Create app"
   - Fill in app details (name, description, etc.)

2. **Upload AAB**:
   - Go to "Production" → "Create new release"
   - Upload the AAB file from EAS build
   - Fill in release notes
   - Submit for review

3. **Complete Store Listing**:
   - Add screenshots (required)
   - Add app description
   - Set content rating
   - Add privacy policy URL

### Step 12: Submit to Apple App Store

1. **Create App in App Store Connect**:
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Click "My Apps" → "+" → "New App"
   - Fill in app information

2. **Upload via EAS**:
   ```bash
   eas submit --platform ios
   ```
   This will upload your build to App Store Connect.

3. **Complete App Store Listing**:
   - Add screenshots (required for all device sizes)
   - Add app description
   - Set age rating
   - Add privacy policy URL
   - Submit for review

## Alternative: Internal Distribution (No App Stores)

If you don't want to publish to app stores, you can distribute internally:

### Android (APK)
```bash
eas build --platform android --profile preview
```
- Download the APK from the build page
- Share with users
- They install directly (may need to enable "Install from unknown sources")

### iOS (TestFlight)
```bash
eas build --platform ios --profile production
eas submit --platform ios
```
- Add testers in App Store Connect
- They install via TestFlight app

## Environment-Specific Builds

### Development Build
```bash
eas build --profile development --platform android
```

### Preview/Testing Build
```bash
eas build --profile preview --platform android
```

### Production Build
```bash
eas build --profile production --platform android
```

## Important Configuration

### Update app.json for Production

Make sure to set:
- **iOS Bundle Identifier**: `com.yourcompany.schoolsaas` (must be unique)
- **Android Package**: `com.yourcompany.schoolsaas` (must be unique)
- **Version**: Increment for each release
- **Build Number**: Auto-incremented by EAS

### Environment Variables in EAS

You can set environment variables in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_anon_key",
        "EXPO_PUBLIC_API_URL": "https://your-backend.railway.app"
      }
    }
  }
}
```

Or use EAS Secrets (recommended):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://your-backend.railway.app
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_anon_key
```

## Build Status

Check build status:
```bash
eas build:list
```

View build logs:
```bash
eas build:view [build-id]
```

## Troubleshooting

### Build Fails
- Check build logs: `eas build:view [build-id]`
- Verify environment variables are set
- Ensure `app.json` is valid
- Check that all dependencies are in `package.json`

### iOS Build Issues
- Ensure you have an Apple Developer account
- Verify bundle identifier is unique
- Check that certificates are valid

### Android Build Issues
- Verify package name is unique
- Check that signing key is configured
- Ensure all required permissions are declared

### Environment Variables Not Working
- Use `EXPO_PUBLIC_` prefix for variables accessible in app
- Set via EAS secrets or in `eas.json`
- Rebuild after changing environment variables

## Quick Start Commands

```bash
# Option 1: Use npx (no installation needed)
npx eas-cli login
cd apps/mobile
npx eas-cli build:configure

# Option 2: Install globally (if you have permissions)
sudo npm install -g eas-cli
# Then use: eas login, eas build:configure, etc.

# Option 3: Install locally in project
cd apps/mobile
npm install eas-cli --save-dev
# Then use: npx eas login, npx eas build:configure, etc.
```

# Build Android APK (testing)
eas build --platform android --profile preview

# Build Android AAB (Play Store)
eas build --platform android --profile production

# Build iOS (App Store)
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

## Cost Considerations

- **EAS Build**: Free tier includes limited builds, paid plans available
- **Apple Developer**: $99/year (required for App Store)
- **Google Play**: $25 one-time (required for Play Store)

## Next Steps After Deployment

1. **Monitor Crashes**: Set up crash reporting (Sentry, etc.)
2. **Analytics**: Add analytics (Expo Analytics, Firebase, etc.)
3. **Updates**: Use OTA updates for quick fixes (Expo Updates)
4. **Version Management**: Increment version for each release

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Guide](https://developer.apple.com/app-store-connect/)
- [Google Play Console Guide](https://support.google.com/googleplay/android-developer)

---

**Ready to deploy! Follow the steps above to get your app on the App Store and Play Store.** 🚀

