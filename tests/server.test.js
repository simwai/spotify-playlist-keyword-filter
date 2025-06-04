const request = require('supertest')
const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')

jest.mock('needle')
jest.mock('got-scraping')

process.env.GENIUS_APP_URL = 'http://localhost:8888'
process.env.GENIUS_CLIENT_ID = 'test_genius_client_id'
process.env.GENIUS_CLIENT_SECRET = 'test_genius_client_secret'
process.env.GENIUS_CLIENT_ACCESS_TOKEN = 'test_genius_access_token'
process.env.SPOTIFY_CLIENT_ID = 'test_client_id'
process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret'
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:8888/callback'

const needle = require('needle')
const { gotScraping } = require('got-scraping')

const clientId = process.env.SPOTIFY_CLIENT_ID
const redirectUri = process.env.SPOTIFY_REDIRECT_URI
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

const setupApp = () => {
  const app = express()
  app.use(express.static(path.join(__dirname, '../src')))
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
          browsers: [{ name: 'chrome', minVersion: 87, maxVersion: 89 }],
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

  app.get('/login', (req, res) => {
    const state = generateRandomString(16)
    res.cookie(stateKey, state)

    const scope =
      'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
    const queryParams = [
      'response_type=code',
      `client_id=${clientId}`,
      `scope=${encodeURIComponent(scope)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `state=${state}`,
    ].join('&')

    res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`)
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
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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
                    uid = body.id
                    if (uid == null) {
                      res.status(400).send('Invalid user ID')
                    } else {
                      const { stringify } = require('querystring')
                      res.redirect(
                        `/#${stringify({ access_token, refresh_token, uid })}`
                      )
                    }
                  } else {
                    res
                      .status(500)
                      .send('Internal Server Error: Failed to fetch user data')
                  }
                }
              )
            } else {
              res.status(400).send('Invalid token')
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
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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
          const access_token = body.access_token
          const { stringify } = require('querystring')
          res.redirect(`/#${stringify({ access_token, refresh_token, uid })}`)
        } else {
          res.status(500).send('Internal Server Error: Failed to refresh token')
        }
      }
    )
  })

  return app
}

describe('Server Tests', () => {
  let app

  beforeEach(() => {
    app = setupApp()
    jest.clearAllMocks()
    console.log = jest.fn()
  })

  describe('Authentication Flow', () => {
    describe('GET /login', () => {
      test('should redirect to Spotify auth with correct parameters', async () => {
        const response = await request(app).get('/login')

        expect(response.status).toBe(302)
        expect(response.headers.location).toMatch(
          /^https:\/\/accounts\.spotify\.com\/authorize/
        )
        expect(response.headers.location).toContain('client_id=test_client_id')
        expect(response.headers.location).toContain(
          'redirect_uri=http%3A%2F%2Flocalhost%3A8888%2Fcallback'
        )
        expect(response.headers.location).toContain('response_type=code')
        expect(response.headers.location).toContain(
          'scope=playlist-read-private'
        )
        expect(response.headers.location).toContain('state=')
      })

      test('should set state cookie', async () => {
        const response = await request(app).get('/login')

        expect(response.headers['set-cookie']).toBeDefined()
        expect(response.headers['set-cookie'][0]).toMatch(/spotify_auth_state=/)
      })
    })

    describe('GET /callback', () => {
      test('should handle authorization error', async () => {
        const response = await request(app)
          .get('/callback')
          .query({ error: 'access_denied' })

        expect(response.status).toBe(400)
        expect(response.text).toBe('Authorization error')
      })

      test('should validate state parameter', async () => {
        const response = await request(app).get('/callback').query({
          code: 'test_code',
          state: 'invalid_state',
        })

        expect(response.status).toBe(400)
        expect(response.text).toBe('Invalid state parameter')
      })

      test('should handle successful auth callback with valid state', async () => {
        const loginResponse = await request(app).get('/login')
        const stateCookie = loginResponse.headers['set-cookie'][0]
        const stateValue = stateCookie.match(/spotify_auth_state=([^;]+)/)[1]

        needle.post.mockImplementationOnce((url, form, options, callback) => {
          callback(
            null,
            { statusCode: 200 },
            {
              access_token: 'test_access_token',
              refresh_token: 'test_refresh_token',
            }
          )
        })

        needle.get.mockImplementationOnce((url, options, callback) => {
          callback(
            null,
            { statusCode: 200 },
            {
              id: 'test_user_id',
            }
          )
        })

        const response = await request(app)
          .get('/callback')
          .set('Cookie', stateCookie)
          .query({
            code: 'test_code',
            state: stateValue,
          })

        expect(response.status).toBe(302)
        expect(response.headers.location).toMatch(
          /^\/#access_token=test_access_token/
        )
        expect(response.headers.location).toContain(
          'refresh_token=test_refresh_token'
        )
        expect(response.headers.location).toContain('uid=test_user_id')
      })

      test('should handle token exchange failure', async () => {
        const loginResponse = await request(app).get('/login')
        const stateCookie = loginResponse.headers['set-cookie'][0]
        const stateValue = stateCookie.match(/spotify_auth_state=([^;]+)/)[1]

        needle.post.mockImplementationOnce((url, form, options, callback) => {
          callback(new Error('Token exchange failed'), null, null)
        })

        const response = await request(app)
          .get('/callback')
          .set('Cookie', stateCookie)
          .query({
            code: 'test_code',
            state: stateValue,
          })

        expect(response.status).toBe(400)
        expect(response.text).toBe('Invalid token')
      })
    })

    describe('GET /refresh_token', () => {
      test('should refresh access token successfully', async () => {
        needle.post.mockImplementationOnce((url, form, options, callback) => {
          callback(
            null,
            { statusCode: 200 },
            {
              access_token: 'new_access_token',
            }
          )
        })

        const response = await request(app).get('/refresh_token')

        expect(response.status).toBe(302)
        expect(response.headers.location).toContain(
          'access_token=new_access_token'
        )
      })

      test('should handle refresh token failure', async () => {
        needle.post.mockImplementationOnce((url, form, options, callback) => {
          callback(new Error('Refresh failed'), null, null)
        })

        const response = await request(app).get('/refresh_token')

        expect(response.status).toBe(500)
        expect(response.text).toBe(
          'Internal Server Error: Failed to refresh token'
        )
      })
    })
  })

  describe('Proxy Functionality', () => {
    test('should proxy GET requests successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        body: { data: 'test' },
      }

      gotScraping.mockResolvedValueOnce(mockResponse)

      const response = await request(app).get(
        '/proxy/http://example.com/api/test'
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ data: 'test' })
      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-headers']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toBe('*')
    })

    test('should handle proxy errors gracefully', async () => {
      gotScraping.mockRejectedValueOnce(new Error('Network error'))

      const response = await request(app).get(
        '/proxy/http://example.com/api/test'
      )

      expect(response.status).toBe(500)
      expect(response.text).toBe('Internal Server Error: Proxy Failed')
    })
  })
})
