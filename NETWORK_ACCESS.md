# Network Access Setup

This guide shows you how to access your local development server from mobile devices on the same network.

## Quick Setup

### 1. Find Your Local IP Address

Run this command in your terminal:
```bash
hostname -I | awk '{print $1}'
```

Or on Windows:
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

### 2. Start the Servers

The servers are now configured to listen on all network interfaces (`0.0.0.0`).

**Backend:**
```bash
cd apps/backend
npm run dev
```

**Frontend:**
```bash
cd apps/web
npm run dev
```

### 3. Access from Mobile Device

1. **Make sure your mobile device is on the same Wi-Fi network** as your computer.

2. **Find your computer's local IP address** (from step 1). Example: `192.168.1.100`

3. **Access the frontend** from your mobile browser:
   ```
   http://YOUR_LOCAL_IP:5173
   ```
   Example: `http://192.168.1.100:5173`

4. **The backend API** will be accessible at:
   ```
   http://YOUR_LOCAL_IP:4000
   ```

### 4. Update Frontend Environment Variable (if needed)

If you need to hardcode the API URL for mobile testing, create or update `.env` in `apps/web/`:

```env
VITE_API_URL=http://YOUR_LOCAL_IP:4000
```

Replace `YOUR_LOCAL_IP` with your actual local IP address.

## Troubleshooting

### Can't access from mobile?

1. **Check firewall**: Make sure your firewall allows connections on ports 4000 and 5173
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 4000/tcp
   sudo ufw allow 5173/tcp
   ```

2. **Check network**: Ensure both devices are on the same Wi-Fi network

3. **Check IP address**: Verify your IP hasn't changed:
   ```bash
   hostname -I | awk '{print $1}'
   ```

4. **Check if servers are running**: Look for the startup messages showing the network address

### Backend shows "localhost" in logs?

The backend now listens on `0.0.0.0` which means it accepts connections from any network interface. The log message still shows `localhost` for clarity, but it's accessible via your local IP.

### Mobile can't connect to API?

Make sure:
- Backend is running and accessible
- `VITE_API_URL` in frontend `.env` points to your local IP (not localhost)
- Both devices are on the same network
- Firewall allows the connections

## Security Note

⚠️ **Warning**: Exposing your development server to the network makes it accessible to anyone on your local network. This is fine for development, but:
- Don't use this in production
- Be aware of who else is on your network
- Use a VPN or SSH tunnel for remote access

