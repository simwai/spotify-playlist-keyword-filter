class SpotifyPlaylistFilter {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.userId = null
    this.playlists = []
    this.selectedPlaylist = null
    this.keywords = []
    this.filterMode = 'exclude'
    this.tableSort = null

    try {
      this.accessToken = sessionStorage.getItem('spotify_access_token')
      this.refreshToken = sessionStorage.getItem('spotify_refresh_token')
      this.userId = sessionStorage.getItem('spotify_user_id')
    } catch (e) {
      console.warn('Could not access sessionStorage for tokens:', e)
    }

    this.initializeApp()
  }

  initializeApp() {
    this.parseUrlParams()
    this.setupEventListeners()
    this.updateUI()
  }

  parseUrlParams() {
    const hashParams = window.location.hash
      .substring(1)
      .split('&')
      .reduce((params, item) => {
        const [key, value] = item.split('=')
        if (key && value) {
          params[key] = decodeURIComponent(value)
        }
        return params
      }, {})

    if (hashParams.access_token) {
      this.accessToken = hashParams.access_token
      try {
        sessionStorage.setItem('spotify_access_token', this.accessToken)
      } catch (e) {
        console.warn('Failed to store access_token in sessionStorage', e)
      }
    }
    if (hashParams.refresh_token) {
      this.refreshToken = hashParams.refresh_token
      try {
        sessionStorage.setItem('spotify_refresh_token', this.refreshToken)
      } catch (e) {
        console.warn('Failed to store refresh_token in sessionStorage', e)
      }
    }
    if (hashParams.uid) {
      this.userId = hashParams.uid
      try {
        sessionStorage.setItem('spotify_user_id', this.userId)
      } catch (e) {
        console.warn('Failed to store uid in sessionStorage', e)
      }
    }
    if (Object.keys(hashParams).length > 0) {
      window.location.hash = ''
    }

    const errorMessage = hashParams.error
    if (errorMessage) {
      this.showError(decodeURIComponent(errorMessage))
    }
  }

  navigateTo(view, options = {}) {
    const sections = [
      'login',
      'logged-in',
      'playlist-form',
      'tag-form',
      'back-to-playlists-button',
    ]

    for (const sectionId of sections) {
      const element = document.getElementById(sectionId)
      if (element) {
        element.classList.add('hidden')
      }
    }

    if (view !== 'tag-form') {
      const playlistRows = document.querySelectorAll('#playlists tbody tr')
      for (const row of playlistRows) {
        row.classList.remove('selected')
      }
    }

    switch (view) {
      case 'login':
        document.getElementById('login').classList.remove('hidden')
        break

      case 'playlist-selection':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('playlist-form').classList.remove('hidden')
        window.selectedPlaylist = null
        this.selectedPlaylist = null
        break

      case 'tag-form':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('tag-form').classList.remove('hidden')
        document
          .getElementById('back-to-playlists-button')
          .classList.remove('hidden')

        if (options.playlist) {
          const tagTitle = document.querySelector('#tag-form h1')
          if (tagTitle) {
            tagTitle.textContent = `Filter "${options.playlist.name}" (${options.playlist.tracks.total} tracks):`
          }
        }
        break

      default:
        console.warn(`Unknown view: ${view}`)
    }
  }

  setupEventListeners() {
    const addButton = document.getElementById('add-button')
    const tagInput = document.getElementById('tag-input')
    const startButton = document.getElementById('start-button')

    addButton?.addEventListener('click', () => this.addKeyword())
    tagInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.addKeyword()
      }
    })
    startButton?.addEventListener('click', () => this.startFiltering())

    const filterModeInputs = document.querySelectorAll(
      'input[name="filter-mode"]'
    )
    for (const input of filterModeInputs) {
      input.addEventListener('change', (event) => {
        this.filterMode = event.target.value
        this.renderKeywords()
      })
    }

    const backButton = document.getElementById('back-to-playlists-button')
    backButton?.addEventListener('click', () => {
      this.navigateTo('playlist-selection')
    })
  }

  async updateUI() {
    if (!this.accessToken) {
      this.navigateTo('login')
      return
    }

    if (this.userId) {
      this.loadPlaylists()
      return
    }

    try {
      const userData = await this._spotifyApiGet('/me')
      this.userId = userData.id
      try {
        sessionStorage.setItem('spotify_user_id', this.userId)
      } catch (e) {
        console.warn('Failed to store uid from /me in sessionStorage', e)
      }
      this.loadPlaylists()
    } catch (error) {
      this._clearAuthData()
      this.navigateTo('login')
      this.showError('Session expired or token invalid. Please log in again.')
    }
  }

  _clearAuthData() {
    this.accessToken = null
    this.refreshToken = null
    this.userId = null
    try {
      sessionStorage.removeItem('spotify_access_token')
      sessionStorage.removeItem('spotify_refresh_token')
      sessionStorage.removeItem('spotify_user_id')
    } catch (e) {
      console.warn('Failed to clear sessionStorage', e)
    }
  }

  async loadPlaylists() {
    if (!this.accessToken) {
      this.showError('Access token not available. Please log in.')
      this.navigateTo('login')
      return
    }
    if (!this.userId) {
      this.showError('User ID not available. Please try logging in again.')
      this.navigateTo('login')
      return
    }

    this.updateResultOutput('<span>🔄 Loading your playlists...</span>')

    try {
      const data = await this._spotifyApiGet('/me/playlists', { limit: 50 })

      this.playlists = data.items
      this.renderPlaylists()
      this.navigateTo('playlist-selection')
      if (this.playlists.length === 0) {
        this.updateResultOutput(
          '<span>🤔 No playlists found, or unable to load them.</span>'
        )
      } else {
        this.updateResultOutput(
          `<span class="pt-8">✅ Loaded ${this.playlists.length} playlists. Select one to continue.</span>`
        )
      }

      this.initTableSort()
    } catch (error) {
      console.error('Error loading playlists:', error)
      this.showError(`Failed to load playlists: ${error.message}`)
    }
  }

  initTableSort() {
    const table = document.getElementById('playlists')
    if (table) {
      if (this.tableSort) {
        this.tableSort.destroy()
      }
      this.tableSort = new Tablesort(table)

      const headers = table.querySelectorAll('th[role="columnheader"]')
      for (const header of headers) {
        if (!header.hasAttribute('title')) {
          header.setAttribute('title', 'Click to sort')
        }
      }
    }
  }

  renderPlaylists() {
    const playlistsTable = document.querySelector('#playlists tbody')
    if (!playlistsTable) {
      console.warn('#playlists tbody not found for rendering.')
      return
    }

    playlistsTable.innerHTML = ''

    if (!this.playlists || this.playlists.length === 0) {
      playlistsTable.innerHTML =
        '<tr><td colspan="2" class="p-4 text-center text-gray-500 border-b">No playlists found.</td></tr>'
      return
    }

    for (const playlist of this.playlists) {
      const row = document.createElement('tr')

      row.className = 'hover:bg-gray-50 cursor-pointer transition-colors'
      const playlistName = playlist.name || 'Unnamed Playlist'
      const trackTotal =
        playlist.tracks && typeof playlist.tracks.total === 'number'
          ? playlist.tracks.total
          : 'N/A'

      row.innerHTML = `
        <td class="p-4 border-b border-gray-200">${playlistName}</td>
        <td class="p-4 border-b border-gray-200" data-sort="${typeof trackTotal === 'number' ? trackTotal : -1}">${trackTotal}</td>
      `

      row.addEventListener('click', () => this.selectPlaylist(playlist, row))
      playlistsTable.appendChild(row)
    }
  }

  selectPlaylist(playlist, rowElement) {
    const selectedPlaylistRows = document.querySelectorAll(
      '#playlists tbody tr.selected'
    )
    for (const activeRow of selectedPlaylistRows) {
      activeRow.classList.remove('selected')
    }

    this.selectedPlaylist = playlist
    rowElement.classList.add('selected')

    console.log('Selected playlist:', playlist.name, playlist.id)

    this.navigateTo('tag-form', { playlist })
    this.updateResultOutput('')
  }

  addKeyword() {
    const tagInput = document.getElementById('tag-input')
    const keyword = tagInput.value.trim()

    if (keyword && !this.keywords.includes(keyword)) {
      this.keywords.push(keyword)
      this.renderKeywords()
      tagInput.value = ''

      const startButton = document.getElementById('start-button')
      if (startButton) {
        if (this.keywords.length > 0) {
          startButton.classList.remove('hidden')
        } else {
          startButton.classList.add('hidden')
        }
      }
    }
  }

  renderKeywords() {
    const tagsContainer = document.getElementById('tags')
    if (!tagsContainer) {
      console.warn('#tags container not found for rendering keywords.')
      return
    }

    tagsContainer.innerHTML = ''

    this.keywords.forEach((keyword, index) => {
      const tag = document.createElement('span')

      tag.className = `tag flex items-center px-3 py-2 rounded-full m-1 ${
        this.filterMode === 'exclude'
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-green-100 text-green-800 border border-green-200'
      } transition-all hover:shadow-sm`

      const iconSpan = document.createElement('span')
      iconSpan.className = 'mr-2 flex items-center justify-center'
      iconSpan.innerHTML =
        this.filterMode === 'exclude'
          ? '<i class="fas fa-ban text-xs opacity-70"></i>'
          : '<i class="fas fa-check text-xs opacity-70"></i>'
      tag.appendChild(iconSpan)

      const textSpan = document.createElement('span')
      textSpan.textContent = keyword
      tag.appendChild(textSpan)

      const removeLink = document.createElement('a')
      removeLink.innerHTML = '&times;'
      removeLink.href = '#'

      removeLink.className =
        'remove-tag inline-flex items-center justify-center ml-2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors'
      removeLink.setAttribute('aria-label', `Remove keyword ${keyword}`)
      removeLink.setAttribute('role', 'button')

      removeLink.onclick = (event) => {
        event.preventDefault()
        this.removeKeyword(index)
      }

      tag.appendChild(removeLink)
      tagsContainer.appendChild(tag)
    })
  }

  removeKeyword(index) {
    const tagsContainer = document.getElementById('tags')
    const tagElements = tagsContainer.querySelectorAll('.tag')
    const tagToRemove = tagElements[index]

    if (tagToRemove) {
      tagToRemove.classList.add('removing')

      setTimeout(() => {
        this.keywords.splice(index, 1)
        this.renderKeywords()

        const startButton = document.getElementById('start-button')
        if (startButton) {
          if (this.keywords.length > 0) {
            startButton.classList.remove('hidden')
          } else {
            startButton.classList.add('hidden')
          }
        }
      }, 300)
    } else {
      this.keywords.splice(index, 1)
      this.renderKeywords()
    }
  }

  async startFiltering() {
    if (!this.selectedPlaylist) {
      this.showError('Please select a playlist.')
      return
    }

    if (this.keywords.length === 0) {
      this.showError('Please add keywords.')
      return
    }

    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.disabled = true
      startButton.classList.add('opacity-70')
    }

    this.updateResultOutput(
      `<div class="flex items-center justify-center py-4 gap-3">
        <div class="inline-flex items-center justify-center w-6 h-6 border-2 border-t-transparent border-spotify-green rounded-full animate-spin" role="status"></div>
        <span class="text-gray-800">🚀 Starting filter process...</span>
      </div>`
    )

    try {
      let processedTrackCount = 0
      let totalFilteredOutCount = 0
      const allTracksToKeep = []
      const BATCH_SIZE_PROCESSING = 10
      let currentProcessingBatch = []
      let batchNumber = 0

      const trackGenerator = this._fetchPlaylistTracksGenerator()

      for await (const track of trackGenerator) {
        currentProcessingBatch.push(track)
        processedTrackCount++

        if (
          currentProcessingBatch.length >= BATCH_SIZE_PROCESSING ||
          processedTrackCount === this.selectedPlaylist.tracks.total
        ) {
          batchNumber++
          this.updateResultOutput(
            `<span>🔄 Processing batch ${batchNumber} of tracks for lyrics & filtering... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
          )
          const batchResult = await this._processTrackBatch(
            currentProcessingBatch,
            batchNumber
          )
          allTracksToKeep.push(...batchResult.tracksToKeep)
          totalFilteredOutCount += batchResult.filteredOutCountInBatch
          currentProcessingBatch = []

          this.updateResultOutput(
            `<span>🔄 Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total} | Kept so far: ${allTracksToKeep.length} | Filtered out: ${totalFilteredOutCount}</span>`
          )
        }
      }
      if (currentProcessingBatch.length > 0) {
        batchNumber++
        this.updateResultOutput(
          `<span>🔄 Processing final batch ${batchNumber} of tracks... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
        )
        const batchResult = await this._processTrackBatch(
          currentProcessingBatch,
          batchNumber
        )
        allTracksToKeep.push(...batchResult.tracksToKeep)
        totalFilteredOutCount += batchResult.filteredOutCountInBatch
        this.updateResultOutput(
          `<span>🏁 Track processing complete. Total Processed: ${processedTrackCount} | Total Kept: ${allTracksToKeep.length} | Total Filtered Out: ${totalFilteredOutCount}</span>`
        )
      }

      if (allTracksToKeep.length > 0) {
        const newPlaylist = await this._createFilteredPlaylist()
        if (newPlaylist && newPlaylist.id) {
          const trackUrisToKeep = allTracksToKeep
            .map((track) => track.uri)
            .filter((uri) => this._isValidSpotifyUri(uri))

          console.log(
            `📊 Track URI validation: ${allTracksToKeep.length} tracks -> ${trackUrisToKeep.length} valid URIs`
          )

          if (trackUrisToKeep.length > 0) {
            await this._addTracksToSpotifyPlaylist(
              newPlaylist.id,
              trackUrisToKeep
            )
            const invalidUriCount =
              allTracksToKeep.length - trackUrisToKeep.length
            const successMessage = `✅ Filtering complete! New playlist "${newPlaylist.name}" created with ${trackUrisToKeep.length} tracks. ${totalFilteredOutCount} tracks were filtered out.`
            const invalidUriMessage =
              invalidUriCount > 0
                ? ` (${invalidUriCount} tracks had invalid URIs and were skipped)`
                : ''

            this.showSuccess(
              successMessage +
                invalidUriMessage +
                ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`
            )
          } else {
            this.showError(
              'No valid track URIs found. Unable to create playlist.'
            )
          }
        }
      } else {
        this.showSuccess(
          `ℹ️ Filtering complete. No tracks matched your criteria to be kept. ${totalFilteredOutCount} tracks were filtered out.`
        )
      }
    } catch (error) {
      console.error('❌ Filtering process failed:', error)
      this.showError(
        `Filtering process failed: ${error.message || 'An unknown error occurred.'}`
      )
    } finally {
      if (startButton) {
        startButton.disabled = false
        startButton.classList.remove('opacity-70')
      }
    }
  }

  showError(message) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = `<div class="w-full p-4 bg-red-100 text-red-800 rounded-lg border border-red-200 mt-4">${message}</div>`
    } else {
      console.error('Could not show error, #result-output not found:', message)
    }
  }

  showSuccess(message) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = `<div class="w-full p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 mt-4">${message}</div>`
    } else {
      console.error(
        'Could not show success, #result-output not found:',
        message
      )
    }
  }

  async _spotifyApiRequest(endpoint, method = 'GET', body = null, params = {}) {
    let url = `https://api.spotify.com/v1${endpoint}`
    if (Object.keys(params).length > 0) {
      const queryParams = Object.keys(params)
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
        )
        .join('&')
      url += `?${queryParams}`
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      if (response.status === 401) {
        this.showError(
          'Authentication failed or token expired. Please log in again.'
        )
        throw new Error('Spotify API Unauthorized')
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Spotify API Error:', response.status, errorData)
        throw new Error(
          `Spotify API Error: ${response.status} - ${errorData.error?.message || response.statusText}`
        )
      }
      return response.json()
    } catch (error) {
      console.error(`Error in _spotifyApiRequest to ${url}:`, error)
      throw error
    }
  }

  async _spotifyApiGet(endpoint, params = {}) {
    return this._spotifyApiRequest(endpoint, 'GET', null, params)
  }

  async _spotifyApiPost(endpoint, body = {}) {
    return this._spotifyApiRequest(endpoint, 'POST', body)
  }

  async _fetchLyricsForTrack(artist, song) {
    const apiBaseUrl = window.location.origin
    try {
      const searchResponse = await fetch(
        `${apiBaseUrl}/api/lyrics/search?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`
      )
      if (!searchResponse.ok) {
        console.warn(
          `Lyrics search failed for ${artist} - ${song}: ${searchResponse.status}`
        )
        return null
      }
      const searchData = await searchResponse.json()

      if (!searchData.found || !searchData.songId) {
        console.log(`Lyrics not found (search stage) for: ${artist} - ${song}`)
        return null
      }

      const lyricsResponse = await fetch(
        `${apiBaseUrl}/api/lyrics/${searchData.songId}`
      )
      if (!lyricsResponse.ok) {
        console.warn(
          `Fetching lyrics for ID ${searchData.songId} failed: ${lyricsResponse.status}`
        )
        return null
      }
      const lyricsData = await lyricsResponse.json()
      return lyricsData.lyrics
    } catch (error) {
      console.error(`Error fetching lyrics for ${artist} - ${song}:`, error)
      return null
    }
  }

  async * _fetchPlaylistTracksGenerator() {
    if (!this.selectedPlaylist || !this.userId) {
      throw new Error('Playlist or User ID not selected for fetching tracks.')
    }
    const endpoint = `/playlists/${this.selectedPlaylist.id}/tracks`
    let offset = 0
    const limit = 50
    let hasMoreData = true
    let batchCount = 0
    let totalFetched = 0

    console.log(
      `📥 Starting to fetch tracks from playlist: ${this.selectedPlaylist.name}`
    )
    this.updateResultOutput(
      `<span>🔄 Fetching tracks from "${this.selectedPlaylist.name}"...</span>`
    )

    while (hasMoreData) {
      batchCount++
      console.log(`📡 Fetching tracks batch ${batchCount} (offset: ${offset})`)
      try {
        const params = {
          limit: limit,
          offset: offset,
          fields: 'items(track(name,artists(name),uri,id)),next',
        }
        const response = await this._spotifyApiGet(endpoint, params)
        const items = response.items

        if (!items) {
          console.error('No items received!')
          hasData = false
        }

        items.filter(
          (trackItem) => !this._isValidSpotifyUri(trackItem.track.uri)
        )

        totalFetched += items.length
        console.log(
          `✅ Batch ${batchCount}: Got ${items.length} valid tracks (total: ${totalFetched})`
        )
        this.updateResultOutput(
          `<span>🔄 Fetched ${totalFetched} / ${this.selectedPlaylist.tracks.total} tracks...</span>`
        )

        for (const trackItem of items) {
          yield trackItem.track
        }
        offset += items.length
        if (!response.next) {
          hasMoreData = false
          console.log(
            `🏁 Reached end of playlist - total valid tracks: ${totalFetched}`
          )
        }
      } catch (error) {
        console.error(`❌ Error fetching tracks batch ${batchCount}:`, error)
        this.showError(`Error fetching playlist tracks: ${error.message}`)
        hasMoreData = false
      }
    }
  }

  async _processTrackBatch(trackBatch, batchNumber) {
    console.log(
      `🎵 Processing batch ${batchNumber}: ${trackBatch.length} tracks with bulk API`
    )

    try {
      const apiBaseUrl = window.location.origin
      const requestPayload = {
        tracks: trackBatch.map((track) => ({
          name: track.name,
          artists: track.artists,
          uri: track.uri,
          id: track.id,
        })),
      }

      console.log(
        `🔍 Bulk API request payload for batch ${batchNumber}:`,
        requestPayload
      )

      const response = await fetch(`${apiBaseUrl}/api/lyrics/bulk-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        throw new Error(`Bulk processing failed: ${response.status}`)
      }

      const bulkResult = await response.json()

      const tracksToKeep = []
      let filteredOutCountInBatch = 0

      for (const result of bulkResult.data) {
        const { track, lyrics } = result

        if (!lyrics) {
          console.log(
            `🚫 Lyrics not found for "${track.song}" by ${track.artist}. Skipping track.`
          )
          filteredOutCountInBatch++
          continue
        }

        const isKeywordInLyrics = this.checkKeywordInLyrics(lyrics)

        if (this.filterMode === 'exclude') {
          if (isKeywordInLyrics) {
            console.log(
              `🚫 EXCLUDE mode: Filtering out "${track.song}" by ${track.artist} (matches keyword).`
            )
            filteredOutCountInBatch++
          } else {
            console.log(
              `✅ EXCLUDE mode: Keeping "${track.song}" by ${track.artist}.`
            )
            tracksToKeep.push(track)
          }
        }

        if (this.filterMode === 'include') {
          if (isKeywordInLyrics) {
            console.log(
              `✅ INCLUDE mode: Keeping "${track.song}" by ${track.artist} (matches keyword).`
            )
            tracksToKeep.push(track)
          } else {
            console.log(
              `🚫 INCLUDE mode: Filtering out "${track.song}" by ${track.artist} (no keyword match).`
            )
            filteredOutCountInBatch++
          }
        }
      }

      const processedTrackIds = new Set(bulkResult.data.map((r) => r.track.id))
      const unprocessedTracks = trackBatch.filter(
        (track) => !processedTrackIds.has(track.id)
      )
      filteredOutCountInBatch += unprocessedTracks.length

      console.log(
        `✅ Batch ${batchNumber} completed - Kept: ${tracksToKeep.length}, Filtered out: ${filteredOutCountInBatch}`
      )
      return { tracksToKeep, filteredOutCountInBatch }
    } catch (error) {
      console.error(
        `❌ Bulk processing failed for batch ${batchNumber}:`,
        error
      )
    }
  }

  checkKeywordInLyrics(lyrics) {
    const lowerCaseLyrics = lyrics.toLowerCase()
    let isKeywordInLyrics = false
    for (const keyword of this.keywords) {
      if (lowerCaseLyrics.includes(keyword.toLowerCase())) {
        isKeywordInLyrics = true
        break
      }
    }
    return isKeywordInLyrics
  }

  async _createFilteredPlaylist() {
    if (!this.selectedPlaylist || !this.userId) {
      throw new Error(
        'Cannot create playlist without selected playlist or user ID.'
      )
    }

    const newPlaylistName = `${this.selectedPlaylist.name}`
    this.updateResultOutput(
      `<span>📝 Creating new playlist: "${newPlaylistName}"...</span>`
    )

    try {
      let description
      if (this.filterMode === 'include') {
        description = `Filtered playlist excluding songs with keywords: ${this.keywords.join(', ')}`
      } else {
        description = `Filtered playlist containing songs that match specified criteria`
      }

      const playlistData = await this._spotifyApiPost('/me/playlists', {
        name: newPlaylistName,
        description: description,
        public: false,
      })
      console.log(
        '🎉 New playlist created:',
        playlistData.name,
        playlistData.id
      )
      return playlistData
    } catch (error) {
      console.error('❌ Error creating playlist:', error)
      this.showError(`Failed to create new playlist: ${error.message}`)
      throw error
    }
  }

  async _addTracksToSpotifyPlaylist(playlistId, trackUris) {
    if (!trackUris || trackUris.length === 0) {
      console.log('🤷 No tracks to add to the playlist.')
      this.updateResultOutput(
        '<span>⚠️ No tracks matched the filter criteria to add to the new playlist.</span>'
      )
      return
    }

    const BATCH_SIZE = 100
    console.log(
      `📦 Adding ${trackUris.length} tracks in batches of ${BATCH_SIZE} to playlist ${playlistId}...`
    )
    this.updateResultOutput(
      `<span>📤 Adding ${trackUris.length} tracks to the new playlist...</span>`
    )

    for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
      const batch = trackUris.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(trackUris.length / BATCH_SIZE)

      console.log(
        `📤 Sending batch ${batchNumber}/${totalBatches} (${batch.length} tracks)...`
      )

      console.log(`🔍 First 3 URIs in batch ${batchNumber}:`, batch.slice(0, 3))

      const invalidUris = batch.filter((uri) => !this._isValidSpotifyUri(uri))
      if (invalidUris.length > 0) {
        console.error(
          `❌ Batch ${batchNumber} contains ${invalidUris.length} invalid URIs according to client-side check:`,
          invalidUris
        )
        this.showError(
          `Batch ${batchNumber} contains invalid track URIs. Skipping this batch.`
        )
        continue
      } else {
        console.log(
          `✅ Client-side validation passed for batch ${batchNumber}.`
        )
      }

      this.updateResultOutput(
        `<span>📤 Adding batch ${batchNumber}/${totalBatches} of tracks...</span>`
      )

      try {
        await this._spotifyApiPost(`/playlists/${playlistId}/tracks`, {
          uris: batch,
        })
        console.log(
          `✅ Batch ${batchNumber}/${totalBatches} added successfully`
        )
      } catch (error) {
        console.error(
          `❌ Failed to add batch ${batchNumber}/${totalBatches}:`,
          error
        )
        console.error(`❌ Problematic batch URIs:`, batch)

        for (let j = 0; j < batch.length; j++) {
          const uri = batch[j]
          if (!this._isValidSpotifyUri(uri)) {
            console.error(
              `❌ Invalid URI found at position ${j} during post-error check:`,
              uri
            )
          } else {
            // Maybe add a check for non-printable characters or unexpected formats?
            // console.log(`✅ URI at position ${j} seems valid by regex:`, uri);
          }
        }

        this.showError(
          `Failed to add tracks (batch ${batchNumber}) to playlist: ${error.message}`
        )
        throw error
      }
    }
    console.log(
      `🎉 All ${trackUris.length} tracks added to playlist ${playlistId} successfully!`
    )
  }

  updateResultOutput(htmlContent) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = htmlContent
    }
  }

  _isValidSpotifyUri(uri) {
    if (!uri || typeof uri !== 'string') {
      console.warn('❌ Invalid URI: not a string or null/undefined:', uri)
      return false
    }

    const spotifyUriPattern = /^spotify:track:[A-Za-z0-9]{22}$/
    const isValid = spotifyUriPattern.test(uri)

    if (!isValid) {
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
          console.warn(
            `  → Track ID contains invalid characters:`,
            invalidChars
          )
        }
      }
    }

    return isValid
  }
}

document.addEventListener('DOMContentLoaded', function () {
  new SpotifyPlaylistFilter()
})
