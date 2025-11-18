# Cloudflare Pages Deployment Guide

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

**Alternative build command** (using Turbo directly):
- `pnpm install && pnpm turbo run build --filter=web`

#### Step 4: Set Environment Variables
In the build settings, add these environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

To add environment variables:
1. Go to your project settings
2. Click **Environment variables**
3. Add each variable for **Production**, **Preview**, and **Branch preview** as needed

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
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

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

#### Other build failures
- Check that all workspace dependencies are properly linked
- Verify environment variables are set correctly
- Check build logs in Cloudflare dashboard for specific errors
- Ensure you're using the correct Node.js version (Cloudflare Pages uses Node.js 18+ by default)

### Routes Not Working
- Ensure `_redirects` file is in the `public` folder (it will be copied to `dist`)
- Verify the file contains the SPA redirect rule

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

