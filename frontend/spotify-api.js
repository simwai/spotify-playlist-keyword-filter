window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class SpotifyApi {
  constructor(accessToken) {
    this.accessToken = accessToken
  }

  async request(endpoint, method = 'GET', body = null, param = {}) {
    let url = `${window.SpotifyPlaylistFilter.config.spotify.apiBaseUrl}${endpoint}`

    if (Object.keys(param).length > 0) {
      const queryParam = Object.keys(param)
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(param[key])}`
        )
        .join('&')
      url += `?${queryParam}`
    }

    const option = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      option.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, option)

      if (response.status === 401) {
        throw new window.SpotifyPlaylistFilter.SpotifyApiError(
          'Authentication failed or token expired',
          401
        )
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Spotify API Error:', response.status, errorData)
        throw new window.SpotifyPlaylistFilter.SpotifyApiError(
          `Spotify API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
          response.status,
          errorData
        )
      }

      return response.json()
    } catch (error) {
      console.error(`Error in Spotify API request to ${url}:`, error)
      throw error
    }
  }

  async get(endpoint, param = {}) {
    return this.request(endpoint, 'GET', null, param)
  }

  async post(endpoint, body = {}) {
    return this.request(endpoint, 'POST', body)
  }

  async getCurrentUser() {
    return this.get('/me')
  }

  async getUserPlaylist(limit = 50) {
    return this.get('/me/playlists', { limit })
  }

  async getPlaylistTrack(playlistId, offset = 0, limit = 50) {
    const param = {
      limit,
      offset,
      fields: 'items(track(name,artists(name),uri,id)),next',
    }
    return this.get(`/playlists/${playlistId}/tracks`, param)
  }

  async createPlaylist(userId, name, description, isPublic = false) {
    return this.post(`/users/${userId}/playlists`, {
      name,
      description,
      public: isPublic,
    })
  }

  async addTrackToPlaylist(playlistId, trackUri) {
    return this.post(`/playlists/${playlistId}/tracks`, {
      uris: trackUri,
    })
  }
}

window.SpotifyPlaylistFilter.SpotifyApi = SpotifyApi
