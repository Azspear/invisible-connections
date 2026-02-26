const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * Calculate compatibility score
 */
function calculateCompatibility(user1Interests, user2Interests, user1Traits, user2Traits) {
  const interests1 = Array.isArray(user1Interests) ? user1Interests : [];
  const interests2 = Array.isArray(user2Interests) ? user2Interests : [];
  const traits1 = Array.isArray(user1Traits) ? user1Traits : [];
  const traits2 = Array.isArray(user2Traits) ? user2Traits : [];

  const sharedInterests = interests1.filter(i => interests2.includes(i));
  const interestScore =
    interests1.length > 0 && interests2.length > 0
      ? (sharedInterests.length / Math.max(interests1.length, interests2.length)) * 60
      : 0;

  const sharedTraits = traits1.filter(t => traits2.includes(t));
  const traitScore =
    traits1.length > 0 && traits2.length > 0
      ? (sharedTraits.length / Math.max(traits1.length, traits2.length)) * 40
      : 0;

  return Math.min(Math.round(interestScore + traitScore), 95);
}

/**
 * POST /api/matches/create
 * Create match + conversation
 */
router.post('/create', async (req, res) => {
  try {
    const user1Id = req.user.userId;
    const { user2Id } = req.body;

    if (!user2Id) {
      return res.status(400).json({ error: 'user2Id is required' });
    }

    // Prevent self match
    if (user1Id === user2Id) {
      return res.status(400).json({ error: 'Cannot match with yourself' });
    }

    // Check existing match
    const existingMatch = await pool.query(
      `SELECT id FROM matches 
       WHERE (user1_id = $1 AND user2_id = $2) 
          OR (user1_id = $2 AND user2_id = $1)`,
      [user1Id, user2Id]
    );

    if (existingMatch.rows.length > 0) {
      return res.status(400).json({ error: 'Match already exists' });
    }

    // Get both users interests + traits
    const usersData = await pool.query(`
      SELECT 
        u.id,
        array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as interests,
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as traits
      FROM users u
      LEFT JOIN user_interests ui ON u.id = ui.user_id
      LEFT JOIN interests i ON ui.interest_id = i.id
      LEFT JOIN user_traits ut ON u.id = ut.user_id
      LEFT JOIN traits t ON ut.trait_id = t.id
      WHERE u.id = $1 OR u.id = $2
      GROUP BY u.id
    `, [user1Id, user2Id]);

    if (usersData.rows.length < 2) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user1 = usersData.rows.find(u => u.id === user1Id);
    const user2 = usersData.rows.find(u => u.id === user2Id);

    const compatibilityScore = calculateCompatibility(
      user1.interests,
      user2.interests,
      user1.traits,
      user2.traits
    );

    // Create match
    const matchResult = await pool.query(
      `INSERT INTO matches (user1_id, user2_id, compatibility_score, status) 
       VALUES ($1, $2, $3, 'active') 
       RETURNING *`,
      [user1Id, user2Id, compatibilityScore]
    );

    const match = matchResult.rows[0];

    // Create conversation
    const conversationResult = await pool.query(
      `INSERT INTO conversations (match_id, created_at) 
       VALUES ($1, NOW()) 
       RETURNING *`,
      [match.id]
    );

    res.status(201).json({
      message: 'Match created successfully',
      match: {
        id: match.id,
        conversationId: conversationResult.rows[0].id,
        compatibilityScore
      }
    });

  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/matches/my-matches
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
        END as other_username
      FROM matches m
      JOIN users u1 ON m.user1_id = u1.id
      JOIN users u2 ON m.user2_id = u2.id
      LEFT JOIN conversations c ON m.id = c.match_id
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND m.status = 'active'
    `, [userId]);

    res.json({ matches: result.rows });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;