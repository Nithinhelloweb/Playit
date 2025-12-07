# 🎵 Music Player - Production-Level Web Application

A full-featured, Spotify-like music player built with **vanilla HTML, CSS, JavaScript, Node.js, Express, and MongoDB**. Features user authentication, playlist management, favorites, recently played tracking, admin panel, and more.

![Music Player](https://img.shields.io/badge/Version-1.0.0-purple) ![Node.js](https://img.shields.io/badge/Node.js-v14+-green) ![MongoDB](https://img.shields.io/badge/MongoDB-v4+-green)

## ✨ Features

### 🎧 Music Player
- **Full Player Controls**: Play, Pause, Next, Previous
- **Seek Bar**: Draggable progress bar with click-to-seek
- **Volume Control**: Volume slider with mute/unmute
- **Shuffle & Repeat**: Shuffle mode and repeat (all/one) modes
- **Queue Management**: View and manage upcoming songs
- **Keyboard Shortcuts**:
  - `Space` - Play/Pause
  - `→` - Seek forward 5 seconds
  - `←` - Seek backward 5 seconds
  - `↑` - Increase volume
  - `↓` - Decrease volume
- **Animated Album Art**: Rotating animation while playing
- **Progress Timer**: Current time and total duration display

### 🔒 User System
- **Authentication**: Secure signup/login with JWT tokens
- **Password Security**: Bcrypt password hashing
- **User Sessions**: Persistent login with localStorage

### 📚 Features
- **Favorites**: Add/remove songs to favorites
- **Playlists**: Create, rename, delete playlists
- **Recently Played**: Track last 20 played songs
- **Real-time Search**: Search songs by title, artist, or album
- **Download Songs**: Download songs (authenticated users only)
- **Responsive Design**: Works on desktop, tablet, and mobile

### 👨‍💼 Admin Panel
- **Upload Songs**: Upload MP3 files with metadata
- **Manage Songs**: Edit song information, delete songs
- **User Management**: View all users, delete non-admin users
- **Metadata Extraction**: Automatic duration extraction from MP3 files

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (pure CSS, no frameworks), Vanilla JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Password Hashing**: Bcrypt
- **Audio Metadata**: music-metadata

## 📁 Project Structure

```
lo1/
├── server/
│   ├── controllers/          # Request handlers
│   │   ├── authController.js
│   │   ├── songController.js
│   │   ├── playlistController.js
│   │   ├── favoriteController.js
│   │   └── adminController.js
│   ├── models/               # MongoDB schemas
│   │   ├── User.js
│   │   ├── Song.js
│   │   ├── Playlist.js
│   │   └── RecentlyPlayed.js
│   ├── routes/               # API routes
│   │   ├── auth.js
│   │   ├── songs.js
│   │   ├── playlists.js
│   │   ├── favorites.js
│   │   └── admin.js
│   ├── middleware/           # Custom middleware
│   │   └── auth.js
│   ├── uploads/              # Uploaded files
│   │   └── songs/
│   └── utils/                # Utility scripts
│       └── seedData.js
├── public/
│   ├── css/                  # Stylesheets
│   │   ├── auth.css
│   │   ├── player.css
│   │   └── admin.css
│   ├── js/                   # Client-side scripts
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── player.js
│   │   └── admin.js
│   ├── index.html            # Login page
│   ├── signup.html           # Signup page
│   ├── player.html           # Main player
│   └── admin.html            # Admin panel
├── server.js                 # Main server file
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Step 1: Clone or Navigate to Project
```bash
cd "d:/Invo/Music player/lo1"
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Edit `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/music-player
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_EMAIL=admin@musicplayer.com
ADMIN_PASSWORD=Admin@123
```

**Important**: Change `JWT_SECRET` to a strong random string in production!

### Step 4: Start MongoDB
Make sure MongoDB is running:
- **Local MongoDB**: `mongod`
- **MongoDB Atlas**: Update `MONGODB_URI` in `.env` with your connection string

### Step 5: Seed Database
Create the admin user and sample data:
```bash
npm run seed
```

This will create:
- Admin user: `admin@musicplayer.com` / `Admin@123`
- Sample user: `user@example.com` / `password123`

### Step 6: Start Server
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

Server will start at: `http://localhost:5000`

## 📖 Usage Guide

### For Users

1. **Sign Up**: Go to `http://localhost:5000/signup` and create an account
2. **Login**: Login at `http://localhost:5000`
3. **Browse & Play**: Browse songs and click to play
4. **Create Playlists**: Click "Playlists" → "Create Playlist"
5. **Add Favorites**: Click the heart icon on any song
6. **Search**: Use the search bar to find songs
7. **Download**: Click download icon next to songs

### For Admins

1. **Login**: Use admin credentials
2. **Access Admin Panel**: Go to `http://localhost:5000/admin`
3. **Upload Songs**: Fill in the form and select MP3 files
4. **Manage Songs**: Edit or delete existing songs
5. **Manage Users**: View and delete users (cannot delete admins)

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Songs
- `GET /api/songs` - Get all songs
- `GET /api/songs/:id` - Get song by ID
- `GET /api/songs/stream/:id` - Stream audio file
- `GET /api/search?q=query` - Search songs
- `GET /api/download/:id` - Download song (protected)
- `POST /api/recently-played/:id` - Add to recently played (protected)

### Playlists (Protected)
- `POST /api/playlists` - Create playlist
- `GET /api/playlists` - Get user playlists
- `GET /api/playlists/:id` - Get playlist by ID
- `PUT /api/playlists/:id` - Update playlist
- `DELETE /api/playlists/:id` - Delete playlist
- `POST /api/playlists/:id/songs` - Add song to playlist
- `DELETE /api/playlists/:id/songs/:songId` - Remove song

### Favorites (Protected)
- `POST /api/favorites/:songId` - Add to favorites
- `DELETE /api/favorites/:songId` - Remove from favorites
- `GET /api/favorites` - Get user favorites

### Admin (Protected + Admin Only)
- `POST /api/admin/upload` - Upload song
- `PUT /api/admin/songs/:id` - Edit song
- `DELETE /api/admin/songs/:id` - Delete song
- `GET /api/admin/users` - Get all users
- `DELETE /api/admin/users/:id` - Delete user

## 🎨 Design Features

- **Modern UI**: Gradient backgrounds, glassmorphism effects
- **Smooth Animations**: Hover effects, transitions, rotating album art
- **Responsive**: Works on all screen sizes
- **Dark Theme**: Easy on the eyes
- **Custom CSS**: No libraries, full control
- **Micro-animations**: Enhanced user experience

## 🔧 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- For Atlas, ensure IP is whitelisted

### Cannot Upload Songs
- Check file permissions on `server/uploads/songs/` directory
- Ensure you're logged in as admin
- Verify file is MP3 format

### Songs Not Playing
- Check browser console for errors
- Ensure audio files exist in `server/uploads/songs/`
- Try different browser (Chrome/Firefox recommended)

### Port Already in Use
- Change `PORT` in `.env` to a different number
- Or stop the process using port 5000

## 🚀 Production Deployment

1. **Set Environment Variables**:
   - Use strong `JWT_SECRET`
   - Set `NODE_ENV=production`
   - Use MongoDB Atlas for database

2. **Security**:
   - Enable HTTPS
   - Set secure CORS policies
   - Implement rate limiting
   - Add input sanitization

3. **Performance**:
   - Enable gzip compression
   - Add CDN for static files
   - Implement caching
   - Database indexing (already included)

## 📝 License

MIT License - feel free to use this project for learning or commercial purposes.

## 👨‍💻 Developer Notes

- All API calls use JWT authentication where required
- Songs are streamed with range support for seeking
- Recently played limited to 20 items per user
- Passwords hashed with bcrypt (10 salt rounds)
- File uploads limited to 50MB
- Uses MVC architecture pattern

## 🙏 Credits

Built with ❤️ using modern web technologies and best practices.

---

**Happy Listening! 🎵**
