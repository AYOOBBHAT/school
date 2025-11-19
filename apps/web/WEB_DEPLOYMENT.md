# Web App Deployment Guide

This guide covers deploying the School SaaS web application to production.

## ✅ Build Complete

The production build has been successfully created in `apps/web/dist/`.

## 📦 Build Output

```
apps/web/dist/
├── index.html
├── assets/
│   ├── index-*.css (32 KB)
│   └── index-*.js (678 KB)
└── _redirects (for SPA routing)
```

## 🚀 Deployment Options

### Option 1: Deploy to AWS S3 + CloudFront (Recommended)

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-school-saas-web
   ```

2. **Enable Static Website Hosting**:
   ```bash
   aws s3 website s3://your-school-saas-web \
     --index-document index.html \
     --error-document index.html
   ```

3. **Upload Build Files**:
   ```bash
   cd apps/web
   aws s3 sync dist/ s3://your-school-saas-web --delete
   ```

4. **Set Bucket Policy** (for public access):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-school-saas-web/*"
       }
     ]
   }
   ```

5. **Create CloudFront Distribution** (optional, for CDN):
   - Origin: S3 bucket
   - Default root object: `index.html`
   - Error pages: 404 → `/index.html` (for SPA routing)

### Option 2: Deploy to Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   cd apps/web
   netlify deploy --prod --dir=dist
   ```

3. **Or connect via Git**:
   - Push to GitHub
   - Connect repo to Netlify
   - Build command: `cd apps/web && pnpm build`
   - Publish directory: `apps/web/dist`

### Option 3: Deploy to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   cd apps/web
   vercel --prod
   ```

3. **Or connect via Git**:
   - Push to GitHub
   - Import project in Vercel dashboard
   - Root directory: `apps/web`
   - Build command: `pnpm build`
   - Output directory: `dist`

### Option 4: Deploy to Nginx (On Your AWS Server)

1. **Install Nginx**:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Copy Build Files**:
   ```bash
   sudo cp -r apps/web/dist/* /var/www/html/
   ```

3. **Configure Nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/school-saas
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # or your server IP
       root /var/www/html;
       index index.html;

       # SPA routing - all routes go to index.html
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Cache static assets
       location /assets/ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

4. **Enable Site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/school-saas /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Update Security Group**:
   - Allow inbound traffic on port 80 (HTTP)
   - Optionally set up SSL with Let's Encrypt

## 🔧 Environment Variables

Before deploying, ensure environment variables are set:

### For Build Time (Vite)

Create `.env.production` in `apps/web/`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://172.31.10.67:4000
```

**Important**: 
- These are embedded at build time
- Rebuild after changing environment variables
- Use production backend URL (not localhost)

### For Runtime (if needed)

Some platforms allow runtime environment variables:
- **Netlify**: Site settings → Environment variables
- **Vercel**: Project settings → Environment variables
- **AWS**: Use CloudFront or Lambda@Edge for dynamic config

## 🔄 Rebuilding

After making changes:

```bash
cd apps/web
pnpm build
```

Then redeploy the `dist/` folder.

## 📝 Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Backend API URL updated (production URL)
- [ ] Supabase credentials set
- [ ] Build completed successfully
- [ ] Test build locally: `pnpm preview`
- [ ] Security group configured (if using EC2)
- [ ] Domain name configured (if using custom domain)
- [ ] SSL certificate set up (for HTTPS)

## 🧪 Testing Production Build Locally

```bash
cd apps/web
pnpm preview
```

This serves the production build at `http://localhost:4173`

## 🔒 Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Ensure backend allows requests from your domain
3. **Environment Variables**: Never commit `.env` files
4. **API Keys**: Supabase anon key is safe to expose (has RLS)
5. **Backend URL**: Consider using environment-specific URLs

## 📊 Performance Optimization

The build includes:
- ✅ Minified JavaScript and CSS
- ✅ Code splitting (if configured)
- ✅ Asset optimization

Optional improvements:
- Enable gzip/brotli compression on server
- Use CDN for static assets
- Implement lazy loading for routes
- Add service worker for offline support

## 🐛 Troubleshooting

### "404 on refresh"
- Ensure SPA routing is configured (`_redirects` file or server config)
- All routes should serve `index.html`

### "API requests failing"
- Check CORS settings on backend
- Verify `VITE_API_URL` is correct
- Check browser console for errors

### "Environment variables not working"
- Rebuild after changing `.env` files
- Check variable names start with `VITE_`
- Verify build output includes variables

## 📚 Next Steps

1. ✅ Build completed
2. ⚙️ Deploy to chosen platform
3. ⚙️ Configure domain and SSL
4. ⚙️ Set up monitoring
5. ⚙️ Configure CI/CD for auto-deployment

---

**Web app is ready for deployment! 🚀**

