const pool = require('../config/database');

/**
 * Generate a unique 4-digit username
 * Format: 4 random digits (0000-9999)
 */
async function generateUniqueUsername() {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    // Generate random 4-digit number (0000-9999)
    const username = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    // Check if username already exists
    const result = await pool.query(
      'SELECT username FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return username;
    }

    attempts++;
  }

  throw new Error('Unable to generate unique username after multiple attempts');
}

/**
 * Check if a username exists
 */
async function usernameExists(username) {
  const result = await pool.query(
    'SELECT username FROM users WHERE username = $1',
    [username]
  );
  return result.rows.length > 0;
}

module.exports = {
  generateUniqueUsername,
  usernameExists
};
