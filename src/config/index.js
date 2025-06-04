const { configDotenv } = require('dotenv')
const { validateConfig } = require('./validation.js')

configDotenv()
validateConfig()

const config = {
  server: {
    port: process.env.PORT || 8888,
    isProduction: process.env.NODE_ENV === 'production',
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  },
  genius: {
    clientId: process.env.GENIUS_CLIENT_ID,
    clientSecret: process.env.GENIUS_CLIENT_SECRET,
  },
  admin: {
    key: process.env.ADMIN_KEY,
  },
  cors: {
    origins: [
      'https://simwai.github.io',
      'http://localhost:3000',
      'http://localhost:8888',
      /\.vercel\.app$/,
    ],
  },
  cache: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
}

module.exports = config
