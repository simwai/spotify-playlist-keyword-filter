const express = require('express')
const cors = require('cors')
const path = require('path')
const { stringify } = require('querystring')
const cookieParser = require('cookie-parser')
const { inspect } = require('util')
const needle = require('needle')
const { gotScraping } = require('got-scraping')
const he = require('he')

// Load environment variables first
require('dotenv').config()

// Get Spotify credentials from environment variables
const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const redirectUri = process.env.SPOTIFY_REDIRECT_URI

// Validate that Spotify credentials are available
if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing Spotify credentials in environment variables')
  throw new Error('Missing Spotify credentials in environment variables')
}

const app = express()
app.use(express.static(path.join(__dirname, 'src')))
app.use(cors())
app.use(cookieParser())

const stateKey = 'spotify_auth_state'
let uid
let refresh_token

function generateRandomString(length) {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}

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
            maxVersion: 89,
          },
        ],
        devices: ['desktop'],
        locales: ['de-DE', 'en-US'],
        operatingSystems: ['windows', 'linux'],
      },
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

// Rest of the file remains the same...
app.get('/login', (req, res) => {
  const state = generateRandomString(16)
  res.cookie(stateKey, state)

  const scope =
    'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
  res.redirect(
    `https://accounts.spotify.com/authorize?${stringify({
      response_type: 'code',
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
      state,
    })}`
  )
})

app.get('/callback', (req, res) => {
  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[stateKey] : null
  const error = req.query.error

  if (!error) {
    if (state === null || state !== storedState) {
      res.status(400).send('Invalid state parameter')
    } else {
      res.clearCookie(stateKey)
      const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString('base64')}`,
        },
        json: true,
      }

      needle.post(
        authOptions.url,
        authOptions.form,
        { headers: authOptions.headers },
        (error, response, body) => {
          if (!error && response.statusCode === 200) {
            const access_token = body.access_token
            refresh_token = body.refresh_token

            const options = {
              url: 'https://api.spotify.com/v1/me',
              headers: { Authorization: `Bearer ${access_token}` },
              json: true,
            }

            needle.get(
              options.url,
              { headers: options.headers },
              (error, response, body) => {
                if (!error && response.statusCode === 200) {
                  console.log(`body: ${inspect(body, false, null, true)}`)
                  uid = body.id
                  console.log(body.id)

                  if (uid == null) {
                    res.status(400).send('Invalid user ID')
                  } else {
                    res.redirect(
                      `/#${stringify({
                        access_token,
                        refresh_token,
                        uid,
                      })}`
                    )
                  }
                } else {
                  res
                    .status(500)
                    .send('Internal Server Error: Failed to fetch user data')
                  console.error('Failed to fetch user data\n', error)
                }
              }
            )
          } else {
            res.status(400).send('Invalid token')
            console.error('Invalid token\n', error)
          }
        }
      )
    }
  } else {
    res.status(400).send('Authorization error')
  }
})

app.get('/refresh_token', (req, res) => {
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64')}`,
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    },
    json: true,
  }

  needle.post(
    authOptions.url,
    authOptions.form,
    { headers: authOptions.headers },
    (error, response, body) => {
      if (!error && response.statusCode === 200) {
        console.log('Request triggered')
        const access_token = body.access_token

        res.redirect(
          `/#${stringify({
            access_token,
            refresh_token,
            uid,
          })}`
        )
      } else {
        res.status(500).send('Internal Server Error: Failed to refresh token')
        console.error('Failed to refresh token\n', error)
      }
    }
  )
})

let cachedGeniusToken = null
let tokenExpiry = null

async function getGeniusToken() {
  // Return cached token if still valid (tokens typically last 1 hour)
  if (cachedGeniusToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedGeniusToken
  }

  console.log('Getting new Genius access token...')

  const authUrl = 'https://api.genius.com/oauth/token'
  const authHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${process.env.GENIUS_CLIENT_ID}:${process.env.GENIUS_CLIENT_SECRET}`).toString('base64')}`,
  }

  const authData = 'grant_type=client_credentials'
  const authResponse = await needle('post', authUrl, authData, {
    headers: authHeaders,
  })

  if (authResponse.statusCode !== 200) {
    throw new Error('Failed to get Genius access token')
  }

  cachedGeniusToken = authResponse.body.access_token
  // Cache for 50 minutes (tokens usually last 1 hour)
  tokenExpiry = Date.now() + 50 * 60 * 1000

  return cachedGeniusToken
}

const lyricsCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getCacheKey(artist, song) {
  return `${artist.toLowerCase()}-${song.toLowerCase()}`.replace(
    /[^a-z0-9-]/g,
    ''
  )
}

app.get('/api/lyrics/search', async (req, res) => {
  const { artist, song } = req.query

  if (!artist || !song) {
    return res.status(400).json({ error: 'Artist and song are required' })
  }

  // Check cache first
  const cacheKey = getCacheKey(artist, song)
  const cached = lyricsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📋 Cache hit for:', artist, '-', song)
    return res.json(cached.data)
  }

  try {
    const accessToken = await getGeniusToken()

    // Try multiple search variations
    console.log('Searching for:', { artist, song })
    const searchQueries = [
      `${song} ${artist}`, // Original
      `${song.replace(/\s*\([^)]*\)/g, '')} ${artist}`, // Remove parentheses
      `${artist} ${song}`, // Swap order
      song, // Just song title
    ]

    let found = false
    for (const searchQuery of searchQueries) {
      if (found) {
        break
      }
      const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`
      const searchHeaders = {
        Authorization: `Bearer ${accessToken}`,
      }

      console.log('Search URL:', searchUrl)
      const searchResponse = await needle('get', searchUrl, {
        headers: searchHeaders,
      })

      console.log('Search response status:', searchResponse.statusCode)
      console.log(
        'Search response body:',
        JSON.stringify(searchResponse.body, null, 2)
      )

      if (
        searchResponse.statusCode === 200 &&
        searchResponse.body?.response?.hits?.length > 0
      ) {
        const songId = searchResponse.body.response.hits[0].result.id
        const songTitle = searchResponse.body.response.hits[0].result.title
        const songArtist =
          searchResponse.body.response.hits[0].result.primary_artist.name

        console.log('Found song:', { songId, songTitle, songArtist })
        res.json({ songId, found: true, title: songTitle, artist: songArtist })
        found = true
      }
    }

    if (!found) {
      console.log('No results found')
      res.json({ found: false })
    }
  } catch (error) {
    console.error('Genius search error:', error)
    res
      .status(500)
      .json({ error: 'Failed to search for song', details: error.message })
  }
})

app.get('/api/lyrics/:songId', async (req, res) => {
  const { songId } = req.params

  try {
    console.log('Fetching lyrics for song ID:', songId)

    const accessToken = await getGeniusToken()

    // Get song details to get the lyrics URL
    const songUrl = `https://api.genius.com/songs/${songId}`
    const songHeaders = {
      Authorization: `Bearer ${accessToken}`,
    }

    const songResponse = await needle('get', songUrl, { headers: songHeaders })

    if (songResponse.statusCode !== 200) {
      return res.status(404).json({ error: 'Song not found' })
    }

    const songInfo = songResponse.body.response.song
    const geniusPageUrl = songInfo.url
    console.log('Genius page URL:', geniusPageUrl)
    console.log('Song info:', {
      title: songInfo.title,
      artist: songInfo.primary_artist.name,
    })

    // Scrape lyrics from the Genius page
    const lyricsResponse = await needle('get', geniusPageUrl)
    const lyrics = extractLyricsFromHTML(lyricsResponse.body)

    if (lyrics) {
      console.log('✅ Lyrics extracted successfully')
      console.log('📄 Lyrics length:', lyrics.length, 'characters')

      // Show a preview of the lyrics (first 200 characters)
      const lyricsPreview = lyrics.substring(0, 200).replace(/\n/g, ' ').trim()
      console.log(
        '🎵 Lyrics preview:',
        lyricsPreview + (lyrics.length > 200 ? '...' : '')
      )

      // Show first few lines for better validation
      const firstLines = lyrics.split('\n').slice(0, 4).join('\n')
      console.log('📝 First few lines:\n' + firstLines)
      console.log('─'.repeat(50))

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

function extractLyricsFromHTML(html) {
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
        const contentMatch = match.match(
          /<div[^>]*data-lyrics-container="true"[^>]*>(.*)<\/div>/s
        )
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

          // One line replaces ALL entities:
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

console.log('Listening on 8888')
app.listen(8888)
