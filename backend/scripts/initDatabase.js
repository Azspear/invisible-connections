const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const initDatabase = async () => {
  try {
    console.log('🗄️  Initializing database...');

    // Create users table with 4-digit unique usernames
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(4) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);
    console.log('✅ Users table created');

    // Create interests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `);
    console.log('✅ Interests table created');

    // Create user_interests junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_interests (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        interest_id INTEGER REFERENCES interests(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, interest_id)
      );
    `);
    console.log('✅ User interests table created');

    // Create traits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traits (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `);
    console.log('✅ Traits table created');

    // Create user_traits junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_traits (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        trait_id INTEGER REFERENCES traits(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, trait_id)
      );
    `);
    console.log('✅ User traits table created');

    // Create matches table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        compatibility_score INTEGER,
        matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        UNIQUE(user1_id, user2_id)
      );
    `);
    console.log('✅ Matches table created');

    // Create conversations table (for inbox feature)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Conversations table created');

    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        is_ai_suggestion BOOLEAN DEFAULT false
      );
    `);
    console.log('✅ Messages table created');

    // Create blocked_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id)
      );
    `);
    console.log('✅ Blocked users table created');

    // Create reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reported_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending'
      );
    `);
    console.log('✅ Reports table created');

    // Insert default interests
    const defaultInterests = [
      'Music', 'Tech', 'Gaming', 'Movies', 'Reading', 'Travel',
      'Fitness', 'Cooking', 'Art', 'Photography', 'Nature', 'Podcasts',
      'Sports', 'Dancing', 'Writing', 'Anime', 'Fashion', 'Science'
    ];

    for (const interest of defaultInterests) {
      await pool.query(
        'INSERT INTO interests (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [interest]
      );
    }
    console.log('✅ Default interests inserted');

    // Insert default traits
    const defaultTraits = [
      'Introvert', 'Extrovert', 'Good Listener', 'Conversationalist',
      'Creative', 'Analytical', 'Calm', 'Energetic', 'Adventurous',
      'Thoughtful', 'Spontaneous', 'Empathetic', 'Organized', 'Flexible'
    ];

    for (const trait of defaultTraits) {
      await pool.query(
        'INSERT INTO traits (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [trait]
      );
    }
    console.log('✅ Default traits inserted');

    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_match ON conversations(match_id);');
    console.log('✅ Indexes created');

    console.log('\n🎉 Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
};

initDatabase();
