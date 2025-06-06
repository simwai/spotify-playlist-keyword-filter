const { configDotenv } = require('dotenv')
const { validateConfig } = require('./validation.js')

configDotenv()
validateConfig()

const config = {
  app: {
    port: process.env.PORT || 8888,
    redirectUrl: process.env.APP_REDIRECT_URL || 'http://localhost:8888',
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
  cors: {
    origins: [
      'https://simwai.github.io',
      'http://localhost:3000',
      'http://localhost:8888',
      /\.vercel\.app$/,
    ],
  },
  cache: {
    ttl: 24 * 60 * 60 * 1000,
  },
}

module.exports = config
