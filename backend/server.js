require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const pool = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/inbox', require('./routes/inbox'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
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

// Socket.io for real-time messaging
const userSockets = new Map(); // userId -> socketId mapping

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // User authentication
  socket.on('authenticate', async (data) => {
    const { userId, username } = data;
    socket.userId = userId;
    socket.username = username;
    userSockets.set(userId, socket.id);
    console.log(`✅ User ${username} (${userId}) authenticated`);
  });

  // Join conversation room
  socket.on('join-conversation', async (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`✅ User ${socket.username} joined conversation ${conversationId}`);
  });

  // Leave conversation room
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(`conversation-${conversationId}`);
    console.log(`👋 User ${socket.username} left conversation ${conversationId}`);
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { conversationId, content } = data;
      const senderId = socket.userId;

      if (!senderId || !conversationId || !content) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Save message to database
      const result = await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, sent_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id, sender_id, content, sent_at, read_at
      `, [conversationId, senderId, content]);

      const message = result.rows[0];

      // Update conversation's last_message_at
      await pool.query(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      // Broadcast message to all users in the conversation room
      const messageData = {
        id: message.id,
        conversationId,
        senderId: message.sender_id,
        senderUsername: socket.username,
        content: message.content,
        sentAt: message.sent_at,
        readAt: message.read_at
      };

      io.to(`conversation-${conversationId}`).emit('new-message', messageData);

      // Get the other user in the conversation to send notification
      const otherUserResult = await pool.query(`
        SELECT 
          CASE 
            WHEN m.user1_id = $1 THEN m.user2_id
            ELSE m.user1_id
          END as other_user_id
        FROM conversations c
        JOIN matches m ON c.match_id = m.id
        WHERE c.id = $2
      `, [senderId, conversationId]);

      if (otherUserResult.rows.length > 0) {
        const otherUserId = otherUserResult.rows[0].other_user_id;
        const otherSocketId = userSockets.get(otherUserId);
        
        if (otherSocketId) {
          io.to(otherSocketId).emit('new-message-notification', {
            conversationId,
            senderUsername: socket.username,
            preview: content.substring(0, 50)
          });
        }
      }

      console.log(`📩 Message sent in conversation ${conversationId} by ${socket.username}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation-${conversationId}`).emit('user-typing', {
      username: socket.username,
      conversationId
    });
  });

  socket.on('stop-typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation-${conversationId}`).emit('user-stop-typing', {
      username: socket.username,
      conversationId
    });
  });

  // Mark messages as read
  socket.on('mark-read', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      await pool.query(`
        UPDATE messages 
        SET read_at = CURRENT_TIMESTAMP 
        WHERE conversation_id = $1 
          AND sender_id != $2 
          AND read_at IS NULL
      `, [conversationId, userId]);

      socket.to(`conversation-${conversationId}`).emit('messages-read', {
        conversationId,
        readBy: userId
      });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log(`👋 User ${socket.username} (${socket.userId}) disconnected`);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   🚀 Invisible Connections API Server        ║
  ║   ✅ Server running on port ${PORT}             ║
  ║   🌐 Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   📡 Socket.io: Ready                         ║
  ╚═══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };
