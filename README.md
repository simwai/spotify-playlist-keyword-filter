# Spotify Playlist Keyword Filter

Money, Bitch, Smoking etc. All these words are in most of the current songs. If you want to have a clean playlist with none of such words, start using Spotify Playlist Keyword Filter. Maybe you have an addiction or little respect for women then listening to selected music can be benefiting.

Currently, the app is still in work.

## Features

- Connect to your Spotify account
- Fetch playlists and track information
- Search and retrieve song lyrics from Genius
- Filter songs based on keyword content
- Clean playlist management
- Persistent lyrics caching with SQLite

## Prerequisites

- Node.js (Download from [nodejs.org](https://nodejs.org/download/))
- Spotify Developer Account
- Genius API Account

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Setup

### 1. Spotify API Credentials

1. Go to [Spotify for Developers Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Set the Redirect URI to: `http://localhost:8888/callback/`
4. Note down your Client ID and Client Secret

### 2. Genius API Credentials

1. Go to [Genius API](https://genius.com/api-clients)
2. Create a new API client
3. Note down your Client ID, Client Secret, and Access Token

### 3. Environment Configuration

Create a `.env` file in the root directory and add your credentials:

```bash
# Spotify API
SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret_here"
SPOTIFY_REDIRECT_URI="http://localhost:8888/callback/"

# Genius API
GENIUS_APP_URL="http://localhost:8888"
GENIUS_CLIENT_ID="your_genius_client_id_here"
GENIUS_CLIENT_SECRET="your_genius_client_secret_here"
GENIUS_CLIENT_ACCESS_TOKEN="your_genius_access_token_here"

# Admin access (optional)
ADMIN_KEY="your_secret_admin_key_for_cache_management"
```

You can use `.env.example` as a template.

## Running the Application

Start the server:

```bash
npm run start-server
```

Then open your browser and navigate to:

```
http://localhost:8888
```

## Persistent Caching System

The application now includes a persistent caching system using SQLite and Sequelize, which:

- Stores song search results and lyrics in a local database
- Persists data across server restarts
- Reduces API calls to Genius
- Improves performance for repeated searches

### Database Details

- The cache is stored in `lyrics_cache.sqlite` in the root directory
- Cache entries include:
  - Song metadata (artist, title)
  - Song ID from Genius
  - Lyrics content
  - Timestamp for TTL management

### Cache Management

Cached entries automatically expire after 24 hours, but admin endpoints are available for manual management:

```
DELETE /api/admin/cache?adminKey=your_admin_key
```

Clears all cached entries from the database.

```
GET /api/admin/cache-stats?adminKey=your_admin_key
```

Returns statistics about the cache usage.

## API Endpoints

### Authentication

- `GET /login` - Initiate Spotify OAuth flow
- `GET /callback` - Handle Spotify OAuth callback
- `GET /refresh_token` - Refresh Spotify access token

### Lyrics

- `GET /api/lyrics/search?artist={artist}&song={song}` - Search for song on Genius
- `GET /api/lyrics/{songId}` - Fetch lyrics for a specific song

### Cache Management

- `DELETE /api/admin/cache?adminKey={adminKey}` - Clear the lyrics cache
- `GET /api/admin/cache-stats?adminKey={adminKey}` - Get cache usage statistics

### Proxy

- `ALL /proxy/*` - Proxy requests with rotating headers

## Project Structure

```
├── server.js          # Main server file
├── src/               # Frontend files
├── lyrics_cache.sqlite # SQLite database for lyrics cache
├── .env               # Environment variables (create this)
├── .env.example       # Environment template
└── package.json       # Dependencies
```

## Dependencies

- **express** - Web framework
- **cors** - Cross-origin resource sharing
- **cookie-parser** - Cookie parsing middleware
- **needle** - HTTP client
- **got-scraping** - Web scraping with rotating headers
- **dotenv** - Environment variable management
- **sequelize** - ORM for database operations
- **sqlite3** - SQLite database driver
- **he** - HTML entity decoder

## Troubleshooting

### Common Issues

1. **"Missing Spotify credentials"** - Make sure your `.env` file contains all required Spotify variables
2. **"Failed to authenticate with Genius API"** - Verify your Genius API credentials in `.env`
3. **"Database synchronization error"** - Check file permissions for the SQLite database

### Debug Mode

The server logs detailed information to the console, including:

- Lyrics search results
- Preview of extracted lyrics
- API response status codes
- Database operations
- Error details

## Security Notes

- Never commit your `.env` file to version control
- Keep your API credentials secure
- The `.env.example` file shows the required format without exposing real credentials
- Protect your ADMIN_KEY as it provides access to cache management endpoints

## Contributing

This project is currently in development. Feel free to contribute by:

- Reporting bugs
- Suggesting features
- Submitting pull requests

## License

CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)
