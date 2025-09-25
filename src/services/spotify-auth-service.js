const { stringify } = require('querystring')

const config = require('../config/index.js')
const { generateRandomString } = require('../utils/crypto.js')

class SpotifyAuthService {
  constructor(logger, config, httpClient) {
    if (!logger) {
      throw new Error('No logger provided to SpotifyAuthService!')
    }

    if (!config) {
      throw new Error('No config provided to SpotifyAuthService!')
    }

    if (!httpClient) {
      throw new Error('No http client provided to SpotifyAuthService!')
    }

    this.logger = logger
    this.config = config
    this.httpClient = httpClient

    this.stateKey = 'spotify_auth_state'
    this.refreshToken = null
    this.uid = null
  }

  async getAuthUrl(res) {
    const state = generateRandomString(16)
    this.logger.log('🔐 Generated state:', state)

    const cookieOptions = {
      httpOnly: true,
      secure: config.app.isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    }

    res.cookie(this.stateKey, state, cookieOptions)

    this.logger.log('🍪 Set cookie with key:', this.stateKey, 'and value:', state)

    const scope = 'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
    const redirectUri = config.spotify.redirectUri

    const authUrl = `https://accounts.spotify.com/authorize?${stringify({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope,
      redirect_uri: redirectUri,
      state,
    })}`
    this.logger.log('Auth URL generated successfully')
    return authUrl
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query
    const storedState = req.cookies?.[this.stateKey]

    this.logger.log('🔍 Callback debugging:')
    this.logger.log('  - Received state:', state)
    this.logger.log('  - Stored state:', storedState)
    this.logger.log('  - State key:', this.stateKey)

    if (error) {
      this.logger.error('Spotify authorization error:', error)
      throw new Error('Authorization denied by Spotify')
    }

    if (!state || state !== storedState) {
      this.logger.error('State validation failed')
      this.logger.error('Expected:', storedState, 'Received:', state)
      throw new Error('Security validation failed')
    }

    if (!code) {
      this.logger.error('No authorization code received')
      throw new Error('Authorization code missing')
    }

    res.clearCookie(this.stateKey)

    try {
      const tokens = await this._exchangeCodeForTokens(code)

      const userProfile = await this._fetchUserProfile(tokens.access_token)

      this.uid = userProfile.id
      this.refreshToken = tokens.refresh_token
      this.logger.log('👤 User authenticated successfully')
      return this._buildRedirectUrl(tokens)
    } catch (exchangeError) {
      this.logger.error('Token exchange failed:', exchangeError)
      throw exchangeError
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      this.logger.error('No refresh token available')
      throw new Error('No refresh token available')
    }

    try {
      const tokens = await this._refreshAccessToken()
      this.logger.log('Token refreshed successfully')
      return this._buildRedirectUrl({
        access_token: tokens.access_token,
        refresh_token: this.refreshToken,
      })
    } catch (refreshError) {
      this.logger.error('Token refresh failed:', refreshError)
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

    this.logger.log('🔄 Exchanging code for tokens...')
    this.logger.log('📝 Request body:', JSON.stringify(requestBody))

    try {
      const response = await this.httpClient.post('https://accounts.spotify.com/api/token', {
        body: stringify(requestBody),
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: {
          request: 15000,
        },
      })

      this.logger.log('📊 Token response status:', response.statusCode)
      this.logger.log('🎫 Token response body:', response.body)

      if (response.statusCode !== 200) {
        this.logger.error('Spotify token request failed:', response.body)
        throw new Error('Token exchange failed')
      }

      if (!response.body) {
        this.logger.error('Empty response from Spotify')
        throw new Error('Empty token response')
      }

      let parsedBody = response.body
      if (typeof response.body === 'string') {
        try {
          parsedBody = JSON.parse(response.body)
        } catch (parseError) {
          this.logger.error('Failed to parse token response:', parseError)
          throw parseError
        }
      }

      if (!parsedBody.access_token) {
        this.logger.error('No access token in response')
        throw new Error('Missing access token')
      }

      return parsedBody
    } catch (requestError) {
      this.logger.error('Token exchange request failed:', requestError)
      throw requestError
    }
  }

  async _fetchUserProfile(accessToken) {
    this.logger.log('👤 Fetching user profile with token:', accessToken?.substring(0, 20) + '...')

    try {
      const response = await this.httpClient
        .get('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: {
            request: 10000,
          },
        })
        .json()

      if (!response?.id) {
        this.logger.error('No user ID in profile response')
        throw new Error('Invalid profile response')
      }
      return response
    } catch (profileError) {
      this.logger.error('User profile request failed:', profileError)
      throw profileError
    }
  }

  async _refreshAccessToken() {
    const authString = `${config.spotify.clientId}:${config.spotify.clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    try {
      const response = await this.httpClient
        .post('https://accounts.spotify.com/api/token', {
          form: {
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
          },
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: {
            request: 15000,
          },
        })
        .json()

      if (!response) {
        this.logger.error('Token refresh request failed:', response)
        throw new Error('Refresh request failed')
      }
      return response
    } catch (refreshError) {
      this.logger.error('Token refresh error:', refreshError)
      throw refreshError
    }
  }

  _buildRedirectUrl(tokens) {
    const baseUrl = config.app.frontendUrl

    const params = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || this.refreshToken,
      uid: this.uid,
    }

    return `${baseUrl}/#${stringify(params)}`
  }
}

module.exports = SpotifyAuthService
module.exports.default = SpotifyAuthService
module.exports.SpotifyAuthService = SpotifyAuthService
