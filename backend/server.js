require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const app = require('./app');
const { buildSocketCorsOptions } = require('./config/cors');
const { setupSignaling } = require('./services/signalingService');
const { startReminderScheduler } = require('./services/reminderScheduler');

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    // Create HTTP server wrapping Express
    const httpServer = http.createServer(app);

    // Attach Socket.IO
    const io = new Server(httpServer, {
      cors: buildSocketCorsOptions(),
      transports: ['websocket', 'polling'],
    });

    // Set up WebRTC signaling
    setupSignaling(io);

    // Start reminder scheduler
    startReminderScheduler();

    httpServer.listen(PORT, '0.0.0.0', () => {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const ipAddress = Object.values(networkInterfaces).flat().find(addr => addr.family === 'IPv4' && !addr.internal)?.address || 'localhost';

      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] Local access: http://localhost:${PORT}`);
      console.log(`[Server] Network access: http://${ipAddress}:${PORT}`);
      console.log(`[Server] Socket.IO signaling active`);
    });

    const shutdown = (signal) => {
      console.log(`[Server] ${signal} received. Shutting down...`);
      httpServer.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Startup failed:', error);
    process.exit(1);
  }
};

startServer();
