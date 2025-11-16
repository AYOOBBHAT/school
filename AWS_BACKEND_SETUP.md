# Backend Setup Guide for AWS Server

This guide will help you set up and run the backend on your AWS server.

## Prerequisites

- Node.js v20+ (already installed ✓)
- pnpm (already installed ✓)
- Supabase credentials (URL, anon key, service role key)

## Step 1: Install Dependencies

```bash
cd /home/ubuntu/school
pnpm install
```

## Step 2: Configure Environment Variables

The backend requires these environment variables in `apps/backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=4000
HOST=0.0.0.0
```

**Important:**
- Get your Supabase credentials from: Supabase Dashboard > Settings > API
- The service role key should start with `eyJ` (it's a JWT token)
- `HOST=0.0.0.0` allows the server to accept connections from any network interface
- `PORT=4000` is the default, but you can change it if needed

## Step 3: Build the Backend

```bash
cd /home/ubuntu/school/apps/backend
pnpm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Step 4: Test the Backend (Optional)

Test that everything works:

```bash
cd /home/ubuntu/school/apps/backend
pnpm run start
```

You should see:
```
Backend listening on http://localhost:4000
Backend accessible on network at http://172.31.10.67:4000
```

Press `Ctrl+C` to stop it.

## Step 5: Set Up Process Management with PM2

PM2 keeps your backend running in the background and restarts it if it crashes.

### Install PM2 globally:

```bash
sudo npm install -g pm2
```

### Start the backend with PM2:

```bash
cd /home/ubuntu/school/apps/backend
pm2 start pnpm --name "school-backend" -- start
```

Or if you prefer using npm:

```bash
cd /home/ubuntu/school/apps/backend
pm2 start npm --name "school-backend" -- start
```

### Useful PM2 commands:

```bash
# View running processes
pm2 list

# View logs
pm2 logs school-backend

# Stop the backend
pm2 stop school-backend

# Restart the backend
pm2 restart school-backend

# Delete the process
pm2 delete school-backend

# Save PM2 configuration (so it starts on reboot)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Then run the command it outputs (usually something like: sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu)
```

## Step 6: Configure AWS Security Group

Your AWS EC2 security group needs to allow inbound traffic on port 4000 (or whatever port you're using).

1. Go to AWS Console > EC2 > Security Groups
2. Select your instance's security group
3. Add an inbound rule:
   - Type: Custom TCP
   - Port: 4000
   - Source: 0.0.0.0/0 (for public access) or your specific IP
   - Description: Backend API

## Step 7: Access Your Backend

Once running, your backend will be accessible at:

- **Local (on server)**: `http://localhost:4000`
- **Private IP**: `http://172.31.10.67:4000`
- **Public IP**: `http://YOUR_PUBLIC_IP:4000` (get from AWS Console > EC2 > Instances)

### Test the health endpoint:

```bash
curl http://localhost:4000/health
```

Should return: `{"ok":true}`

## Step 8: Set Up Reverse Proxy (Optional but Recommended)

For production, consider using Nginx as a reverse proxy:

1. Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

2. Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/school-backend
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your server's IP

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

3. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/school-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. Update security group to allow port 80 (HTTP) instead of 4000

## Troubleshooting

### Backend won't start
- Check that all environment variables are set: `cat apps/backend/.env`
- Check logs: `pm2 logs school-backend`
- Verify Supabase credentials are correct

### Can't access from outside
- Check AWS Security Group allows inbound traffic on port 4000
- Check if firewall is blocking: `sudo ufw status`
- Verify backend is listening on 0.0.0.0: `netstat -tlnp | grep 4000`

### Port already in use
- Find what's using the port: `sudo lsof -i :4000`
- Kill the process or change PORT in .env

### PM2 process keeps crashing
- Check logs: `pm2 logs school-backend --lines 50`
- Verify environment variables are correct
- Check database connection

## Quick Start Commands Summary

```bash
# Install dependencies
cd /home/ubuntu/school && pnpm install

# Build backend
cd apps/backend && pnpm run build

# Start with PM2
pm2 start pnpm --name "school-backend" -- start --cwd /home/ubuntu/school/apps/backend

# Save PM2 config
pm2 save

# View status
pm2 status

# View logs
pm2 logs school-backend
```

