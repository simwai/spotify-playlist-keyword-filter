const request = require('supertest')
const express = require('express')

jest.mock('needle')
const needle = require('needle')

describe('Lyrics Functionality', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())

    app.get('/api/lyrics/search', async (req, res) => {
      const { artist, song } = req.query

      if (!artist || !song) {
        return res.status(400).json({ error: 'Artist and song are required' })
      }

      try {
        const searchUrl = 'https://api.genius.com/search'
        const response = await needle('get', searchUrl, {
          access_token: process.env.GENIUS_ACCESS_TOKEN || 'test_token',
          q: `${song} ${artist}`,
        })

        if (response.body && response.body.response.hits.length > 0) {
          const songId = response.body.response.hits[0].result.id
          res.json({ songId, found: true })
        } else {
          res.json({ found: false })
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to search for song' })
      }
    })

    app.get('/api/lyrics/:songId', async (req, res) => {
      const { songId } = req.params

      try {
        const lyricsUrl = `https://genius.com/songs/${songId}`
        const response = await needle('get', lyricsUrl)

        const lyrics = extractLyricsFromHTML(response.body)

        if (lyrics) {
          res.json({ lyrics })
        } else {
          res.status(404).json({ error: 'Lyrics not found' })
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lyrics' })
      }
    })

    jest.clearAllMocks()
  })

  describe('Lyrics Search', () => {
    test('should search for song successfully', async () => {
      needle.mockResolvedValueOnce({
        body: {
          response: {
            hits: [
              {
                result: {
                  id: 123456,
                  title: 'Test Song',
                  primary_artist: { name: 'Test Artist' },
                },
              },
            ],
          },
        },
      })

      const response = await request(app)
        .get('/api/lyrics/search')
        .query({ artist: 'Test Artist', song: 'Test Song' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        songId: 123456,
        found: true,
      })
    })

    test('should handle no results found', async () => {
      needle.mockResolvedValueOnce({
        body: {
          response: {
            hits: [],
          },
        },
      })

      const response = await request(app)
        .get('/api/lyrics/search')
        .query({ artist: 'Unknown Artist', song: 'Unknown Song' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ found: false })
    })

    test('should require artist and song parameters', async () => {
      const response = await request(app)
        .get('/api/lyrics/search')
        .query({ artist: 'Test Artist' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Artist and song are required')
    })

    test('should handle API errors gracefully', async () => {
      needle.mockRejectedValueOnce(new Error('API Error'))

      const response = await request(app)
        .get('/api/lyrics/search')
        .query({ artist: 'Test Artist', song: 'Test Song' })

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to search for song')
    })
  })

  describe('Lyrics Fetching', () => {
    test('should fetch lyrics by song ID', async () => {
      const mockHTML = `
        <html>
          <body>
            <div class="lyrics">Test lyrics content</div>
          </body>
        </html>
      `

      needle.mockResolvedValueOnce({
        body: mockHTML,
      })

      const response = await request(app).get('/api/lyrics/123456')

      expect(response.status).toBe(200)
      expect(response.body.lyrics).toBe('Test lyrics content')
    })

    test('should handle missing lyrics', async () => {
      needle.mockResolvedValueOnce({
        body: '<html><body><div>No lyrics found</div></body></html>',
      })

      const response = await request(app).get('/api/lyrics/123456')

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Lyrics not found')
    })

    test('should handle fetch errors', async () => {
      needle.mockRejectedValueOnce(new Error('Network error'))

      const response = await request(app).get('/api/lyrics/123456')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to fetch lyrics')
    })
  })
})

function extractLyricsFromHTML(html) {
  if (html.includes('class="lyrics"')) {
    const match = html.match(/<div class="lyrics">(.*?)<\/div>/)
    return match ? match[1] : null
  }
  return null
}
