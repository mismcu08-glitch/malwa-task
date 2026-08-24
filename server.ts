import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface ClientPresence {
  ws: WebSocket;
  isAlive: boolean;
  user?: {
    email: string;
    fullName: string;
    role: string;
    department: string;
    lastActive: string;
    currentView?: string;
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Middleware: Set Secure HTTP Headers & Defense-in-Depth
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Strict payload limits to prevent Buffer Overflow & Memory Exhaustion attacks
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // In-memory bounded store to prevent memory leaks under heavy load
  const MAX_NOTIFICATIONS = 250;
  let tasksStore: any[] = [];
  let notificationsStore: any[] = [];

  // Lightweight in-memory rate limiting map for API abuse protection
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 300; // 300 requests/min per IP

  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      entry.count += 1;
    }

    rateLimitMap.set(ip, entry);

    if (entry.count > MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return;
    }
    next();
  };

  // Clean rate limit map periodically to avoid memory growth
  setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((entry, ip) => {
      if (now > entry.resetTime) {
        rateLimitMap.delete(ip);
      }
    });
  }, 5 * 60 * 1000);

  // Apply rate limiter to API routes
  app.use('/api', rateLimiter);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      activeMemoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    });
  });

  app.get('/api/tasks', (req, res) => {
    res.json({ tasks: tasksStore });
  });

  app.post('/api/tasks/sync', (req, res) => {
    try {
      const { tasks } = req.body;
      if (Array.isArray(tasks)) {
        // Basic schema and bounds check (cap to max 5000 tasks)
        tasksStore = tasks.slice(0, 5000);
      }
      res.json({ success: true, count: tasksStore.length });
    } catch (err) {
      res.status(400).json({ error: 'Invalid task synchronization payload' });
    }
  });

  app.post('/api/notifications/push', (req, res) => {
    try {
      const { title, message, notifType, targetEmail, taskId } = req.body;
      if (!title || typeof title !== 'string') {
        res.status(400).json({ error: 'Valid title is required' });
        return;
      }

      const cleanTitle = String(title).slice(0, 200).trim();
      const cleanMessage = String(message || '').slice(0, 1000).trim();

      const notif = {
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: cleanTitle,
        message: cleanMessage,
        type: notifType || 'UPDATE',
        targetEmail: targetEmail || 'ALL',
        taskId: taskId ? String(taskId).slice(0, 50) : undefined,
        createdAt: new Date().toLocaleTimeString(),
        read: false,
      };

      notificationsStore.unshift(notif);
      if (notificationsStore.length > MAX_NOTIFICATIONS) {
        notificationsStore = notificationsStore.slice(0, MAX_NOTIFICATIONS);
      }

      // Broadcast to all active websockets
      broadcastToAll({
        type: 'PUSH_NOTIFICATION',
        payload: notif,
      });

      res.json({ success: true, notification: notif });
    } catch (err) {
      res.status(500).json({ error: 'Failed to process notification push' });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket Server for Real-Time Multi-User Synchronization with payload protection
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 512, // 512 KB max payload to prevent socket flooding
  });

  const clients: Set<ClientPresence> = new Set();

  function broadcastPresence() {
    const onlineUsers = Array.from(clients)
      .filter((c) => c.user && c.ws.readyState === WebSocket.OPEN)
      .map((c) => c.user);

    const payload = JSON.stringify({
      type: 'PRESENCE_UPDATE',
      users: onlineUsers,
    });

    clients.forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        try {
          c.ws.send(payload);
        } catch (e) {
          // Socket might have closed
        }
      }
    });
  }

  function broadcastToAll(data: any, senderWs?: WebSocket) {
    const payload = JSON.stringify(data);
    clients.forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN && c.ws !== senderWs) {
        try {
          c.ws.send(payload);
        } catch (e) {
          // Socket might have closed
        }
      }
    });
  }

  // WebSocket Heartbeat / Zombie Connection Cleaner (Runs every 30s)
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        return;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (e) {
        clients.delete(client);
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    const client: ClientPresence = { ws, isAlive: true };
    clients.add(client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (message: string) => {
      client.isAlive = true;
      try {
        const rawString = message.toString();
        // Prevent oversized message parsing
        if (rawString.length > 500000) return;

        const data = JSON.parse(rawString);
        if (!data || typeof data !== 'object') return;

        if (data.type === 'PRESENCE_JOIN') {
          if (data.user && typeof data.user === 'object') {
            client.user = {
              email: String(data.user.email || '').slice(0, 100),
              fullName: String(data.user.fullName || '').slice(0, 100),
              role: String(data.user.role || '').slice(0, 50),
              department: String(data.user.department || '').slice(0, 100),
              lastActive: new Date().toLocaleTimeString(),
              currentView: String(data.user.currentView || 'Task Hub').slice(0, 50),
            };
            broadcastPresence();
          }
        } else if (data.type === 'TASK_MUTATION') {
          // Broadcast delta mutation to all other connected clients
          broadcastToAll(data, ws);
        } else if (data.type === 'PUSH_NOTIFICATION') {
          broadcastToAll(data, ws);
        } else if (data.type === 'PING') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        }
      } catch (err) {
        // Silently drop malformed frames to prevent crash
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      broadcastPresence();
    });

    ws.on('error', () => {
      clients.delete(client);
      broadcastPresence();
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Malwa Task Management FMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
