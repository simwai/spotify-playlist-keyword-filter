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

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (element) {
        // Use UnoCSS hidden class instead of display: none
        element.classList.add('hidden')
      }
    })

    if (view !== 'tag-form') {
      document.querySelectorAll('#playlists tbody tr').forEach((row) => {
        row.classList.remove('selected')
      })
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
    filterModeInputs.forEach((input) => {
      input.addEventListener('change', (event) => {
        this.filterMode = event.target.value
        // Update all tags with the new mode styling
        this.renderKeywords()
      })
    })

    const backButton = document.getElementById('back-to-playlists-button')
    backButton?.addEventListener('click', () => {
      this.navigateTo('playlist-selection')
    })
  }

  async updateUI() {
    if (this.accessToken) {
      if (!this.userId) {
        try {
          const userData = await this._spotifyApiGet('/me')
          this.userId = userData.id
          try {
            sessionStorage.setItem('spotify_user_id', this.userId)
          } catch (e) {
            console.warn('Failed to store uid from /me in sessionStorage', e)
          }
        } catch (error) {
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
          this.navigateTo('login')
          this.showError(
            'Session expired or token invalid. Please log in again.'
          )
          return
        }
      }
      this.loadPlaylists()
    } else {
      this.navigateTo('login')
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
          `<span>✅ Loaded ${this.playlists.length} playlists. Select one to continue.</span>`
        )
      }

      // Initialize table sorting after playlists are rendered
      this.initTableSort()
    } catch (error) {
      console.error('Error loading playlists:', error)
      this.showError(`Failed to load playlists: ${error.message}`)
    }
  }

  // Initialize table sorting
  initTableSort() {
    const table = document.getElementById('playlists')
    if (table) {
      if (this.tableSort) {
        this.tableSort.destroy()
      }
      this.tableSort = new Tablesort(table)

      // Add sortable indicator tooltip
      const headers = table.querySelectorAll('th[role="columnheader"]')
      headers.forEach((header) => {
        if (!header.hasAttribute('title')) {
          header.setAttribute('title', 'Click to sort')
        }
      })
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

    this.playlists.forEach((playlist) => {
      const row = document.createElement('tr')

      row.className = 'hover:bg-gray-50 cursor-pointer transition-colors'
      const playlistName = playlist.name || 'Unnamed Playlist'
      const trackTotal =
        playlist.tracks && typeof playlist.tracks.total === 'number'
          ? playlist.tracks.total
          : 'N/A'

      // Make the track count data-value an actual number for sorting
      row.innerHTML = `
        <td class="p-4 border-b border-gray-200">${playlistName}</td>
        <td class="p-4 border-b border-gray-200" data-sort="${typeof trackTotal === 'number' ? trackTotal : -1}">${trackTotal}</td>
      `

      row.addEventListener('click', () => this.selectPlaylist(playlist, row))
      playlistsTable.appendChild(row)
    })
  }

  selectPlaylist(playlist, rowElement) {
    document
      .querySelectorAll('#playlists tbody tr.selected')
      .forEach((activeRow) => {
        activeRow.classList.remove('selected')
      })

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

      // Use class manipulation instead of style
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

      // Consistent styling for tags with proper spacing and using the Spotify theme colors
      tag.className = `tag flex items-center px-3 py-2 rounded-full m-1 ${
        this.filterMode === 'exclude'
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-green-100 text-green-800 border border-green-200'
      } transition-all hover:shadow-sm`

      // Add an appropriate icon based on filter mode
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

      // Consistent styling for remove button
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
    // Get the tag element before removing from array
    const tagsContainer = document.getElementById('tags')
    const tagElements = tagsContainer.querySelectorAll('.tag')
    const tagToRemove = tagElements[index]

    // Add animation class
    if (tagToRemove) {
      tagToRemove.classList.add('removing')

      // Wait for animation to complete before removing
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
      // Fallback if element not found
      this.keywords.splice(index, 1)
      this.renderKeywords()
    }
  }

  async startFiltering() {
    if (!this.selectedPlaylist || this.keywords.length === 0) {
      this.showError('Please select a playlist and add keywords.')
      return
    }
    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.disabled = true
      startButton.classList.add('opacity-70')
    }

    // Updated spinner with consistent styling using Spotify green
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
          const trackUrisToKeep = allTracksToKeep.map((track) => track.uri)
          await this._addTracksToSpotifyPlaylist(
            newPlaylist.id,
            trackUrisToKeep
          )
          this.showSuccess(
            `✅ Filtering complete! New playlist "${newPlaylist.name}" created with ${allTracksToKeep.length} tracks. ${totalFilteredOutCount} tracks were filtered out.` +
              ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`
          )
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

        if (items && items.length > 0) {
          const validTracks = items.filter(
            (item) =>
              item?.track &&
              item.track.artists?.length > 0 &&
              item.track.name &&
              item.track.uri
          )
          totalFetched += validTracks.length
          console.log(
            `✅ Batch ${batchCount}: Got ${validTracks.length} valid tracks (total: ${totalFetched})`
          )
          this.updateResultOutput(
            `<span>🔄 Fetched ${totalFetched} / ${this.selectedPlaylist.tracks.total} tracks...</span>`
          )

          for (const trackItem of validTracks) {
            yield trackItem.track
          }
          offset += items.length
          if (!response.next) {
            hasMoreData = false
            console.log(
              `🏁 Reached end of playlist - total valid tracks: ${totalFetched}`
            )
          }
        } else {
          hasMoreData = false
          console.log(
            `🏁 No more tracks found - total valid tracks: ${totalFetched}`
          )
        }
      } catch (error) {
        console.error(`❌ Error fetching tracks batch ${batchCount}:`, error)
        console.error(`❌ Error fetching tracks batch ${batchCount}:`, error)
        this.showError(`Error fetching playlist tracks: ${error.message}`)
        throw error
      }
    }
  }

  async _processTrackBatch(trackBatch, batchNumber) {
    console.log(
      `🎵 Processing batch ${batchNumber}: ${trackBatch.length} tracks`
    )
    const tracksToKeep = []
    let filteredOutCountInBatch = 0

    const trackPromises = trackBatch.map(async (track) => {
      const artistName = track.artists[0].name
      const songName = track.name

      const lyrics = await this._fetchLyricsForTrack(artistName, songName)

      if (!lyrics) {
        console.log(
          `🚫 Lyrics not found for "${songName}" by ${artistName}. Skipping track (as per Point 3).`
        )
        filteredOutCountInBatch++
        return null
      }

      const lowerCaseLyrics = lyrics.toLowerCase()
      let matchesKeyword = false
      for (const keyword of this.keywords) {
        if (lowerCaseLyrics.includes(keyword.toLowerCase())) {
          matchesKeyword = true
          break
        }
      }

      if (this.filterMode === 'exclude') {
        if (matchesKeyword) {
          console.log(
            `🚫 EXCLUDE mode: Filtering out "${songName}" by ${artistName} (matches keyword).`
          )
          filteredOutCountInBatch++
          return null
        } else {
          console.log(
            `✅ EXCLUDE mode: Keeping "${songName}" by ${artistName}.`
          )
          return track
        }
      } else {
        if (matchesKeyword) {
          console.log(
            `✅ INCLUDE mode: Keeping "${songName}" by ${artistName} (matches keyword).`
          )
          return track
        }

        console.log(
          `🚫 INCLUDE mode: Filtering out "${songName}" by ${artistName} (no keyword match).`
        )
        filteredOutCountInBatch++

        return null
      }
    })

    const results = await Promise.all(trackPromises)
    results.forEach((track) => {
      if (track) {
        tracksToKeep.push(track)
      }
    })

    console.log(
      `✅ Batch ${batchNumber} completed - Kept: ${tracksToKeep.length}, Filtered out: ${filteredOutCountInBatch}`
    )
    return { tracksToKeep, filteredOutCountInBatch }
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
      const playlistData = await this._spotifyApiPost(
        `/users/${this.userId}/playlists`,
        {
          name: newPlaylistName,
          public: false,
          description: `Filtered based on keywords: ${this.keywords.join(', ')} (Mode: ${this.filterMode})`,
        }
      )
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
}

// Initialize the application when the document is ready
document.addEventListener('DOMContentLoaded', function () {
  new SpotifyPlaylistFilter()
})
