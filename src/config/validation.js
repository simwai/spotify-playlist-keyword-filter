function validateConfig() {
  const required = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REDIRECT_URI',
    'GENIUS_CLIENT_ID',
    'GENIUS_CLIENT_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error(
      '❌ Missing required environment variables:',
      missing.join(', ')
    )
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }
}

module.exports = { validateConfig }
