# Invisible Connections - Complete Website

An AI-powered anonymous friendship platform for introverts. Connect based on personality and interests, not appearance.

## 🎯 Features

### ✅ Implemented Features
- **4-Digit Anonymous Usernames**: Each user gets a unique 4-digit username (0000-9999)
- **Complete Authentication System**: Register, login, JWT-based auth
- **Profile Setup**: Select interests and personality traits
- **AI-Powered Matching**: Find compatible friends based on interests and traits
- **Real-Time Messaging**: Socket.io powered instant messaging
- **Inbox Feature**: Dedicated inbox with conversations list
- **Search Users**: Find and message any user by their 4-digit username
- **Unread Message Counts**: Track unread messages
- **Match Management**: Create and remove matches
- **Responsive Design**: Works on desktop and mobile

### 🔮 Future Enhancements (Ready to Add)
- AI conversation starters (Anthropic Claude API)
- Voice messages
- Progressive photo reveal
- Email notifications
- Push notifications
- Mobile apps (React Native)

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### 1. Clone/Extract the Project
```bash
cd invisible-connections
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invisible_connections
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

#### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE invisible_connections;
\q
```

#### Initialize Database Tables
```bash
npm run init-db
```

This will create all necessary tables and insert default interests/traits.

#### Start Backend Server
```bash
npm run dev
```

Server will start on http://localhost:5000

### 3. Frontend Setup

#### Open Frontend
```bash
cd ../frontend
```

#### Serve Frontend
You can use any static file server:

**Option A: Using Python**
```bash
python -m http.server 3000
```

**Option B: Using Node's http-server**
```bash
npm install -g http-server
http-server -p 3000
```

**Option C: Using VS Code Live Server**
- Install Live Server extension
- Right-click on `landing.html`
- Select "Open with Live Server"

Frontend will be available at http://localhost:3000

---

## 📁 Project Structure

```
invisible-connections/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   ├── routes/
│   │   ├── auth.js               # Register, login, verify
│   │   ├── users.js              # Profile management
│   │   ├── matches.js            # Matching algorithm
│   │   └── inbox.js              # Messaging system
│   ├── scripts/
│   │   └── initDatabase.js       # Database initialization
│   ├── utils/
│   │   └── username.js           # 4-digit username generator
│   ├── server.js                 # Main Express server + Socket.io
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── js/
    │   └── api.js                # API configuration
    ├── landing.html              # Landing page
    ├── register.html             # Registration page
    ├── login.html                # Login page
    ├── profile.html              # Profile setup
    ├── matches.html              # Find matches
    └── inbox.html                # Messaging inbox
```

---

## 🎮 How to Use

### 1. **Create Account**
- Visit http://localhost:3000/landing.html
- Click "Get Started"
- Enter email and password
- System automatically generates a unique 4-digit username for you

### 2. **Setup Profile**
- Select at least 3 interests
- Pick at least 2 personality traits
- Optionally add a bio
- Click "Find Matches"

### 3. **Find Matches**
- View AI-recommended matches based on compatibility
- See shared interests and compatibility scores
- Click "Start Chat" to create a match

### 4. **Message Friends**
- Go to Inbox to see all conversations
- Real-time messaging with Socket.io
- Unread message indicators
- Search for users by their 4-digit username

---

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/register      # Create new account
POST   /api/auth/login         # Login
GET    /api/auth/verify        # Verify JWT token
```

### Users
```
GET    /api/users/profile      # Get current user profile
PUT    /api/users/profile      # Update profile
GET    /api/users/interests    # Get all interests
GET    /api/users/traits       # Get all traits
GET    /api/users/:username    # Get user by username
```

### Matches
```
GET    /api/matches/find       # Find potential matches
POST   /api/matches/create     # Create a match
GET    /api/matches/my-matches # Get all matches
DELETE /api/matches/:matchId   # Remove a match
```

### Inbox
```
GET    /api/inbox                          # Get all conversations
GET    /api/inbox/:conversationId/messages # Get messages
POST   /api/inbox/:conversationId/messages # Send message
GET    /api/inbox/:conversationId/info     # Get conversation details
POST   /api/inbox/search-users             # Search by username
DELETE /api/inbox/:conversationId          # Delete conversation
```

---

## 🔌 Socket.io Events

### Client -> Server
```javascript
socket.emit('authenticate', { userId, username });
socket.emit('join-conversation', conversationId);
socket.emit('send-message', { conversationId, content });
socket.emit('typing', { conversationId });
socket.emit('stop-typing', { conversationId });
socket.emit('mark-read', { conversationId });
```

### Server -> Client
```javascript
socket.on('new-message', messageData);
socket.on('new-message-notification', notification);
socket.on('user-typing', { username });
socket.on('user-stop-typing', { username });
socket.on('messages-read', { conversationId, readBy });
```

---

## 🗃️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(4) UNIQUE NOT NULL,  -- 4-digit username
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### Other Tables
- `interests` - Available interests
- `traits` - Available personality traits
- `user_interests` - User's selected interests
- `user_traits` - User's selected traits
- `matches` - Friend matches between users
- `conversations` - Conversation threads
- `messages` - Individual messages
- `blocked_users` - Blocked user relationships
- `reports` - User reports

---

## 🚀 Deployment

### Backend Deployment (Railway/Heroku)

#### Railway (Recommended)
1. Create account at railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Connect your repository
4. Add PostgreSQL database
5. Set environment variables in Railway dashboard
6. Deploy!

#### Heroku
```bash
heroku create invisible-connections-api
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set JWT_SECRET=your_secret
git push heroku main
```

### Frontend Deployment (Vercel/Netlify)

#### Vercel
```bash
npm i -g vercel
cd frontend
vercel --prod
```

#### Netlify
1. Drag and drop frontend folder to netlify.com
2. Or connect GitHub repo
3. Configure build settings (none needed for static files)

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-db-host.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your-db-password
JWT_SECRET=your-strong-secret-key
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection

---

## 🧪 Testing

### Test Backend API
```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 💡 Key Features Explained

### 4-Digit Usernames
- Each user gets a random 4-digit number (0000-9999)
- 10,000 possible usernames
- No choosing names → removes identity pressure
- Easy to share: "I'm 4729!"

### Matching Algorithm
```javascript
Compatibility Score = 
  (Shared Interests / Max Interests) × 60 +
  (Shared Traits / Max Traits) × 40
```

### Inbox Feature
- Dedicated messaging interface
- Conversation list with last message preview
- Unread message counts
- Real-time updates via Socket.io
- Search any user by 4-digit username
- Start new conversations instantly

---

## 🤝 Contributing

This is a hackathon project by I. Akshith from Bhavans Vivekananda College.

---

## 📝 License

MIT License - Feel free to use and modify!

---

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Restart PostgreSQL
sudo service postgresql restart
```

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

### JWT Token Issues
- Clear localStorage in browser
- Check JWT_SECRET is set in .env
- Token expires after 7 days

---

## 📧 Contact

**I. Akshith**
- College: Bhavans Vivekananda College
- Project: Invisible Connections
- Email: akshith@invisibleconnections.com

---

## 🎉 Acknowledgments

Built for hackathon demonstration.
Designed to help introverts find genuine friendships.

**Tech Stack:**
- Backend: Node.js, Express.js, PostgreSQL, Socket.io
- Frontend: HTML, CSS, JavaScript
- Authentication: JWT, bcrypt
- Real-time: Socket.io
- Deployment: Railway, Vercel

---

## 🔮 Future Roadmap

1. **AI Integration**
   - Anthropic Claude API for conversation starters
   - GPT-4 for profile analysis
   - Sentiment analysis

2. **Mobile Apps**
   - React Native for iOS/Android
   - Push notifications
   - Offline messaging

3. **Advanced Features**
   - Voice messages
   - Group chats (3-5 people)
   - Interest-based communities
   - Events and meetups

4. **Monetization**
   - Free: 3 matches/day
   - Premium ($7.99/mo): Unlimited matches, advanced filters
   - Enterprise: College/company plans

---

**Status:** ✅ Ready for Hackathon Demo
**Last Updated:** February 26, 2026
