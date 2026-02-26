const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Calculate compatibility score between two users
 */
function calculateCompatibility(user1Interests, user2Interests, user1Traits, user2Traits) {
  // Convert to arrays if not already
  const interests1 = Array.isArray(user1Interests) ? user1Interests : [];
  const interests2 = Array.isArray(user2Interests) ? user2Interests : [];
  const traits1 = Array.isArray(user1Traits) ? user1Traits : [];
  const traits2 = Array.isArray(user2Traits) ? user2Traits : [];

  // Calculate shared interests
  const sharedInterests = interests1.filter(i => interests2.includes(i));
  const interestScore = interests1.length > 0 && interests2.length > 0
    ? (sharedInterests.length / Math.max(interests1.length, interests2.length)) * 60
    : 0;

  // Calculate shared traits
  const sharedTraits = traits1.filter(t => traits2.includes(t));
  const traitScore = traits1.length > 0 && traits2.length > 0
    ? (sharedTraits.length / Math.max(traits1.length, traits2.length)) * 40
    : 0;

  return Math.min(Math.round(interestScore + traitScore), 95);
}

/**
 * GET /api/matches/find
 * Find potential matches for the current user
 */
router.get('/find', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

    // Get current user's profile
    const userProfile = await pool.query(`
      SELECT 
        u.id,
        array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as interests,
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as traits
      FROM users u
      LEFT JOIN user_interests ui ON u.id = ui.user_id
      LEFT JOIN interests i ON ui.interest_id = i.id
      LEFT JOIN user_traits ut ON u.id = ut.user_id
      LEFT JOIN traits t ON ut.trait_id = t.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (userProfile.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const currentUser = userProfile.rows[0];

    // Check if user has set up their profile
    if (!currentUser.interests || currentUser.interests.length === 0) {
      return res.status(400).json({ 
        error: 'Please complete your profile first',
        message: 'You need to select at least 3 interests and 2 traits'
      });
    }

    // Get potential matches (exclude current user, already matched users, and blocked users)
    const potentialMatches = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.created_at,
        array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as interests,
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as traits
      FROM users u
      LEFT JOIN user_interests ui ON u.id = ui.user_id
      LEFT JOIN interests i ON ui.interest_id = i.id
      LEFT JOIN user_traits ut ON u.id = ut.user_id
      LEFT JOIN traits t ON ut.trait_id = t.id
      WHERE u.id != $1
        AND u.is_active = true
        AND u.id NOT IN (
          SELECT user2_id FROM matches WHERE user1_id = $1
          UNION
          SELECT user1_id FROM matches WHERE user2_id = $1
        )
        AND u.id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
        )
      GROUP BY u.id
      HAVING COUNT(DISTINCT ui.interest_id) >= 3 AND COUNT(DISTINCT ut.trait_id) >= 2
    `, [userId]);

    // Calculate compatibility for each potential match
    const matches = potentialMatches.rows.map(match => {
      const compatibility = calculateCompatibility(
        currentUser.interests,
        match.interests,
        currentUser.traits,
        match.traits
      );

      // Find shared interests and traits
      const sharedInterests = (currentUser.interests || []).filter(i => 
        (match.interests || []).includes(i)
      );
      const sharedTraits = (currentUser.traits || []).filter(t => 
        (match.traits || []).includes(t)
      );

      return {
        id: match.id,
        username: match.username,
        bio: match.bio,
        compatibility,
        sharedInterests,
        sharedTraits,
        interests: match.interests || [],
        traits: match.traits || []
      };
    });

    // Sort by compatibility (highest first) and limit results
    matches.sort((a, b) => b.compatibility - a.compatibility);
    const topMatches = matches.slice(0, limit);

    res.json({
      matches: topMatches,
      total: matches.length
    });
  } catch (error) {
    console.error('Find matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/matches/create
 * Create a match between two users
 */
router.post('/create', async (req, res) => {
  try {
    const user1Id = req.user.userId;
    const { user2Id, compatibilityScore } = req.body;

    if (!user2Id) {
      return res.status(400).json({ error: 'user2Id is required' });
    }

    // Check if match already exists
    const existingMatch = await pool.query(
      `SELECT id FROM matches 
       WHERE (user1_id = $1 AND user2_id = $2) 
          OR (user1_id = $2 AND user2_id = $1)`,
      [user1Id, user2Id]
    );

    if (existingMatch.rows.length > 0) {
      return res.status(400).json({ error: 'Match already exists' });
    }

    // Create match
    const result = await pool.query(
      `INSERT INTO matches (user1_id, user2_id, compatibility_score) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [user1Id, user2Id, compatibilityScore || 0]
    );

    const match = result.rows[0];

    // Create conversation for this match
    const conversation = await pool.query(
      'INSERT INTO conversations (match_id) VALUES ($1) RETURNING *',
      [match.id]
    );

    res.status(201).json({
      message: 'Match created successfully',
      match: {
        id: match.id,
        conversationId: conversation.rows[0].id,
        user1Id: match.user1_id,
        user2Id: match.user2_id,
        compatibilityScore: match.compatibility_score,
        matchedAt: match.matched_at
      }
    });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/matches/my-matches
 * Get all matches for the current user
 */
router.get('/my-matches', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        m.id as match_id,
        m.compatibility_score,
        m.matched_at,
        m.status,
        c.id as conversation_id,
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
        c.last_message_at,
        (
          SELECT content 
          FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY sent_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*) 
          FROM messages 
          WHERE conversation_id = c.id 
            AND sender_id != $1 
            AND read_at IS NULL
        ) as unread_count
      FROM matches m
      JOIN users u1 ON m.user1_id = u1.id
      JOIN users u2 ON m.user2_id = u2.id
      LEFT JOIN conversations c ON m.id = c.match_id
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND m.status = 'active'
      ORDER BY c.last_message_at DESC NULLS LAST
    `, [userId]);

    res.json({
      matches: result.rows
    });
  } catch (error) {
    console.error('Get my matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/matches/:matchId
 * Remove a match (unmatch)
 */
router.delete('/:matchId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { matchId } = req.params;

    // Verify user is part of this match
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, userId]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Update match status instead of deleting (soft delete)
    await pool.query(
      'UPDATE matches SET status = $1 WHERE id = $2',
      ['deleted', matchId]
    );

    res.json({ message: 'Match removed successfully' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
