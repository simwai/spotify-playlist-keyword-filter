class SpotifyApiClient {
  constructor(httpClient, config, accessToken = null, refreshToken = null) {
    if (!httpClient) {
      throw new Error('No http client provided to SpotifyApiClient')
    }

    if (!config) {
      throw new Error('No config provided to SpotifyApiClient')
    }

    this.httpClient = httpClient
    this.config = config

    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.baseUrl = 'https://api.spotify.com/v1'
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
    return this._makeRequest('POST', `/playlists/${playlistId}/tracks`, null, body)
  }

  async getPlaylist(playlistId, fields = null) {
    const params = fields ? { fields } : null
    return this._makeRequest('GET', `/playlists/${playlistId}`, params)
  }

  async _makeRequest(method, endpoint, params = null, body = null, retryCount = 0) {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.')
    }

    const url = `${this.baseUrl}${endpoint}`

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
    }

    if (params && Object.keys(params).length > 0) {
      options.searchParams = params
    }

    if (body) {
      options.json = body
    }

    try {
      // Make sure httpClient is used as a function
      const response = await this.httpClient(url, options)
      return response.body
    } catch (error) {
      // Handle rate limiting
      if (error.response?.statusCode === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 1
        console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`)
        await this._sleep(retryAfter * 1000)
        return this._makeRequest(method, endpoint, params, body, retryCount + 1)
      }

      // Handle token expiration
      if (error.response?.statusCode === 401 && retryCount === 0) {
        console.log('Access token expired, attempting refresh...')
        if (await this._refreshAccessToken()) {
          return this._makeRequest(method, endpoint, params, body, retryCount + 1)
        }
        throw new Error('Authentication failed - please re-authenticate')
      }

      const errorMessage = error.response?.body?.error?.message || error.message || 'Unknown error'

      console.error(`Error making ${method} request to ${endpoint}:`, errorMessage)

      throw new Error(`Spotify API Error (${error.response?.statusCode || 'Unknown'}): ${errorMessage}`)
    }
  }

  async _refreshAccessToken() {
    if (!this.refreshToken) {
      console.error('No refresh token available for token refresh')
      return false
    }

    try {
      const authString = `${this.config.spotify.clientId}:${this.config.spotify.clientSecret}`
      const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

      // Use the httpClient instead of got directly
      const response = await this.httpClient.post('https://accounts.spotify.com/api/token', {
        form: {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        },
        headers: {
          Authorization: authHeader,
        },
        responseType: 'json',
      })
      if (response.body?.access_token) {
        this.accessToken = response.body.access_token
        console.log('Access token refreshed successfully')
        return true
      } else {
        console.error('Failed to refresh access token:', response.body)
        return false
      }
    } catch (error) {
      console.error('Error refreshing access token:', error.message)
      return false
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

module.exports = SpotifyApiClient
module.exports.default = SpotifyApiClient
module.exports.SpotifyApiClient = SpotifyApiClient
