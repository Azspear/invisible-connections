const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.bio,
        u.created_at,
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = result.rows[0];
    res.json({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      bio: profile.bio,
      interests: profile.interests || [],
      traits: profile.traits || [],
      createdAt: profile.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile (bio, interests, traits)
 */
router.put('/profile',
  [
    body('bio').optional().isLength({ max: 500 }),
    body('interests').optional().isArray({ min: 3, max: 10 }),
    body('traits').optional().isArray({ min: 2, max: 8 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { bio, interests, traits } = req.body;

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update bio if provided
        if (bio !== undefined) {
          await client.query(
            'UPDATE users SET bio = $1 WHERE id = $2',
            [bio, userId]
          );
        }

        // Update interests if provided
        if (interests && Array.isArray(interests)) {
          // Remove existing interests
          await client.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);

          // Add new interests
          for (const interestName of interests) {
            const interestResult = await client.query(
              'SELECT id FROM interests WHERE name = $1',
              [interestName]
            );

            if (interestResult.rows.length > 0) {
              const interestId = interestResult.rows[0].id;
              await client.query(
                'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, interestId]
              );
            }
          }
        }

        // Update traits if provided
        if (traits && Array.isArray(traits)) {
          // Remove existing traits
          await client.query('DELETE FROM user_traits WHERE user_id = $1', [userId]);

          // Add new traits
          for (const traitName of traits) {
            const traitResult = await client.query(
              'SELECT id FROM traits WHERE name = $1',
              [traitName]
            );

            if (traitResult.rows.length > 0) {
              const traitId = traitResult.rows[0].id;
              await client.query(
                'INSERT INTO user_traits (user_id, trait_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, traitId]
              );
            }
          }
        }

        await client.query('COMMIT');

        // Fetch updated profile
        const result = await client.query(`
          SELECT 
            u.id, 
            u.username, 
            u.email, 
            u.bio,
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

        const profile = result.rows[0];
        res.json({
          message: 'Profile updated successfully',
          profile: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            bio: profile.bio,
            interests: profile.interests || [],
            traits: profile.traits || []
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * GET /api/users/interests
 * Get all available interests
 */
router.get('/interests', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM interests ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get interests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/users/traits
 * Get all available traits
 */
router.get('/traits', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM traits ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get traits error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/users/:username
 * Get another user's public profile by username
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.userId;

    // Check if user is blocked
    const blockCheck = await pool.query(
      'SELECT 1 FROM blocked_users WHERE blocker_id = $1 AND blocked_id = (SELECT id FROM users WHERE username = $2)',
      [currentUserId, username]
    );

    if (blockCheck.rows.length > 0) {
      return res.status(403).json({ error: 'User is blocked' });
    }

    const result = await pool.query(`
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
      WHERE u.username = $1 AND u.is_active = true
      GROUP BY u.id
    `, [username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = result.rows[0];
    res.json({
      id: profile.id,
      username: profile.username,
      bio: profile.bio,
      interests: profile.interests || [],
      traits: profile.traits || [],
      createdAt: profile.created_at
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
