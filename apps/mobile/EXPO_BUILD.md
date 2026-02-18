# Building the mobile app with Expo (EAS)

Builds run in the cloud. You need an Expo account and to be in `apps/mobile`.

## Building from GitHub (Expo dashboard)

If you see **"Failed to read /apps/mobile/dist/eas.json"** when using "Start a build from GitHub":

1. Set **Base directory** to **`apps/mobile`** (no `/dist`).
   - In the "Start a build from GitHub" dialog, there is a **Base directory** (or similar) field — enter **`apps/mobile`**.
   - Or set it globally: Expo dashboard → your project → **GitHub** settings → configure the linked repo → set **Base directory** to **`apps/mobile`**.
2. Commit and push the latest `eas.json` (it now includes `"image": "latest"` for GitHub builds).
3. Run the build again.

## 1. Install EAS CLI (if needed)

```bash
npm install -g eas-cli
```

Or use it via pnpm without global install (from `apps/mobile`):

```bash
pnpx eas-cli --version
```

## 2. Log in to Expo

```bash
cd apps/mobile
eas login
```

Use your Expo account (create one at https://expo.dev if needed).

## 3. Configure the project (first time only)

```bash
eas build:configure
```

Only needed once. Your `eas.json` is already set up with `preview` and `production` profiles.

## 4. Run a build

From the **repo root** or from **apps/mobile**:

**Android**

- Preview (APK, good for testing / internal):
  ```bash
  cd apps/mobile
  pnpm build:android
  ```
  or: `eas build --platform android --profile preview`

- Production (AAB for Play Store):
  ```bash
  cd apps/mobile
  pnpm build:android:prod
  ```
  or: `eas build --platform android --profile production`

**iOS**

- Preview (simulator):
  ```bash
  pnpm build:ios
  ```
- Production (App Store):
  ```bash
  pnpm build:ios:prod
  ```

**Both platforms**

```bash
pnpm build:all
```

## 5. After the build

- Builds run on Expo’s servers. Progress: https://expo.dev
- When finished, you get a link to download the build (APK/AAB for Android, IPA for iOS).
- Production Android builds (AAB) can be submitted to Google Play with:
  ```bash
  eas submit --platform android --profile production
  ```

## Profiles (from your eas.json)

| Profile     | Use case              | Android      | iOS        |
|------------|------------------------|-------------|------------|
| preview    | Internal/testing       | APK         | Simulator  |
| production | Store submission       | AAB (Play)  | App Store  |

Environment variables (`EXPO_PUBLIC_API_URL`, etc.) are set in `eas.json` for each profile, so no extra `.env` is required for EAS builds.
