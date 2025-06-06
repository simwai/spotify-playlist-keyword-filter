const { stringify } = require('querystring')
const needle = require('needle')
const config = require('../config/index.js')
const { generateRandomString } = require('../utils/crypto.js')

class SpotifyAuthService {
  constructor() {
    this.stateKey = 'spotify_auth_state'
    this.refreshToken = null
    this.uid = null
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  _debugLog(...args) {
    if (this.isDevelopment) {
      console.log(...args)
    }
  }

  async getAuthUrl(res) {
    const state = generateRandomString(16)
    this._debugLog('🔐 Generated state:', state)

    res.cookie(this.stateKey, state, {
      httpOnly: true,
      secure: config.app.isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    })

    this._debugLog(
      '🍪 Set cookie with key:',
      this.stateKey,
      'and value:',
      state
    )

    const scope =
      'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
    const redirectUri = config.spotify.redirectUri

    const authUrl = `https://accounts.spotify.com/authorize?${stringify({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope,
      redirect_uri: redirectUri,
      state,
    })}`
    this._debugLog('Auth URL generated successfully')
    return authUrl
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query
    const storedState = req.cookies?.[this.stateKey]

    this._debugLog('🔍 Callback debugging:')
    this._debugLog('  - Received state:', state)
    this._debugLog('  - Stored state:', storedState)
    this._debugLog('  - State key:', this.stateKey)
    this._debugLog('  - All cookies:', req.cookies)
    this._debugLog('  - Query params:', req.query)

    res.clearCookie(this.stateKey)

    if (error) {
      console.error('Spotify authorization error:', error)
      throw new Error('Authorization denied by Spotify')
    }

    if (!state || state !== storedState) {
      console.error('State validation failed')
      console.error('Expected:', storedState, 'Received:', state)
      throw new Error('Security validation failed')
    }

    if (!code) {
      console.error('No authorization code received')
      throw new Error('Authorization code missing')
    }

    try {
      const tokens = await this._exchangeCodeForTokens(code)

      const userProfile = await this._fetchUserProfile(tokens.access_token)

      this.uid = userProfile.id
      this.refreshToken = tokens.refresh_token
      this._debugLog('User authenticated successfully')
      return this._buildRedirectUrl(tokens)
    } catch (exchangeError) {
      console.error('Token exchange failed:', exchangeError)
      throw exchangeError
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      console.error('No refresh token available')
      throw new Error('No refresh token available')
    }

    try {
      const tokens = await this._refreshAccessToken()
      this._debugLog('Token refreshed successfully')
      return this._buildRedirectUrl({
        access_token: tokens.access_token,
        refresh_token: this.refreshToken,
      })
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError)
      throw refreshError
    }
  }

  async _exchangeCodeForTokens(code) {
    const requestBody = {
      code,
      redirect_uri: config.spotify.redirectUri,
      grant_type: 'authorization_code',
    }

    const authString = `${config.spotify.clientId}:${config.spotify.clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    this._debugLog('🔄 Exchanging code for tokens...')
    this._debugLog('📝 Request body:', requestBody)

    try {
      const response = await needle(
        'post',
        'https://accounts.spotify.com/api/token',
        stringify(requestBody),
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      )

      this._debugLog('📊 Token response status:', response.statusCode)
      this._debugLog('🎫 Token response body:', response.body)

      if (response.statusCode !== 200) {
        console.error('Spotify token request failed:', response.body)
        throw new Error('Token exchange failed')
      }

      if (!response.body) {
        console.error('Empty response from Spotify')
        throw new Error('Empty token response')
      }

      let parsedBody = response.body
      if (typeof response.body === 'string') {
        try {
          parsedBody = JSON.parse(response.body)
        } catch (parseError) {
          console.error('Failed to parse token response:', parseError)
          throw parseError
        }
      }

      if (!parsedBody.access_token) {
        console.error('No access token in response')
        throw new Error('Missing access token')
      }

      return parsedBody
    } catch (requestError) {
      console.error('Token exchange request failed:', requestError)
      throw requestError
    }
  }

  async _fetchUserProfile(accessToken) {
    this._debugLog(
      '👤 Fetching user profile with token:',
      accessToken?.substring(0, 20) + '...'
    )

    try {
      const response = await needle('get', 'https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      })

      this._debugLog('👤 Profile response status:', response.statusCode)
      this._debugLog('👤 Profile response body:', response.body)

      if (response.statusCode !== 200) {
        console.error('Failed to fetch user profile:', response.body)
        throw new Error('Profile fetch failed')
      }

      if (!response.body?.id) {
        console.error('No user ID in profile response')
        throw new Error('Invalid profile response')
      }

      return response.body
    } catch (profileError) {
      console.error('User profile request failed:', profileError)
      throw profileError
    }
  }

  async _refreshAccessToken() {
    const authString = `${config.spotify.clientId}:${config.spotify.clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    try {
      const response = await needle(
        'post',
        'https://accounts.spotify.com/api/token',
        stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      )

      if (response.statusCode !== 200) {
        console.error('Token refresh request failed:', response.body)
        throw new Error('Refresh request failed')
      }

      return response.body
    } catch (refreshError) {
      console.error('Token refresh error:', refreshError)
      throw refreshError
    }
  }

  _buildRedirectUrl(tokens) {
    const baseUrl = config.app.redirectUrl || 'http://localhost:8888'

    const params = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || this.refreshToken,
      uid: this.uid,
    }

    return `${baseUrl}/#${stringify(params)}`
  }
}

module.exports = { SpotifyAuthService }
