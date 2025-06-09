const needle = require('needle')
const config = require('../config/index.js')

class SpotifyApiClient {
  constructor(accessToken = null, refreshToken = null) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.baseUrl = 'https://api.spotify.com/v1'
  }

  setTokens(accessToken, refreshToken = null) {
    this.accessToken = accessToken
    if (refreshToken) {
      this.refreshToken = refreshToken
    }
  }

  async getUserProfile() {
    return this._makeRequest('GET', '/me')
  }

  async getUserPlaylists(limit = 50, offset = 0) {
    return this._makeRequest('GET', '/me/playlists', { limit, offset })
  }

  async getPlaylistTracks(playlistId, limit = 50, offset = 0, fields = null) {
    const params = { limit, offset }
    if (fields) {
      params.fields = fields
    }
    return this._makeRequest('GET', `/playlists/${playlistId}/tracks`, params)
  }

  async createPlaylist(userId, name, description = '', isPublic = false) {
    const body = {
      name,
      description,
      public: isPublic,
    }
    return this._makeRequest('POST', `/users/${userId}/playlists`, null, body)
  }

  async addTracksToPlaylist(playlistId, trackUris) {
    const body = { uris: trackUris }
    return this._makeRequest(
      'POST',
      `/playlists/${playlistId}/tracks`,
      null,
      body
    )
  }

  async getPlaylist(playlistId, fields = null) {
    const params = fields ? { fields } : null
    return this._makeRequest('GET', `/playlists/${playlistId}`, params)
  }

  async _makeRequest(
    method,
    endpoint,
    params = null,
    body = null,
    retryCount = 0
  ) {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.')
    }

    let url = `${this.baseUrl}${endpoint}`

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.keys(params)
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
        )
        .join('&')
      url += `?${queryString}`
    }

    const options = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    }

    let requestBody = null
    if (body) {
      requestBody = JSON.stringify(body)
    }

    try {
      const response = await needle(
        method.toLowerCase(),
        url,
        requestBody,
        options
      )

      // Handle rate limiting
      if (response.statusCode === 429) {
        const retryAfter = parseInt(response.headers['retry-after']) || 1
        console.log(
          `Rate limited. Waiting ${retryAfter} seconds before retry...`
        )
        await this._sleep(retryAfter * 1000)
        return this._makeRequest(method, endpoint, params, body, retryCount + 1)
      }

      // Handle token expiration
      if (response.statusCode === 401 && retryCount === 0) {
        console.log('Access token expired, attempting refresh...')
        if (await this._refreshAccessToken()) {
          return this._makeRequest(
            method,
            endpoint,
            params,
            body,
            retryCount + 1
          )
        }
        throw new Error('Authentication failed - please re-authenticate')
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errorMessage =
          response.body?.error?.message ||
          response.statusText ||
          'Unknown error'
        throw new Error(
          `Spotify API Error (${response.statusCode}): ${errorMessage}`
        )
      }

      return response.body
    } catch (error) {
      console.error(
        `Error making ${method} request to ${endpoint}:`,
        error.message
      )
      throw error
    }
  }

  async _refreshAccessToken() {
    if (!this.refreshToken) {
      console.error('No refresh token available for token refresh')
      return false
    }
    try {
      const authString = `${config.spotify.clientId}:${config.spotify.clientSecret}`
      const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

      const response = await needle(
        'post',
        'https://accounts.spotify.com/api/token',
        'grant_type=refresh_token&refresh_token=' +
          encodeURIComponent(this.refreshToken),
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (response.statusCode === 200 && response.body.access_token) {
        this.accessToken = response.body.access_token
        console.log('Access token refreshed successfully')
        return true
      } else {
        console.error('Failed to refresh access token:', response.body)
        return false
      }
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return false
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
module.exports = { SpotifyApiClient }
