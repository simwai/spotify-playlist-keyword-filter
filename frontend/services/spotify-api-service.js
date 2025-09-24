class SpotifyApiService {
  constructor(authService) {
    if (!authService) {
      throw new Error('No auth service provided to SpotifyApiService!')
    }

    this.authService = authService
  }

  async getUser() {
    return this._apiRequest('/me')
  }

  async getPlaylists(limit = 50) {
    return this._apiRequest('/me/playlists', 'GET', null, { limit })
  }

  async createPlaylist(name, description, isPublic = true) {
    return this._apiRequest('/me/playlists', 'POST', {
      name,
      description,
      public: isPublic,
    })
  }

  async addTracksToPlaylist(playlistId, trackUris) {
    console.log('trackUrisToKeep:', trackUris)
    console.log('Is array?', Array.isArray(trackUris))

    if (!playlistId) {
      console.error('❌ No valid playlist ID provided to addTracksToPlaylist()')
      return
    }

    if (!trackUris || !Array.isArray(trackUris)) {
      console.error('❌ No valid tracks provided to addTracksToPlaylist()')
      return
    }

    const BATCH_SIZE = 100
    console.log(`📦 Adding ${trackUris.length} tracks in batches of ${BATCH_SIZE} to playlist ${playlistId}...`)
    console.log('Adding tracks to playlist...')

    const apiRequestPromises = []
    for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
      const batch = trackUris.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(trackUris.length / BATCH_SIZE)

      console.log(`📤 Sending batch ${batchNumber}/${totalBatches} (${batch.length} tracks)...`)

      if (!this._areTrackUrisValid(batch)) {
        console.error('❌ One or more URIs in this batch are invalid, skipping...')
        continue
      }

      const apiResponse = this._apiRequest('/playlists/' + playlistId + '/tracks', 'POST', {
        uris: batch,
      })
      apiRequestPromises.push(apiResponse)
    }

    await Promise.all(apiRequestPromises)
    console.log('✅ Finished adding tracks to playlist:', playlistId)

    return null
  }

  _areTrackUrisValid(trackUris) {
    for (const uri of trackUris) {
      if (!this.isValidSpotifyUri(uri)) {
        console.warn(`❌ Invalid Spotify URI: ${uri}`)
        return false
      }
    }
    return true
  }

  isValidSpotifyUri(uri) {
    return typeof uri === 'string' && uri.startsWith('spotify:track:')
  }

  async _apiRequest(endpoint, method = 'GET', body = null, params = {}) {
    const url = this._buildUrl(endpoint, params)
    const options = this._buildRequestOptions(method, body)

    const response = await fetch(url, options)
    return this._handleResponse(response)
  }

  _buildUrl(endpoint, params) {
    let url = `https://api.spotify.com/v1${endpoint}`

    if (Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => {
          const encodedKey = encodeURIComponent(key)
          const encodedValue = encodeURIComponent(value)
          return `${encodedKey}=${encodedValue}`
        })
        .join('&')

      url += `?${queryString}`
    }

    return url
  }

  _buildRequestOptions(method = 'GET', body = null) {
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

    return options
  }

  async _handleResponse(response) {
    if (response.status === 401) {
      if (typeof uiManager !== 'undefined') {
        uiManager.showLogin()
      }
      throw new Error('Spotify API Unauthorized')
    }

    if (!response.ok) {
      console.error(
        'Spotify API Error:\n',
        'Response status: ' + response.status + '\n',
        'Response status text: ' + response.statusText
      )
      throw new Error(`Spotify API Error: ${response.status} - ${response.statusText}`)
    }

    return response.json()
  }
}

export default SpotifyApiService
