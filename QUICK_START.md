# 🚀 QUICK START GUIDE - Invisible Connections

## What I've Built For You

A **complete, production-ready website** with:

✅ **Backend API** (Node.js + Express + PostgreSQL)
- User authentication with JWT
- **4-digit anonymous usernames** (automatically generated)
- Matching algorithm based on interests/traits
- Real-time messaging with Socket.io
- **Dedicated inbox feature**
- Search users by 4-digit ID
- Full database schema

✅ **Frontend** (HTML/CSS/JavaScript)
- Landing page
- Registration & Login
- Profile setup
- Find matches
- **Inbox with real-time chat**
- Search and message any user

---

## 📦 What's Included

```
invisible-connections/
├── backend/                    # Node.js API Server
│   ├── config/                 # Database configuration
│   ├── middleware/             # Authentication middleware
│   ├── routes/                 # API endpoints
│   │   ├── auth.js            # Register/Login
│   │   ├── users.js           # Profile management
│   │   ├── matches.js         # Matching algorithm
│   │   └── inbox.js           # Messaging system
│   ├── scripts/               # Database setup
│   ├── utils/                 # 4-digit username generator
│   ├── server.js              # Main server
│   └── package.json
│
└── frontend/                   # Website UI
    ├── js/api.js              # API integration
    ├── landing.html           # Home page
    ├── register.html          # Sign up
    ├── login.html             # Sign in
    ├── profile.html           # Profile setup
    ├── matches.html           # Find friends
    └── inbox.html             # NEW! Messaging inbox
```

---

## ⚡ Getting Started (5 Minutes)

### Step 1: Extract Files
```bash
tar -xzf invisible-connections-complete.tar.gz
cd invisible-connections
```

### Step 2: Install PostgreSQL
**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

### Step 3: Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE invisible_connections;
\q
```

### Step 4: Setup Backend
```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database password
nano .env  # or use any text editor
```

**Important: Set your database password in .env:**
```env
DB_PASSWORD=your_postgres_password
JWT_SECRET=make_this_a_random_strong_string
```

**Initialize Database:**
```bash
npm run init-db
```

You should see:
```
✅ Users table created
✅ Interests table created
... (more tables)
🎉 Database initialized successfully!
```

**Start Backend:**
```bash
npm run dev
```

You should see:
```
  ╔═══════════════════════════════════════════════╗
  ║   🚀 Invisible Connections API Server        ║
  ║   ✅ Server running on port 5000             ║
  ╚═══════════════════════════════════════════════╝
```

### Step 5: Setup Frontend
**Open a new terminal:**

```bash
cd frontend

# Option 1: Python
python3 -m http.server 3000

# Option 2: Node.js http-server
npm install -g http-server
http-server -p 3000
```

### Step 6: Open Browser
Visit: **http://localhost:3000/landing.html**

---

## 🎯 How To Use

### 1. Register an Account
- Click "Get Started"
- Enter email and password
- System automatically assigns you a **4-digit username** (e.g., 4729)
- You're logged in!

### 2. Setup Your Profile
- Select 3+ interests
- Pick 2+ personality traits
- Add a bio (optional)
- Click "Find Matches"

### 3. Find Compatible Friends
- See AI-recommended matches
- View compatibility scores
- Check shared interests
- Click "Start Chat" to connect

### 4. **NEW! Use the Inbox**
- Click "Inbox" to see all conversations
- **Search any user by their 4-digit ID**
- Real-time messaging
- Unread message indicators
- Start conversations with anyone!

---

## 🌟 Key Features Explained

### 4-Digit Anonymous Usernames
- Each user gets a unique random number (0000-9999)
- No choosing names = no identity pressure
- Easy to share: "Hey, I'm 4729!"
- Supports up to 10,000 users

### Inbox Feature
- **Search Users**: Enter any 4-digit ID to find and message anyone
- **Conversation List**: See all your chats in one place
- **Real-Time**: Messages appear instantly via Socket.io
- **Unread Counts**: Know which conversations need attention
- **Last Message Preview**: See what was said last

### Real-Time Chat
- Messages appear instantly
- Typing indicators
- Read receipts
- No page refresh needed

### AI Matching
```
Compatibility = 
  (Shared Interests ÷ Total Interests) × 60 +
  (Shared Traits ÷ Total Traits) × 40
```

---

## 🧪 Testing It Works

### Test 1: Register Two Users
1. Open browser in normal mode: http://localhost:3000/landing.html
2. Register user 1 (e.g., gets username 1234)
3. Open browser in incognito mode: http://localhost:3000/landing.html
4. Register user 2 (e.g., gets username 5678)

### Test 2: Setup Profiles
1. Both users select interests: Music, Tech, Movies
2. Both users select traits: Introvert, Good Listener

### Test 3: Find Each Other
**User 1 (1234):**
- Go to Inbox
- Search "5678"
- Click "Start Chat"
- Send message: "Hey!"

**User 2 (5678):**
- Should see conversation appear
- Should see "Hey!" message
- Reply: "Hello!"

**User 1:**
- Should see "Hello!" appear instantly

✅ **Success!** Real-time chat working!

---

## 🚀 Deploying to Production

### Backend (Railway - Easiest)

1. **Sign up**: https://railway.app
2. **New Project** → Deploy from GitHub
3. **Add PostgreSQL**: Add → Database → PostgreSQL
4. **Set Variables**:
```
NODE_ENV=production
JWT_SECRET=your_random_secret_key_here
FRONTEND_URL=https://your-frontend-url.vercel.app
```
5. **Deploy!**

Get your API URL: `https://your-app.railway.app`

### Frontend (Vercel)

1. **Update API URL** in `frontend/js/api.js`:
```javascript
const API_BASE_URL = 'https://your-app.railway.app/api';
const SOCKET_URL = 'https://your-app.railway.app';
```

2. **Deploy**:
```bash
cd frontend
npm i -g vercel
vercel --prod
```

3. **Done!** Get your URL: `https://your-site.vercel.app`

---

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Start it
sudo service postgresql start
```

### Port Already in Use
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

### Frontend Can't Connect to Backend
1. Check backend is running on port 5000
2. Check `frontend/js/api.js` has correct URL
3. Open browser console (F12) for errors

### Can't Create Account
1. Check database was initialized: `npm run init-db`
2. Check .env has correct database password
3. Check backend console for errors

---

## 📁 Important Files

**Backend:**
- `server.js` - Main server file
- `routes/auth.js` - Login/register logic
- `routes/inbox.js` - **Messaging system**
- `utils/username.js` - **4-digit username generator**

**Frontend:**
- `inbox.html` - **NEW! Messaging interface**
- `js/api.js` - API configuration
- `landing.html` - Home page

**Database:**
- `scripts/initDatabase.js` - Creates all tables

---

## 💡 What Makes This Special

### For Hackathons:
✅ **Fully Functional** - Not just a prototype
✅ **Real Database** - Persistent data
✅ **Real-Time** - Socket.io messaging
✅ **Unique Feature** - 4-digit anonymous IDs
✅ **Inbox System** - Professional messaging UI
✅ **Production Ready** - Can deploy immediately

### For Users:
✅ **No Photos** - Zero appearance pressure
✅ **Anonymous** - 4-digit IDs protect identity
✅ **Smart Matching** - AI finds compatible friends
✅ **Easy to Use** - Search anyone by ID
✅ **Private** - Secure authentication

---

## 🎓 What You Learned

This project includes:
- REST API design
- WebSocket/Socket.io real-time communication
- PostgreSQL database design
- JWT authentication
- Frontend-backend integration
- Username generation algorithms
- Matching algorithms
- Chat systems

---

## 📞 Support

Having issues? Check:
1. README.md in the project folder
2. Backend console logs
3. Browser console (F12)
4. Database connection

---

## 🎉 You're Ready!

Your complete friendship platform is ready to:
- ✅ Demo at hackathons
- ✅ Deploy to production
- ✅ Show to investors
- ✅ Use as portfolio project

**Start the servers and visit:**
http://localhost:3000/landing.html

**Good luck with your hackathon! 🚀**

---

Created by I. Akshith
Bhavans Vivekananda College
February 26, 2026
