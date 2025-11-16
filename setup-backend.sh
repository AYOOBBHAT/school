#!/bin/bash

# Backend Setup Script for AWS Server
# This script automates the setup process

set -e  # Exit on error

echo "🚀 Starting backend setup for AWS server..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root (/home/ubuntu/school)${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}📦 Step 1: Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    pnpm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Step 2: Check environment variables
echo -e "${YELLOW}🔐 Step 2: Checking environment variables...${NC}"
cd apps/backend

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found in apps/backend/${NC}"
    echo -e "${YELLOW}Please create apps/backend/.env with the following variables:${NC}"
    echo "  SUPABASE_URL=..."
    echo "  SUPABASE_ANON_KEY=..."
    echo "  SUPABASE_SERVICE_ROLE_KEY=..."
    echo "  PORT=4000"
    echo "  HOST=0.0.0.0"
    exit 1
fi

# Check if required env vars are set (basic check)
if ! grep -q "SUPABASE_URL=" .env || ! grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env; then
    echo -e "${RED}❌ Warning: .env file exists but may be missing required variables${NC}"
    echo -e "${YELLOW}Please ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Environment variables file found${NC}"
fi

# Step 3: Build the backend
echo -e "${YELLOW}🔨 Step 3: Building backend...${NC}"
pnpm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend built successfully${NC}"
else
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

# Step 4: Check if PM2 is installed
echo -e "${YELLOW}⚙️  Step 4: Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing PM2 globally...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${GREEN}✓ PM2 already installed${NC}"
fi

# Step 5: Stop existing PM2 process if running
echo -e "${YELLOW}🛑 Step 5: Checking for existing backend process...${NC}"
if pm2 list | grep -q "school-backend"; then
    echo -e "${YELLOW}Stopping existing backend process...${NC}"
    pm2 delete school-backend || true
    echo -e "${GREEN}✓ Existing process stopped${NC}"
fi

# Step 6: Start backend with PM2
echo -e "${YELLOW}🚀 Step 6: Starting backend with PM2...${NC}"
cd /home/ubuntu/school/apps/backend
pm2 start pnpm --name "school-backend" -- start
pm2 save
echo -e "${GREEN}✓ Backend started with PM2${NC}"

# Step 7: Show status
echo -e "${YELLOW}📊 Step 7: Backend status:${NC}"
pm2 status
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Backend is now running and accessible at:"
echo "  - Local: http://localhost:4000"
echo "  - Private IP: http://${SERVER_IP}:4000"
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs school-backend"
echo "  - Restart: pm2 restart school-backend"
echo "  - Stop: pm2 stop school-backend"
echo "  - Status: pm2 status"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  1. Configure AWS Security Group to allow inbound traffic on port 4000"
echo "  2. Test the health endpoint: curl http://localhost:4000/health"
echo "  3. Set up PM2 to start on boot: pm2 startup (then run the command it outputs)"

