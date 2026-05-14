# Making AyuSetu Available on Network

Your application is now configured to be accessible on your local network. Here's how to use it:

---

## **Method 1: Local Network Access (Recommended for Private Networks)**

### Backend Setup:

1. Start backend:

   ```bash
   cd backend
   npm run dev
   ```

   When the server starts, you'll see output like:

   ```
   [Server] Running on port 5000
   [Server] Local access: http://localhost:5000
   [Server] Network access: http://192.168.1.100:5000  <-- Use this on other devices
   [Server] Socket.IO signaling active
   ```

2. **Copy the Network access URL** (e.g., `http://192.168.1.100:5000`)

### Frontend Setup:

1. Create a `.env.local` file in the `frontend/` directory:

   ```bash
   cd frontend
   echo "VITE_API_URL=http://192.168.1.100:5000/api" > .env.local
   ```

   Replace `192.168.1.100` with your machine's actual IP from the backend output.

2. Start frontend:

   ```bash
   npm run dev
   ```

   The frontend will be accessible at: `http://192.168.1.100:5173` (or the IP shown in terminal)

3. **Access from other devices on the same network:**
   - On another device (phone, tablet, laptop), open your browser
   - Navigate to: `http://192.168.1.100:5173`
   - The frontend will connect to the backend at `192.168.1.100:5000`

---

## **Method 2: Public Internet Access (Using ngrok)**

For sharing outside your local network:

### 1. Install ngrok:

- Download from [https://ngrok.com/download](https://ngrok.com/download)
- Extract and add to PATH

### 2. Run ngrok tunnels:

```bash
# In one terminal - Backend tunnel
ngrok http 5000

# In another terminal - Frontend tunnel
ngrok http 5173
```

You'll see URLs like:

```
Backend:  https://a1b2c3d4-1234.ngrok.io
Frontend: https://e5f6g7h8-5678.ngrok.io
```

### 3. Update frontend `.env.local`:

```bash
VITE_API_URL=https://a1b2c3d4-1234.ngrok.io/api
```

### 4. Access from anywhere:

- Navigate to the frontend ngrok URL from any device
- Share the link publicly

---

## **Method 3: Docker + Deployment**

For production/long-term access, deploy to:

- **Vercel** (already configured - `vercel.json` exists)
- **Railway.app**
- **Render.com**
- **AWS/GCP/Azure**

---

## **Quick Firewall Check**

If you can't access from other devices:

### Windows:

```bash
# Allow backend port through firewall
netsh advfirewall firewall add rule name="Allow AyuSetu Backend" dir=in action=allow protocol=tcp localport=5000

# Allow frontend port through firewall
netsh advfirewall firewall add rule name="Allow AyuSetu Frontend" dir=in action=allow protocol=tcp localport=5173
```

### Mac:

- System Preferences → Security & Privacy → Firewall Options
- Add Node.js and Vite to allowed apps

### Linux:

```bash
sudo ufw allow 5000
sudo ufw allow 5173
```

---

## **Troubleshooting**

| Issue                 | Solution                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| Can't find network IP | Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux), look for IPv4        |
| CORS errors           | CORS is open by default (`origin: '*'`), should work                     |
| Connection refused    | Check firewall, ensure ports 5000 & 5173 are open                        |
| ngrok stops working   | ngrok free accounts need to restart tunnels periodically                 |
| Slow connection       | Close other network apps, move closer to router, or use wired connection |

---

## **Testing**

Once running, verify access:

```bash
# From another device on the network
curl http://192.168.1.100:5000/health
# Should return: {"success":true,"message":"AyuSetu backend is healthy","timestamp":"..."}
```

---

**Note:** For security, if exposing to the internet:

- Add authentication
- Use HTTPS only (ngrok provides this)
- Set proper CORS_ORIGIN env variable
- Use environment-based secrets
