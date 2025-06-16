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

  isValidSpotifyUri(uri) {
    if (!uri || typeof uri !== 'string') {
      console.warn('❌ Invalid URI: not a string or null/undefined:', uri)
      return false
    }

    const spotifyUriPattern = /^spotify:track:[A-Za-z0-9]{22}$/
    const isValid = spotifyUriPattern.test(uri)

    if (isValid) {
      return null
    }

    console.warn('❌ Invalid Spotify URI format:', uri)
    if (!uri.startsWith('spotify:track:')) {
      console.warn('  → URI does not start with "spotify:track:"')
    } else {
      const trackId = uri.replace('spotify:track:', '')

      console.warn(
        `  → Track ID "${trackId}" has length ${trackId.length} (expected 22)`
      )

      // Check for characters outside the expected base62 set
      const invalidChars = trackId
        .split('')
        .filter((c) => !/[A-Za-z0-9]/.test(c))
      if (invalidChars.length > 0) {
        console.warn(`  → Track ID contains invalid characters:`, invalidChars)
      }
    }

    return null
  }

  async addTracksToPlaylist(playlistId, trackUris) {
    if (!playlistId) {
      console.error('No valid playlist ID provided to addTracksToPlaylist()')
    }

    if (!trackUris) {
      console.error('No valid tracks provided to addTracksToPlaylist()')
    }

    const BATCH_SIZE = 100

    console.log(
      `📦 Adding ${trackUris.length} tracks in batches of ${BATCH_SIZE} to playlist ${playlistId}...`
    )
    this.updateResultOutput(
      `<span>📤 Adding ${trackUris.length} tracks to the new playlist...</span>`
    )

    const apiRequestPromises = []
    for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
      const batch = trackUris.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(trackUris.length / BATCH_SIZE)

      console.log(
        `📤 Sending batch ${batchNumber}/${totalBatches} (${batch.length} tracks)...`
      )

      this._areTrackUrisValid(BATCH_SIZE, batch)

      const apiResponse = this._apiRequest(
        '/playlists/' + playlistId + '/tracks',
        'POST',
        {
          uris: batch,
        }
      )
      apiRequestPromises.push(apiResponse)
    }

    await Promise.all(apiRequestPromises)

    return null
  }

  _areTrackUrisValid(trackUris) {
    let areAllUrisValid = false
    for (const uri of trackUris) {
      if (areAllUrisValid) {
        break
      }

      areAllUrisValid = this.isValidSpotifyUri(uri)
    }
    return areAllUrisValid
  }

  async _apiRequest(endpoint, method = 'GET', body = null, params = {}) {
    const url = this._buildUrl(endpoint, params)
    const options = this._buildRequestOptions(method, body)

    const response = await fetch(url, options)
    return this._handleResponse(response)
  }

  _buildUrl(endpoint, params) {
    let url = `https://api.spotify.com/v1${endpoint}`

    const areParamsExisting = Object.keys(params).length > 0
    if (areParamsExisting) {
      // "key1=value1&key2=value2"
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
      throw new Error('Spotify API Unauthorized')
    }

    if (!response.ok) {
      console.error(
        'Spotify API Error:\n',
        'Response status: ' + response.status + '\n',
        'Response status text: ' + response.statusText
      )

      throw new Error(
        `Spotify API Error: ` + `${response.status} - ${response.statusText}`
      )
    }

    return response.json()
  }
}

export default SpotifyApiService
