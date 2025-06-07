const { configDotenv } = require('dotenv')
const { validateConfig } = require('./validation.js')

configDotenv()
validateConfig()

const config = {
  app: {
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
  cors: {
    origins: [process.env.CORS_ORIGINS, 'http://localhost:8888'],
  },
  cache: {
    ttl: 24 * 60 * 60 * 1000,
  },
}

module.exports = config
