class SpotifyApiService {
  constructor(authService) {
    if (!authService) {
      throw new Error('No auth service provided to SpotifyApiService!')
    }

    this.authService = authService
    this.apiBase = 'https://api.spotify.com/v1'
  }

  async getUser() {
    return this._apiRequest('/me')
  }

  async getPlaylists(limit = 50) {
    return this._apiRequest('/me/playlists', 'GET', null, { limit })
  }

  async createPlaylist(name, description, isPublic = true) {
    if (!this.authService.userId) {
      throw new Error('User ID is not available. Cannot create playlist.')
    }
    const endpoint = `/users/${this.authService.userId}/playlists`
    return this._apiRequest(endpoint, 'POST', {
      name,
      description,
      public: isPublic,
    })
  }

  async addTracksToPlaylist(playlistId, trackUris) {
    if (!playlistId || !trackUris || trackUris.length === 0) {
      return
    }
    const BATCH_SIZE = 100
    for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
      const batch = trackUris.slice(i, i + BATCH_SIZE)
      await this._apiRequest(`/playlists/${playlistId}/tracks`, 'POST', {
        uris: batch,
      })
    }
  }

  async * fetchPlaylistTracks(playlist) {
    if (!playlist) {
      throw new Error('Playlist not provided for fetching tracks.')
    }

    let nextUrl = `${this.apiBase}/playlists/${playlist.id}/tracks?limit=50&fields=items(track(name,artists(name),uri,id)),next`

    while (nextUrl) {
      try {
        const response = await this._apiRequest(nextUrl)

        if (!response || !response.items) {
          nextUrl = null
          continue
        }

        const validItems = response.items.filter((item) =>
          this.isValidSpotifyUri(item.track?.uri)
        )

        for (const item of validItems) {
          yield item.track
        }

        nextUrl = response.next
      } catch (error) {
        console.error('❌ Error fetching a batch of playlist tracks:', error)
        throw new Error(`Failed to fetch tracks: ${error.message}`)
      }
    }
  }

  isValidSpotifyUri(uri) {
    if (!uri || typeof uri !== 'string') {
      return false
    }
    return /^spotify:track:[A-Za-z0-9]{22}$/.test(uri)
  }

  async _apiRequest(urlOrEndpoint, method = 'GET', body = null) {
    const url = urlOrEndpoint.startsWith('https://')
      ? urlOrEndpoint
      : `${this.apiBase}${urlOrEndpoint}`

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.authService.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    return this._handleResponse(response)
  }

  async _handleResponse(response) {
    if (response.status === 401) {
      this.authService.clearAuthData()
      throw new Error('Spotify API Unauthorized. Please log in again.')
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || response.statusText
      throw new Error(`Spotify API Error: ${response.status} - ${errorMessage}`)
    }
    if (response.status === 204) {
      return null
    }
    return response.json()
  }
}

export default SpotifyApiService
