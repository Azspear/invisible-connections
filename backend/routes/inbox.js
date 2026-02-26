const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/inbox
 * Get all conversations for current user (Inbox view)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        c.id as conversation_id,
        c.match_id,
        c.last_message_at,
        m.compatibility_score,
        CASE 
          WHEN m.user1_id = $1 THEN m.user2_id
          ELSE m.user1_id
        END as other_user_id,
        CASE 
          WHEN m.user1_id = $1 THEN u2.username
          ELSE u1.username
        END as other_username,
        CASE 
          WHEN m.user1_id = $1 THEN u2.bio
          ELSE u1.bio
        END as other_bio,
        (
          SELECT content 
          FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY sent_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT sent_at 
          FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY sent_at DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM messages 
          WHERE conversation_id = c.id 
            AND sender_id != $1 
            AND read_at IS NULL
        )::integer as unread_count
      FROM conversations c
      JOIN matches m ON c.match_id = m.id
      JOIN users u1 ON m.user1_id = u1.id
      JOIN users u2 ON m.user2_id = u2.id
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND m.status = 'active'
      ORDER BY c.last_message_at DESC NULLS LAST
    `, [userId]);

    res.json({
      conversations: result.rows
    });
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/inbox/:conversationId/messages
 * Get all messages in a conversation
 */
router.get('/:conversationId/messages', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Verify user has access to this conversation
    const conversationCheck = await pool.query(`
      SELECT c.id 
      FROM conversations c
      JOIN matches m ON c.match_id = m.id
      WHERE c.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)
    `, [conversationId, userId]);

    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    // Get messages
    const result = await pool.query(`
      SELECT 
        msg.id,
        msg.sender_id,
        u.username as sender_username,
        msg.content,
        msg.sent_at,
        msg.read_at,
        msg.is_ai_suggestion
      FROM messages msg
      JOIN users u ON msg.sender_id = u.id
      WHERE msg.conversation_id = $1
      ORDER BY msg.sent_at ASC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);

    // Mark messages as read
    await pool.query(`
      UPDATE messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND read_at IS NULL
    `, [conversationId, userId]);

    res.json({
      messages: result.rows,
      conversationId
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/inbox/:conversationId/messages
 * Send a message in a conversation
 */
router.post('/:conversationId/messages',
  [
    body('content').trim().notEmpty().withMessage('Message cannot be empty')
      .isLength({ max: 2000 }).withMessage('Message too long')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { conversationId } = req.params;
      const { content } = req.body;

      // Verify user has access to this conversation
      const conversationCheck = await pool.query(`
        SELECT c.id, m.user1_id, m.user2_id
        FROM conversations c
        JOIN matches m ON c.match_id = m.id
        WHERE c.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2) AND m.status = 'active'
      `, [conversationId, userId]);

      if (conversationCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied or conversation not found' });
      }

      // Insert message
      const result = await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, sent_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id, sender_id, content, sent_at, read_at, is_ai_suggestion
      `, [conversationId, userId, content]);

      const message = result.rows[0];

      // Update conversation's last_message_at
      await pool.query(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      // Get sender username for response
      const userResult = await pool.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );

      res.status(201).json({
        message: 'Message sent successfully',
        data: {
          id: message.id,
          senderId: message.sender_id,
          senderUsername: userResult.rows[0].username,
          content: message.content,
          sentAt: message.sent_at,
          readAt: message.read_at,
          isAiSuggestion: message.is_ai_suggestion
        }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * GET /api/inbox/:conversationId/info
 * Get conversation details and other user's profile
 */
router.get('/:conversationId/info', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const result = await pool.query(`
      SELECT 
        c.id as conversation_id,
        c.match_id,
        c.created_at,
        c.last_message_at,
        m.compatibility_score,
        CASE 
          WHEN m.user1_id = $1 THEN m.user2_id
          ELSE m.user1_id
        END as other_user_id,
        CASE 
          WHEN m.user1_id = $1 THEN u2.username
          ELSE u1.username
        END as other_username,
        CASE 
          WHEN m.user1_id = $1 THEN u2.bio
          ELSE u1.bio
        END as other_bio,
        CASE 
          WHEN m.user1_id = $1 THEN array_agg(DISTINCT i2.name) FILTER (WHERE i2.name IS NOT NULL)
          ELSE array_agg(DISTINCT i1.name) FILTER (WHERE i1.name IS NOT NULL)
        END as other_interests,
        CASE 
          WHEN m.user1_id = $1 THEN array_agg(DISTINCT t2.name) FILTER (WHERE t2.name IS NOT NULL)
          ELSE array_agg(DISTINCT t1.name) FILTER (WHERE t1.name IS NOT NULL)
        END as other_traits
      FROM conversations c
      JOIN matches m ON c.match_id = m.id
      JOIN users u1 ON m.user1_id = u1.id
      JOIN users u2 ON m.user2_id = u2.id
      LEFT JOIN user_interests ui1 ON u1.id = ui1.user_id
      LEFT JOIN interests i1 ON ui1.interest_id = i1.id
      LEFT JOIN user_traits ut1 ON u1.id = ut1.user_id
      LEFT JOIN traits t1 ON ut1.trait_id = t1.id
      LEFT JOIN user_interests ui2 ON u2.id = ui2.user_id
      LEFT JOIN interests i2 ON ui2.interest_id = i2.id
      LEFT JOIN user_traits ut2 ON u2.id = ut2.user_id
      LEFT JOIN traits t2 ON ut2.trait_id = t2.id
      WHERE c.id = $2 AND (m.user1_id = $1 OR m.user2_id = $1)
      GROUP BY c.id, c.match_id, c.created_at, c.last_message_at, 
               m.compatibility_score, m.user1_id, m.user2_id,
               u1.username, u1.bio, u2.username, u2.bio
    `, [userId, conversationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get conversation info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/inbox/search-users
 * Search for users by username to start a new conversation
 */
router.post('/search-users',
  [
    body('username').trim().notEmpty().isLength({ min: 4, max: 4 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const { username } = req.body;

      // Find user by username
      const userResult = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.bio,
          array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as interests,
          array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as traits
        FROM users u
        LEFT JOIN user_interests ui ON u.id = ui.user_id
        LEFT JOIN interests i ON ui.interest_id = i.id
        LEFT JOIN user_traits ut ON u.id = ut.user_id
        LEFT JOIN traits t ON ut.trait_id = t.id
        WHERE u.username = $1 AND u.is_active = true AND u.id != $2
        GROUP BY u.id
      `, [username, currentUserId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const foundUser = userResult.rows[0];

      // Check if already matched
      const existingMatch = await pool.query(`
        SELECT m.id, c.id as conversation_id
        FROM matches m
        LEFT JOIN conversations c ON m.id = c.match_id
        WHERE ((m.user1_id = $1 AND m.user2_id = $2) 
           OR (m.user1_id = $2 AND m.user2_id = $1))
          AND m.status = 'active'
      `, [currentUserId, foundUser.id]);

      if (existingMatch.rows.length > 0) {
        return res.json({
          user: foundUser,
          alreadyMatched: true,
          conversationId: existingMatch.rows[0].conversation_id
        });
      }

      res.json({
        user: foundUser,
        alreadyMatched: false
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * DELETE /api/inbox/:conversationId
 * Delete a conversation (soft delete by removing match)
 */
router.delete('/:conversationId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    // Get match_id from conversation
    const conversation = await pool.query(`
      SELECT c.match_id, m.user1_id, m.user2_id
      FROM conversations c
      JOIN matches m ON c.match_id = m.id
      WHERE c.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)
    `, [conversationId, userId]);

    if (conversation.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const matchId = conversation.rows[0].match_id;

    // Soft delete the match (which cascades to hide the conversation)
    await pool.query(
      'UPDATE matches SET status = $1 WHERE id = $2',
      ['deleted', matchId]
    );

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
