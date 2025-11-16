# Mobile App Setup Guide

This guide will help you set up and run the School SaaS mobile app.

## Prerequisites

- Node.js and npm/pnpm installed
- Expo CLI installed globally: `npm install -g expo-cli`
- Expo Go app on your phone (iOS/Android) OR iOS Simulator / Android Emulator

## Step 1: Install Dependencies

```bash
cd /home/ubuntu/school/apps/mobile
pnpm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in `apps/mobile/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_URL=http://172.31.10.67:4000
```

**Important:**
- Get Supabase credentials from: Supabase Dashboard > Settings > API
- Update `EXPO_PUBLIC_API_URL` with your backend server IP/domain
- For local development, use your computer's IP address (not localhost)
- For production, use your domain or public IP

## Step 3: Run the App

### Development Mode

```bash
cd /home/ubuntu/school/apps/mobile
pnpm dev
```

This will:
1. Start the Expo development server
2. Show a QR code in the terminal
3. Open Expo DevTools in your browser

### Running on Device

1. **iOS**: Open Camera app and scan the QR code, or use Expo Go app
2. **Android**: Open Expo Go app and scan the QR code
3. **Simulator/Emulator**: Press `i` for iOS simulator or `a` for Android emulator

## Step 4: Build for Production

### Using EAS Build (Recommended)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure: `eas build:configure`
4. Build: `eas build --platform ios` or `eas build --platform android`

### Local Build

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## App Features

### Authentication
- **Login**: Sign in with email and password
- **Signup as Principal**: Create a new school
- **Signup to Join**: Join existing school with join code

### Role-Based Dashboards

#### Principal
- View school statistics
- Manage students
- Manage classes
- View pending approvals

#### Teacher
- Mark attendance
- Enter marks
- View assigned classes

#### Student
- View attendance
- View marks
- View fees and payments

#### Clerk
- Manage fees
- View payments
- Handle fee collection

#### Parent
- View child's progress
- View payments
- Track attendance

## Project Structure

```
apps/mobile/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── services/        # API and auth services
│   ├── navigation/      # Navigation setup
│   ├── types/           # TypeScript types
│   └── utils/           # Utility functions
├── App.tsx             # Main app component
├── app.json            # Expo configuration
└── package.json        # Dependencies
```

## Troubleshooting

### "Network request failed"
- Check that `EXPO_PUBLIC_API_URL` is correct
- Ensure backend is running and accessible
- For physical device, use your computer's IP (not localhost)
- Check firewall settings

### "Cannot connect to Expo"
- Make sure your phone and computer are on the same network
- Try restarting Expo: `expo start -c`
- Check if port 19000-19001 are open

### "Module not found"
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`

### Build Errors
- Check TypeScript errors: `pnpm typecheck`
- Ensure all environment variables are set
- Check Expo SDK version compatibility

## Development Tips

1. **Hot Reload**: Changes automatically reload in the app
2. **Debugging**: Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android) for dev menu
3. **Logs**: View logs in terminal or use `console.log()`
4. **Type Checking**: Run `pnpm typecheck` before committing

## API Integration

The app uses the backend API at the URL specified in `EXPO_PUBLIC_API_URL`. All API calls are handled through:

- `src/services/api.ts` - API service layer
- `src/services/auth.ts` - Authentication service

## Next Steps

1. ✅ Set up environment variables
2. ✅ Install dependencies
3. ✅ Start development server
4. ⚙️ Test authentication flow
5. ⚙️ Test role-based features
6. ⚙️ Build for production

---

**Mobile app is ready to use! 📱**

