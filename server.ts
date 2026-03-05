import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key_for_dev";
const PORT = 3000;

// Database Setup
const db = new Database("happiness.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    author_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const result = stmt.run(username, hashedPassword);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });

  // Notices
  app.get("/api/notices", (req, res) => {
    const notices = db.prepare(`
      SELECT notices.*, users.username as author_name 
      FROM notices 
      JOIN users ON notices.author_id = users.id 
      ORDER BY created_at DESC
    `).all();
    res.json(notices);
  });

  app.post("/api/notices", authenticateToken, (req: any, res) => {
    const { title, content } = req.body;
    const stmt = db.prepare("INSERT INTO notices (title, content, author_id) VALUES (?, ?, ?)");
    const result = stmt.run(title, content, req.user.id);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  // Chat History
  app.get("/api/messages", authenticateToken, (req, res) => {
    const messages = db.prepare(`
      SELECT messages.*, users.username 
      FROM messages 
      JOIN users ON messages.user_id = users.id 
      ORDER BY created_at ASC 
      LIMIT 100
    `).all();
    res.json(messages);
  });

  // --- WebSocket Chat ---
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws, req) => {
    // Simple token auth for WS (optional, but good)
    // For simplicity in this demo, we'll just allow connection and expect messages to have user info
    clients.add(ws);

    ws.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        
        if (payload.type === 'chat') {
          const { userId, text, username } = payload;
          
          // Save to DB
          const stmt = db.prepare("INSERT INTO messages (user_id, text) VALUES (?, ?)");
          const result = stmt.run(userId, text);
          
          const broadcastMsg = JSON.stringify({
            type: 'chat',
            id: result.lastInsertRowid,
            userId,
            username,
            text,
            created_at: new Date().toISOString()
          });

          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          });
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
