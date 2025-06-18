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
    this.clientIdKey = 'spotify_client_id'
    this.clientSecretKey = 'spotify_client_secret'
    this.refreshToken = null
    this.uid = null
  }

  async getAuthUrl(res, clientId, clientSecret) {
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Valid client ID is required for authentication')
    }

    if (!clientSecret || typeof clientSecret !== 'string') {
      throw new Error('Valid client secret is required for authentication')
    }

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
    res.cookie(this.clientIdKey, clientId, cookieOptions)
    res.cookie(this.clientSecretKey, clientSecret, cookieOptions)

    this.logger.log(
      '🍪 Set cookies - state:',
      state,
      'clientId:',
      clientId.substring(0, 8) + '...',
      'clientSecret:',
      clientSecret.substring(0, 8) + '...'
    )

    const scope =
      'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
    const redirectUri = config.spotify.redirectUri

    const authUrl = `https://accounts.spotify.com/authorize?${stringify({
      response_type: 'code',
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
      state,
    })}`
    this.logger.log(
      'Auth URL generated successfully with client ID:',
      clientId.substring(0, 8) + '...'
    )
    return authUrl
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query
    const storedState = req.cookies?.[this.stateKey]
    const storedClientId = req.cookies?.[this.clientIdKey]
    const storedClientSecret = req.cookies?.[this.clientSecretKey]

    this.logger.log('🔍 Callback debugging:')
    this.logger.log('  - Received state:', state)
    this.logger.log('  - Stored state:', storedState)
    this.logger.log(
      '  - Stored client ID:',
      storedClientId?.substring(0, 8) + '...'
    )
    this.logger.log(
      '  - Stored client secret:',
      storedClientSecret?.substring(0, 8) + '...'
    )

    if (error) {
      this.logger.error('Spotify authorization error:', error)
      throw new Error('Authorization denied by Spotify')
    }

    if (!state || state !== storedState) {
      this.logger.error('State validation failed')
      this.logger.error('Expected:', storedState, 'Received:', state)
      throw new Error('Security validation failed')
    }

    if (!storedClientId) {
      this.logger.error('No client ID found in callback')
      throw new Error('Client ID missing from session')
    }

    if (!storedClientSecret) {
      this.logger.error('No client secret found in callback')
      throw new Error('Client secret missing from session')
    }

    if (!code) {
      this.logger.error('No authorization code received')
      throw new Error('Authorization code missing')
    }

    res.clearCookie(this.stateKey)
    res.clearCookie(this.clientIdKey)
    res.clearCookie(this.clientSecretKey)

    try {
      const tokens = await this._exchangeCodeForTokens(
        code,
        storedClientId,
        storedClientSecret
      )
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

  async refreshAccessToken(clientId, clientSecret) {
    if (!clientId) {
      this.logger.error('No client ID provided for token refresh')
      throw new Error('Client ID required for token refresh')
    }

    if (!clientSecret) {
      this.logger.error('No client secret provided for token refresh')
      throw new Error('Client secret required for token refresh')
    }

    if (!this.refreshToken) {
      this.logger.error('No refresh token available')
      throw new Error('No refresh token available')
    }

    try {
      const tokens = await this._refreshAccessToken(clientId, clientSecret)
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

  async _exchangeCodeForTokens(code, clientId, clientSecret) {
    const authString = `${clientId}:${clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    this.logger.log(
      '🔄 Exchanging code for tokens with credentials:',
      clientId.substring(0, 8) + '...'
    )

    try {
      const response = await this.httpClient.post(
        'https://accounts.spotify.com/api/token',
        {
          form: {
            code,
            redirect_uri: config.spotify.redirectUri,
            grant_type: 'authorization_code',
          },
          headers: {
            Authorization: authHeader,
          },
          timeout: {
            request: 15000,
          },
          responseType: 'json',
        }
      )

      this.logger.log('📊 Token response status:', response.statusCode)

      if (response.statusCode !== 200) {
        this.logger.error(
          'Spotify token request failed:',
          JSON.stringify(response.body)
        )
        throw new Error('Token exchange failed')
      }

      if (!response.body) {
        this.logger.error('Empty response from Spotify')
        throw new Error('Empty token response')
      }

      const parsedBody = response.body

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
    this.logger.log(
      '👤 Fetching user profile with token:',
      accessToken?.substring(0, 20) + '...'
    )

    try {
      const response = await this.httpClient.get(
        'https://api.spotify.com/v1/me',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: {
            request: 10000,
          },
          responseType: 'json',
        }
      )

      if (!response.body?.id) {
        this.logger.error('No user ID in profile response')
        throw new Error('Invalid profile response')
      }
      return response.body
    } catch (profileError) {
      this.logger.error('User profile request failed:', profileError)
      throw profileError
    }
  }

  async _refreshAccessToken(clientId, clientSecret) {
    const authString = `${clientId}:${clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    try {
      const response = await this.httpClient.post(
        'https://accounts.spotify.com/api/token',
        {
          form: {
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
          },
          headers: {
            Authorization: authHeader,
          },
          timeout: {
            request: 15000,
          },
          responseType: 'json',
        }
      )

      if (!response.body) {
        this.logger.error('Token refresh request failed:', response.body)
        throw new Error('Refresh request failed')
      }
      return response.body
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
