const express = require('express')
const cors = require('cors')
const { stringify } = require('querystring')
const cookieParser = require('cookie-parser')
const needle = require('needle')
const { gotScraping } = require('got-scraping')
const he = require('he')

// Environment variables are automatically loaded in Vercel
const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const redirectUri = process.env.SPOTIFY_REDIRECT_URI

// Validate environment variables
console.log('Environment check:', {
  hasClientId: !!clientId,
  hasClientSecret: !!clientSecret,
  hasRedirectUri: !!redirectUri,
  redirectUri: redirectUri
})

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing required environment variables')
}

const app = express()

// Enhanced CORS for production
app.use(cors({
  origin: [
    'https://simwai.github.io',
    'http://localhost:3000',
    'http://localhost:8888',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())
app.use(cookieParser())

const stateKey = 'spotify_auth_state'
let uid
let refresh_token

function generateRandomString (length) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Spotify Playlist Filter API - Backend',
    timestamp: new Date().toISOString(),
    endpoints: {
      login: '/login',
      callback: '/callback', 
      refresh: '/refresh_token',
      lyricsSearch: '/api/lyrics/search?artist=<artist>&song=<song>',
      lyricsGet: '/api/lyrics/<songId>'
    },
    environment: {
      hasSpotifyCredentials: !!(clientId && clientSecret),
      redirectUri: redirectUri
    }
  })
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  })
})

// Proxy route (keep if needed for lyrics scraping)
app.all('/proxy/*', async (req, res) => {
  const url = req.url.substring(7).replace('https', 'http')

  try {
    const response = await gotScraping({
      method: req.method,
      url: url,
      followRedirect: true,
      maxRedirects: 20,
      responseType: 'json',
      headerGeneratorOptions: {
        browsers: [
          {
            name: 'chrome',
            minVersion: 87,
            maxVersion: 89
          }
        ],
        devices: ['desktop'],
        locales: ['de-DE', 'en-US'],
        operatingSystems: ['windows', 'linux']
      }
    })

    res.set('access-control-allow-origin', '*')
    res.set('access-control-allow-headers', '*')
    res.set('access-control-allow-methods', '*')

    res.status(response.statusCode).send(response.body)
  } catch (error) {
    console.log('Internal Server Error: Proxy Failed\n', error)
    res.status(500).send('Internal Server Error: Proxy Failed')
  }
})

// Spotify Auth Routes
app.get('/login', (req, res) => {
  console.log('🔐 Login endpoint accessed')
  
  if (!clientId) {
    return res.status(500).json({ error: 'Missing Spotify Client ID' })
  }

  const state = generateRandomString(16)
  res.cookie(stateKey, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  })

  const scope = 'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
  
  const authURL = `https://accounts.spotify.com/authorize?${stringify({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state
  })}`
  
  console.log('🚀 Redirecting to Spotify:', authURL)
  res.redirect(authURL)
})

app.get('/callback', (req, res) => {
  console.log('🔄 Callback received:', { 
    hasCode: !!req.query.code, 
    hasState: !!req.query.state,
    error: req.query.error 
  })

  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[stateKey] : null
  const error = req.query.error

  const frontendUrl = 'https://simwai.github.io/spotify-playlist-keyword-filter'

  if (error) {
    console.log('❌ Authorization error:', error)
    return res.redirect(`${frontendUrl}/#error=${error}`)
  }

  if (state === null || state !== storedState) {
    console.log('❌ State mismatch:', { state, storedState })
    return res.redirect(`${frontendUrl}/#error=state_mismatch`)
  }

  res.clearCookie(stateKey)
  
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    json: true
  }

  console.log('🎫 Exchanging code for token...')
  needle.post(authOptions.url, authOptions.form, { headers: authOptions.headers }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token
      refresh_token = body.refresh_token

      console.log('✅ Token received, fetching user profile...')
      
      const options = {
        url: 'https://api.spotify.com/v1/me',
        headers: { Authorization: `Bearer ${access_token}` },
        json: true
      }

      needle.get(options.url, { headers: options.headers }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          uid = body.id
          console.log('✅ User authenticated:', uid)

          const redirectUrl = `${frontendUrl}/#${stringify({
            access_token,
            refresh_token,
            uid
          })}`
          
          console.log('🎉 Redirecting to frontend with tokens')
          res.redirect(redirectUrl)
        } else {
          console.error('❌ Failed to fetch user data:', error)
          res.redirect(`${frontendUrl}/#error=user_fetch_failed`)
        }
      })
    } else {
      console.error('❌ Token exchange failed:', error, body)
      res.redirect(`${frontendUrl}/#error=token_exchange_failed`)
    }
  })
})

app.get('/refresh_token', (req, res) => {
  console.log('🔄 Refresh token requested')
  
  if (!refresh_token) {
    return res.redirect('https://simwai.github.io/spotify-playlist-keyword-filter/#error=no_refresh_token')
  }

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  needle.post(authOptions.url, authOptions.form, { headers: authOptions.headers }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token
      console.log('✅ Token refreshed successfully')
      
      const frontendUrl = 'https://simwai.github.io/spotify-playlist-keyword-filter'
      res.redirect(`${frontendUrl}/#${stringify({
        access_token,
        refresh_token,
        uid
      })}`)
    } else {
      console.error('❌ Token refresh failed:', error)
      res.redirect('https://simwai.github.io/spotify-playlist-keyword-filter/#error=refresh_failed')
    }
  })
})

// Genius token management
let cachedGeniusToken = null
let tokenExpiry = null

async function getGeniusToken () {
  if (cachedGeniusToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedGeniusToken
  }

  console.log('Getting new Genius access token...')

  const authUrl = 'https://api.genius.com/oauth/token'
  const authHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${process.env.GENIUS_CLIENT_ID}:${process.env.GENIUS_CLIENT_SECRET}`).toString('base64')}`
  }

  const authData = 'grant_type=client_credentials'
  const authResponse = await needle('post', authUrl, authData, { headers: authHeaders })

  if (authResponse.statusCode !== 200) {
    throw new Error('Failed to get Genius access token')
  }

  cachedGeniusToken = authResponse.body.access_token
  tokenExpiry = Date.now() + (50 * 60 * 1000)

  return cachedGeniusToken
}

// Lyrics caching
const lyricsCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000

function getCacheKey (artist, song) {
  return `${artist.toLowerCase()}-${song.toLowerCase()}`.replace(/[^a-z0-9-]/g, '')
}

// Lyrics API endpoints
app.get('/api/lyrics/search', async (req, res) => {
  const { artist, song } = req.query

  if (!artist || !song) {
    return res.status(400).json({ error: 'Artist and song are required' })
  }

  const cacheKey = getCacheKey(artist, song)
  const cached = lyricsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(' Cache hit for:', artist, '-', song)
    return res.json(cached.data)
  }

  try {
    const accessToken = await getGeniusToken()

    console.log('Searching for:', { artist, song })
    const searchQueries = [
      `${song} ${artist}`,
      `${song.replace(/\s*\([^)]*\)/g, '')} ${artist}`,
      `${artist} ${song}`,
      song
    ]

    let found = false
    for (const searchQuery of searchQueries) {
      if (found) break
      
      const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`
      const searchHeaders = { Authorization: `Bearer ${accessToken}` }

      console.log('Search URL:', searchUrl)
      const searchResponse = await needle('get', searchUrl, { headers: searchHeaders })

      console.log('Search response status:', searchResponse.statusCode)

      if (searchResponse.statusCode === 200 && searchResponse.body?.response?.hits?.length > 0) {
        const songId = searchResponse.body.response.hits[0].result.id
        const songTitle = searchResponse.body.response.hits[0].result.title
        const songArtist = searchResponse.body.response.hits[0].result.primary_artist.name

        console.log('Found song:', { songId, songTitle, songArtist })
        
        const result = { songId, found: true, title: songTitle, artist: songArtist }
        
        // Cache the result
        lyricsCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
        
        res.json(result)
        found = true
      }
    }

    if (!found) {
      console.log('No results found')
      const result = { found: false }
      
      // Cache negative results too (shorter TTL)
      lyricsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })
      
      res.json(result)
    }
  } catch (error) {
    console.error('Genius search error:', error)
    res.status(500).json({ error: 'Failed to search for song', details: error.message })
  }
})

app.get('/api/lyrics/:songId', async (req, res) => {
  const { songId } = req.params

  try {
    console.log('Fetching lyrics for song ID:', songId)

    const accessToken = await getGeniusToken()

    const songUrl = `https://api.genius.com/songs/${songId}`
    const songHeaders = { Authorization: `Bearer ${accessToken}` }

    const songResponse = await needle('get', songUrl, { headers: songHeaders })

    if (songResponse.statusCode !== 200) {
      return res.status(404).json({ error: 'Song not found' })
    }

    const songInfo = songResponse.body.response.song
    const geniusPageUrl = songInfo.url
    console.log('Genius page URL:', geniusPageUrl)

    const lyricsResponse = await needle('get', geniusPageUrl)
    const lyrics = extractLyricsFromHTML(lyricsResponse.body)

    if (lyrics) {
      console.log('✅ Lyrics extracted successfully')
      console.log('📄 Lyrics length:', lyrics.length, 'characters')

      res.json({ lyrics })
    } else {
      console.log('❌ No lyrics found in page')
      res.status(404).json({ error: 'Lyrics not found' })
    }
  } catch (error) {
    console.error('💥 Lyrics fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch lyrics' })
  }
})

function extractLyricsFromHTML (html) {
  try {
    console.log('🔍 Extracting lyrics using data-lyrics-container...')

    // Look for the data-lyrics-container div and extract its content
    const regex = /<div[^>]*data-lyrics-container="true"[^>]*>(.*?)<\/div>/gs
    const matches = html.match(regex)

    if (matches && matches.length > 0) {
      console.log(`✅ Found ${matches.length} lyrics containers`)

      let allLyrics = ''

      matches.forEach((match, index) => {
        console.log(`Processing container ${index + 1}...`)

        // Extract the inner content
        const contentMatch = match.match(/<div[^>]*data-lyrics-container="true"[^>]*>(.*)<\/div>/s)
        if (contentMatch && contentMatch[1]) {
          let lyrics = contentMatch[1]
            .replace(/<p>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<i>/gi, '')
            .replace(/<\/i>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim()

          // 🎯 HERE'S WHERE WE USE HE! - One line replaces ALL HTML entities:
          lyrics = he.decode(lyrics)

          if (lyrics.length > 20) {
            allLyrics += lyrics + '\n\n'
          }
        }
      })

      if (allLyrics.trim().length > 50) {
        console.log('✅ Successfully extracted lyrics!')
        console.log('📄 Lyrics preview:', allLyrics.substring(0, 200) + '...')
        return allLyrics.trim()
      }
    }

    console.log('❌ No lyrics found with data-lyrics-container')
    return null
  } catch (error) {
    console.error('💥 Error extracting lyrics:', error)
    return null
  }
}

// For Vercel, we need to export the app instead of listening
module.exports = app

// Only listen when running locally
if (require.main === module) {
  const port = process.env.PORT || 8888
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`)
  })
}
