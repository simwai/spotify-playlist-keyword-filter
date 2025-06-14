const Validator = require('fastest-validator')

const v = new Validator()

const schema = {
  PORT: { type: 'number', integer: true, min: 1, max: 65535, optional: false },
  FRONTEND_URL: { type: 'string', empty: false, optional: false },
  GENIUS_APP_URL: { type: 'string', empty: false, optional: false },
  GENIUS_CLIENT_ID: { type: 'string', empty: false, optional: false },
  GENIUS_CLIENT_SECRET: { type: 'string', empty: false, optional: false },
  GENIUS_CLIENT_ACCESS_TOKEN: { type: 'string', empty: false, optional: false },
  SPOTIFY_CLIENT_ID: { type: 'string', empty: false, optional: false },
  SPOTIFY_CLIENT_SECRET: { type: 'string', empty: false, optional: false },
  SPOTIFY_REDIRECT_URI: { type: 'string', empty: false, optional: false },
  CORS_ORIGIN: { type: 'string', empty: false, optional: false },
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'production', 'test'],
    optional: false,
  },
}

function validateConfig() {
  const env = {
    PORT: Number(process.env.PORT),
    FRONTEND_URL: process.env.FRONTEND_URL,
    GENIUS_APP_URL: process.env.GENIUS_APP_URL,
    GENIUS_CLIENT_ID: process.env.GENIUS_CLIENT_ID,
    GENIUS_CLIENT_SECRET: process.env.GENIUS_CLIENT_SECRET,
    GENIUS_CLIENT_ACCESS_TOKEN: process.env.GENIUS_CLIENT_ACCESS_TOKEN,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
  }

  const check = v.compile(schema)
  const result = check(env)

  if (result !== true) {
    const errors = result.map((e) => `${e.field}: ${e.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${errors}`)
  }
}

module.exports = { validateConfig }
