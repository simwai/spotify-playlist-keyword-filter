const { stringify } = require('querystring')
const needle = require('needle')
const config = require('../config/index.js')
const { generateRandomString } = require('../utils/crypto.js')

class SpotifyAuthService {
  constructor() {
    this.stateKey = 'spotify_auth_state'
    this.refreshToken = null
    this.uid = null
  }

  async getAuthUrl(res) {
    if (!config.spotify.clientId) {
      throw new Error('Missing Spotify Client ID')
    }

    const state = generateRandomString(16)

    res.cookie(this.stateKey, state, {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: config.server.isProduction ? 'none' : 'lax',
    })

    const scope =
      'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative'
    const frontendUrl = this._getFrontendUrl()

    const authUrl = `https://accounts.spotify.com/authorize?${stringify({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope,
      redirect_uri: frontendUrl,
      state,
    })}`

    console.log(
      '🚀 Redirecting to Spotify:',
      authUrl,
      'With redirect_uri:',
      frontendUrl
    )
    return authUrl
  }

  async handleCallback(req, res) {
    if (!req.query.code && !req.query.state && !req.query.error) {
      console.log('⚠️ Direct access to callback detected, redirecting to login')
      throw new Error('direct_access')
    }

    console.log('🔄 Callback received:', {
      hasCode: !!req.query.code,
      hasState: !!req.query.state,
      error: req.query.error,
    })

    const { code, state, error } = req.query
    const storedState = req.cookies?.[this.stateKey]

    if (error) {
      console.log('❌ Authorization error:', error)
      throw new Error(`Authorization error: ${error}`)
    }

    if (!state || state !== storedState) {
      console.log('❌ State mismatch:', { state, storedState })
      throw new Error('State mismatch')
    }

    res.clearCookie(this.stateKey)

    console.log('🎫 Exchanging code for token...')
    const tokens = await this._exchangeCodeForTokens(code)

    console.log('✅ Token received, fetching user profile...')
    const userProfile = await this._fetchUserProfile(tokens.access_token)

    this.uid = userProfile.id
    this.refreshToken = tokens.refresh_token

    console.log('✅ User authenticated:', this.uid)
    console.log('🎉 Redirecting to frontend with tokens')

    return this._buildRedirectUrl(tokens)
  }

  async refreshToken() {
    console.log('🔄 Refresh token requested')

    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    const tokens = await this._refreshAccessToken()
    console.log('✅ Token refreshed successfully')

    return this._buildRedirectUrl({
      access_token: tokens.access_token,
      refresh_token: this.refreshToken,
    })
  }

  async _exchangeCodeForTokens(code) {
    const response = await needle.post(
      'https://accounts.spotify.com/api/token',
      {
        code,
        redirect_uri: config.spotify.redirectUri,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
        },
      }
    )

    if (response.statusCode !== 200) {
      console.error('❌ Token exchange failed:', response.body)
      throw new Error('Token exchange failed')
    }

    return response.body
  }

  async _fetchUserProfile(accessToken) {
    const response = await needle.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (response.statusCode !== 200) {
      console.error('❌ Failed to fetch user data:', response.body)
      throw new Error('Failed to fetch user profile')
    }

    return response.body
  }

  async _refreshAccessToken() {
    const response = await needle.post(
      'https://accounts.spotify.com/api/token',
      {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
        },
      }
    )

    if (response.statusCode !== 200) {
      console.error('❌ Token refresh failed:', response.body)
      throw new Error('Token refresh failed')
    }

    return response.body
  }

  _getFrontendUrl() {
    return config.server.isProduction
      ? config.spotify.redirectUri
      : 'http://localhost:8888/callback'
  }

  _buildRedirectUrl(tokens) {
    const baseUrl = config.server.isProduction
      ? 'https://simwai.github.io/spotify-playlist-keyword-filter'
      : 'http://localhost:8888'

    return `${baseUrl}/#${stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || this.refreshToken,
      uid: this.uid,
    })}`
  }
}

module.exports = { SpotifyAuthService }
