git # Cloudflare Pages Deployment Guide

This guide will walk you through deploying your frontend to Cloudflare Pages.

## Prerequisites

1. A Cloudflare account (free tier works)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Environment variables ready (Supabase URL and keys)

## Step-by-Step Deployment

### Option 1: Deploy via Cloudflare Dashboard (Recommended)

#### Step 1: Prepare Your Repository
1. Ensure your code is pushed to GitHub, GitLab, or Bitbucket
2. Make sure your build works locally:
   ```bash
   # From the root directory
   pnpm install
   pnpm --filter web build
   # Or alternatively: pnpm turbo run build --filter=web
   ```

#### Step 2: Connect to Cloudflare Pages
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** in the sidebar
3. Click **Create a project**
4. Click **Connect to Git**
5. Authorize Cloudflare to access your repository
6. Select your repository

#### Step 3: Configure Build Settings
Use these settings:

- **Project name**: `school-saas-frontend` (or your preferred name)
- **Production branch**: `main` (or `master`)
- **Framework preset**: `Vite`
- **Build command**: `pnpm install && pnpm --filter web build`
- **Build output directory**: `apps/web/dist`
- **Root directory**: `/` (leave empty or set to root)
- **Build for non-production branches**: ✅ **YES, TICK THIS** (enables preview deployments for PRs)
- **Deploy command**: `echo "Deploying..."` or leave empty if allowed (Cloudflare Pages auto-deploys the build output)

**Alternative build command** (using Turbo directly):
- `pnpm install && pnpm turbo run build --filter=web`

**Important Notes:**
- The build command **must** start with `pnpm install` to link workspace packages
- Always tick "Build for non-production branches" to get preview deployments for pull requests
- **DO NOT** add a deploy command - Cloudflare Pages automatically deploys whatever is in the build output directory
- If you see "npx wrangler deploy" in the deploy command field, **DELETE IT** - that's for Cloudflare Workers, not Pages

#### Step 4: Set Environment Variables
In the build settings, add these environment variables:

**Required Environment Variables:**
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_API_URL`: Your Railway backend URL (e.g., `https://your-app.railway.app`)

**Example:**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://your-backend.railway.app
```

**To add environment variables:**
1. Go to your project settings in Cloudflare Pages
2. Click **Environment variables** tab
3. Click **Add variable**
4. Add each variable for **Production**, **Preview**, and **Branch preview** environments
5. **Important**: Add `VITE_API_URL` with your Railway backend URL (not `http://localhost:4000`)

**Why you need VITE_API_URL:**
- Your frontend makes API calls to your backend (Railway)
- The code uses `import.meta.env.VITE_API_URL` to get the backend URL
- Without this, API calls will fail in production

#### Step 5: Deploy
1. Click **Save and Deploy**
2. Cloudflare will build and deploy your site
3. You'll get a URL like: `https://your-project-name.pages.dev`

#### Step 6: Custom Domain (Optional)
1. Go to **Custom domains** in your project settings
2. Click **Set up a custom domain**
3. Follow the instructions to add your domain
4. Update your DNS records as instructed

### Option 2: Deploy via Wrangler CLI

#### Step 1: Install Wrangler
```bash
npm install -g wrangler
# or
pnpm add -g wrangler
```

#### Step 2: Login to Cloudflare
```bash
wrangler login
```

#### Step 3: Deploy
```bash
# From the root directory
pnpm install
pnpm --filter web build
# Or: pnpm turbo run build --filter=web
cd apps/web
wrangler pages deploy dist --project-name=school-saas-frontend
```

## Important Notes

### SPA Routing
Your React app uses client-side routing. The `_redirects` file in `apps/web/public/` ensures all routes redirect to `index.html` for proper SPA behavior.

### Environment Variables
Make sure to set all required environment variables in Cloudflare Pages:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_API_URL` - Your Railway backend URL (e.g., `https://your-app.railway.app`)

**Important**: All environment variables must start with `VITE_` prefix to be accessible in your frontend code.

### Build Configuration
The build process:
1. Installs dependencies (including workspace packages)
2. Type checks TypeScript files
3. Builds the Vite project
4. Outputs to `apps/web/dist`

### Turbo Repo Considerations
Since this is a **Turbo monorepo** with pnpm workspaces, the build command leverages Turbo's build system:

1. **Install dependencies at the root** (`pnpm install`) - This links all workspace packages (@school/utils, @school/ui, @school/types, etc.)
2. **Build using Turbo** (`pnpm --filter web build` or `pnpm turbo run build --filter=web`) - Turbo automatically:
   - Builds dependencies in the correct order
   - Only builds what's needed (the `web` app and its dependencies)
   - Handles the dependency graph efficiently

**Why use Turbo?**
- Turbo understands your monorepo structure and builds dependencies automatically
- It's faster and more efficient than manually building each package
- The `--filter=web` flag ensures only the web app and its dependencies are built

**Important**: The workspace packages (@school/utils, @school/ui, @school/types) are local packages, not published to npm. They must be installed from the root to be properly linked.

## Troubleshooting

### Build Fails

#### "Package not found" or "404" errors for @school/* packages
- **Solution**: Make sure the build command starts with `pnpm install` at the root
- The build command should be: `pnpm install && pnpm --filter web build`
- This ensures workspace packages are linked before building
- Make sure `pnpm-workspace.yaml` exists in the root directory

#### "Missing entry-point to Worker script" error during deploy
- **Solution**: If Cloudflare requires a deploy command, use a no-op command: `echo "Deploying..."`
- Cloudflare Pages automatically deploys the build output - the deploy command is just a placeholder
- Go to Settings → Builds & deployments → Deploy command → Set to `echo "Deploying..."` (or leave empty if allowed)
- This error happens when Cloudflare tries to run `npx wrangler deploy` (which is for Workers, not Pages)
- **Note**: If the field shows "required", use `echo "Deploying..."` as a no-op command that does nothing

#### Other build failures
- Check that all workspace dependencies are properly linked
- Verify environment variables are set correctly
- Check build logs in Cloudflare dashboard for specific errors
- Ensure you're using the correct Node.js version (Cloudflare Pages uses Node.js 18+ by default)

### Routes Not Working
- Ensure `_redirects` file is in the `public` folder (it will be copied to `dist`)
- Verify the file contains the SPA redirect rule

### Seeing "Hello World" or Blank Page After Deployment
This usually means Cloudflare Pages isn't finding your build output. Check:

1. **Verify Build Output Directory Path:**
   - Should be: `apps/web/dist` (relative to root)
   - Make sure there's no leading slash: ✅ `apps/web/dist` ❌ `/apps/web/dist`
   - The path is relative to your repository root

2. **Check Build Logs:**
   - Go to your deployment → View build logs
   - Look for "Success: Build command completed"
   - Verify it says the build output was created

3. **Verify Files Were Built:**
   - Check that `apps/web/dist/index.html` exists after build
   - Check that `apps/web/dist/_redirects` exists
   - Check that `apps/web/dist/assets/` folder has JS and CSS files

4. **Common Issues:**
   - **Wrong path**: If using root directory `/`, the output path should be `apps/web/dist`
   - **Root directory mismatch**: If root directory is set to `apps/web`, then output should be `dist`
   - **Build failed silently**: Check build logs for errors

5. **Quick Fix - Try This:**
   - **Root directory**: `/` (or leave empty)
   - **Build output directory**: `apps/web/dist`
   - Make sure both are set correctly and save
   - Trigger a new deployment

### Environment Variables Not Working
- Make sure variables start with `VITE_` prefix
- Rebuild after adding new environment variables
- Check that variables are set for the correct environment (Production/Preview)

## Post-Deployment

1. **Test all routes** - Navigate through your app to ensure routing works
2. **Check API calls** - Verify Supabase connections work correctly
3. **Monitor performance** - Use Cloudflare Analytics to track performance
4. **Set up custom domain** - Add your domain for production use

## Continuous Deployment

Once connected to Git, Cloudflare Pages will automatically:
- Deploy on every push to your production branch
- Create preview deployments for pull requests
- Show build status in your Git provider

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

