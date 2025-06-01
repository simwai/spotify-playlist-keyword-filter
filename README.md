# Spotify Playlist Keyword Filter

Money, Bitch, Smoking etc. All these words are in most of the current songs. If you want to have a clean playlist with none of such words, start using Spotify Playlist Keyword Filter. Maybe you have an addiction or little respect for women then listening to selected music can be benefiting.

Currently, the app is still in work.

## Features

- Connect to your Spotify account
- Fetch playlists and track information
- Search and retrieve song lyrics from Genius
- Filter songs based on keyword content
- Clean playlist management

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
```

You can use `.env.example` as a template.

## Running the Application

Start the server:

```bash
npm run start
```

Then open your browser and navigate to:

```
http://localhost:8888
```

## API Endpoints

### Authentication

- `GET /login` - Initiate Spotify OAuth flow
- `GET /callback` - Handle Spotify OAuth callback
- `GET /refresh_token` - Refresh Spotify access token

### Lyrics

- `GET /api/lyrics/search?artist={artist}&song={song}` - Search for song on Genius
- `GET /api/lyrics/{songId}` - Fetch lyrics for a specific song

### Proxy

- `ALL /proxy/*` - Proxy requests with rotating headers (Unused, dead path)

## Project Structure

```
├── server.js          # Main server file
├── src/               # Frontend files
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

## Troubleshooting

### Common Issues

1. **"Missing Spotify credentials"** - Make sure your `.env` file contains all required Spotify variables
2. **"Failed to authenticate with Genius API"** - Verify your Genius API credentials in `.env`

### Debug Mode

The server logs detailed information to the console, including:

- Lyrics search results
- Preview of extracted lyrics
- API response status codes
- Error details

## Security Notes

- Never commit your `.env` file to version control
- Keep your API credentials secure
- The `.env.example` file shows the required format without exposing real credentials

## Contributing

This project is currently in development. Feel free to contribute by:

- Reporting bugs
- Suggesting features
- Submitting pull requests

## License

CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)