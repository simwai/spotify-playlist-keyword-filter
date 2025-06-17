class SpotifyApiService {
  constructor(authService) {
    if (!authService) {
      throw new Error('No auth service provided to SpotifyApiService!')
    }

    this.authService = authService
    this.apiBase = 'https://api.spotify.com/v1'
    this.isRefreshing = false
    this.refreshPromise = null
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
    const makeRequest = () => this._makeRawRequest(urlOrEndpoint, method, body)

    const response = await makeRequest()

    if (response.status === 401) {
      const refreshed = await this._attemptTokenRefresh()
      if (refreshed) {
        return this._makeRawRequest(urlOrEndpoint, method, body)
      }
    }

    return this._handleResponse(response)
  }

  async _makeRawRequest(urlOrEndpoint, method, body) {
    if (!this.authService.isAuthenticated()) {
      this._redirectToLogin('No authentication token available')
      return
    }

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

    return fetch(url, options)
  }

  async _attemptTokenRefresh() {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    if (!this.authService.refreshToken) {
      console.log('🚫 No refresh token available')
      return false
    }

    this.isRefreshing = true
    console.log('🔄 Attempting token refresh...')

    this.refreshPromise = this._performTokenRefresh()
    const result = await this.refreshPromise

    this.isRefreshing = false
    this.refreshPromise = null

    return result
  }

  async _performTokenRefresh() {
    try {
      const refreshUrl = `/refresh_token`
      const response = await fetch(refreshUrl, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
      })

      if (response.type === 'opaqueredirect' || response.status === 302) {
        const location = response.headers.get('Location')
        if (location?.includes('access_token=')) {
          const tokens = this._parseTokensFromUrl(location)
          this._updateStoredTokens(tokens)
          console.log('✅ Token refresh successful')
          return true
        }
      }

      console.log('❌ Token refresh failed')
      return false
    } catch (error) {
      console.error('❌ Token refresh error:', error)
      return false
    }
  }

  _parseTokensFromUrl(url) {
    const hashPart = url.split('#')[1] || ''
    const params = new URLSearchParams(hashPart)

    return {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      uid: params.get('uid'),
    }
  }

  _updateStoredTokens(tokens) {
    if (tokens.access_token) {
      this.authService.accessToken = tokens.access_token
      sessionStorage.setItem('spotify_access_token', tokens.access_token)
    }

    if (tokens.refresh_token) {
      this.authService.refreshToken = tokens.refresh_token
      sessionStorage.setItem('spotify_refresh_token', tokens.refresh_token)
    }

    if (tokens.uid) {
      this.authService.userId = tokens.uid
      sessionStorage.setItem('spotify_user_id', tokens.uid)
    }
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

  _redirectToLogin(reason) {
    console.log(`🔄 Redirecting to login: ${reason}`)
    this.authService.clearAuthData()
    window.location.href = '/login'
  }
}

export default SpotifyApiService
