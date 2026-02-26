require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const pool = require('./config/database');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

/* -------------------- IMPORTANT FIX -------------------- */
/* These were MISSING — this caused req.body to be undefined */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/* -------------------------------------------------------- */

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

/* -------------------- ROUTES -------------------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/inbox', require('./routes/inbox'));

/* -------------------- HEALTH -------------------- */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Invisible Connections API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      matches: '/api/matches',
      inbox: '/api/inbox'
    }
  });
});

/* -------------------- SOCKET.IO -------------------- */

const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('authenticate', ({ userId, username }) => {
    socket.userId = userId;
    socket.username = username;
    userSockets.set(userId, socket.id);
    console.log(`✅ User ${username} authenticated`);
  });

  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
  });

  socket.on('send-message', async ({ conversationId, content }) => {
    try {
      const senderId = socket.userId;
      if (!senderId || !conversationId || !content) return;

      const result = await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, sent_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `, [conversationId, senderId, content]);

      await pool.query(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      const message = result.rows[0];

      io.to(`conversation-${conversationId}`).emit('new-message', {
        id: message.id,
        conversationId,
        senderId: message.sender_id,
        content: message.content,
        sentAt: message.sent_at
      });

    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
  });
});

/* -------------------- ERROR HANDLING -------------------- */

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/* -------------------- START SERVER -------------------- */

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  🚀 Invisible Connections API Server
  ✅ Running on port ${PORT}
  🌐 Environment: ${process.env.NODE_ENV || 'development'}
  📡 Socket.io Ready
  `);
});

module.exports = { app, server, io };