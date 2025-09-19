import AuthService from './services/auth-service.js'
import SpotifyApiService from './services/spotify-api-service.js'
import UiManager from './services/ui-manager.js'

class SpotifyPlaylistFilter {
  constructor(authService, spotifyApiService, uiManager) {
    if (!authService) {
      throw new Error('No auth service provided to SpotifyPlaylistFilter!')
    }

    if (!spotifyApiService) {
      throw new Error('No Spotify API service provided to SpotifyPlaylistFilter!')
    }

    if (!uiManager) {
      throw new Error('No UI manager provided to SpotifyPlaylistFilter!')
    }

    this.filterMode = 'exclude'
    this.tableSort = null

    this.authService = authService
    this.spotifyApiService = spotifyApiService
    this.uiManager = uiManager

    this.initializeApp()
  }

  initializeApp() {
    this.authService.parseUrlParams()
    this.setupEventListeners()
    this.updateUI()
  }

  _renderKeywordsWithCurrentMode() {
    this.uiManager.renderKeywords(this.filterMode)
  }

  setupEventListeners() {
    const addButton = document.getElementById('add-button')
    const tagInput = document.getElementById('tag-input')
    const startButton = document.getElementById('start-button')

    addButton?.addEventListener('click', () => {
      this.uiManager.addKeyword()
      this._renderKeywordsWithCurrentMode()
    })
    tagInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.uiManager.addKeyword()
        this._renderKeywordsWithCurrentMode()
      }
    })
    startButton?.addEventListener('click', () => this.startFiltering())

    const filterModeInputs = document.querySelectorAll('input[name="filter-mode"]')
    for (const input of filterModeInputs) {
      input.addEventListener('change', (event) => {
        this.filterMode = event.target.value?.toLowerCase()
        this._renderKeywordsWithCurrentMode()
      })
    }

    const backButton = document.getElementById('back-to-playlists-button')
    backButton?.addEventListener('click', () => {
      this.uiManager.navigateTo('playlist-selection')
    })
  }

  async updateUI() {
    if (!this.authService.isAuthenticated()) {
      this.uiManager.navigateTo('login')
      return
    }

    if (this.authService.userId) {
      await this.uiManager.loadPlaylists(this.spotifyApiService, this.authService)
      this._renderKeywordsWithCurrentMode()
      return
    }

    try {
      const userData = await this.spotifyApiService.getUser()
      this.authService.userId = userData.id

      try {
        sessionStorage.setItem('spotify_user_id', this.authService.userId)
      } catch (e) {
        console.warn('Failed to store uid from /me in sessionStorage', e)
      }

      await this.uiManager.loadPlaylists(this.spotifyApiService, this.authService)
      this._renderKeywordsWithCurrentMode()
    } catch (error) {
      this.authService.clearAuthData()
      this.uiManager.navigateTo('login')
      this.uiManager.showError('Session expired or token invalid. Please log in again.')
    }
  }

  async startFiltering() {
    if (!this.uiManager.selectedPlaylist) {
      this.uiManager.showError('Please select a playlist.')
      return
    }

    if (this.uiManager.keywords.length === 0) {
      this.uiManager.showError('Please add keywords.')
      return
    }

    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.disabled = true
      startButton.classList.add('opacity-70')
    }

    this.uiManager.updateResultOutput(`
      <div class="flex items-center justify-center py-4 gap-3">
        <div class="inline-flex items-center justify-center w-6 h-6 border-2 border-t-transparent border-spotify-green rounded-full animate-spin" role="status"></div>
        <span class="text-gray-800">🚀 Starting filter process...</span>
      </div>
    `)

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
          processedTrackCount === this.uiManager.selectedPlaylist.tracks.total
        ) {
          batchNumber++
          this.uiManager.updateResultOutput(
            `<span>🔄 Processing batch ${batchNumber} of tracks for lyrics & filtering... (Processed: ${processedTrackCount}/${this.uiManager.selectedPlaylist.tracks.total})</span>`
          )

          const batchResult = await this._processTrackBatch(currentProcessingBatch, batchNumber)
          allTracksToKeep.push(...batchResult.tracksToKeep)
          totalFilteredOutCount += batchResult.filteredOutCountInBatch
          currentProcessingBatch = []

          this.uiManager.updateResultOutput(
            `<span>🔄 Processed: ${processedTrackCount}/${this.uiManager.selectedPlaylist.tracks.total} | Kept so far: ${allTracksToKeep.length} | Filtered out: ${totalFilteredOutCount}</span>`
          )
        }
      }
      if (currentProcessingBatch.length > 0) {
        batchNumber++
        this.uiManager.updateResultOutput(
          `<span>🔄 Processing final batch ${batchNumber} of tracks... (Processed: ${processedTrackCount}/${this.uiManager.selectedPlaylist.tracks.total})</span>`
        )

        const batchResult = await this._processTrackBatch(currentProcessingBatch, batchNumber)
        allTracksToKeep.push(...batchResult.tracksToKeep)
        totalFilteredOutCount += batchResult.filteredOutCountInBatch

        this.uiManager.updateResultOutput(
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
            console.log('👉 trackUrisToKeep', trackUrisToKeep, Array.isArray(trackUrisToKeep))
            await this.spotifyApiService.addTracksToPlaylist(newPlaylist.id, trackUrisToKeep)

            const invalidUriCount = allTracksToKeep.length - trackUrisToKeep.length
            const successMessage = `✅ Filtering complete! New playlist "${newPlaylist.name}" created with ${trackUrisToKeep.length} tracks. ${totalFilteredOutCount} tracks were filtered out.`
            const invalidUriMessage =
              invalidUriCount > 0 ? ` (${invalidUriCount} tracks had invalid URIs and were skipped)` : ''

            this.uiManager.showSuccess(
              successMessage +
                invalidUriMessage +
                ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`
            )
          } else {
            this.uiManager.showError('No valid track URIs found. Unable to create playlist.')
          }
        }
      } else {
        this.uiManager.showSuccess(
          `ℹ️ Filtering complete. No tracks matched your criteria to be kept. ${totalFilteredOutCount} tracks were filtered out.`
        )
      }
    } catch (error) {
      console.error('❌ Filtering process failed:', error)
      this.uiManager.showError(`Filtering process failed: ${error.message || 'An unknown error occurred.'}`)
    } finally {
      if (startButton) {
        startButton.disabled = false
        startButton.classList.remove('opacity-70')
      }
    }
  }

  // eslint-disable-next-line generator-star-spacing
  async *_fetchPlaylistTracksGenerator() {
    if (!this.uiManager.selectedPlaylist || !this.authService.userId) {
      throw new Error('Playlist or User ID not selected for fetching tracks.')
    }

    const endpoint = `/playlists/${this.uiManager.selectedPlaylist.id}/tracks`
    let offset = 0
    const limit = 50
    let hasMoreData = true
    let batchCount = 0
    let totalFetched = 0

    console.log(`📥 Starting to fetch tracks from playlist: ${this.uiManager.selectedPlaylist.name}`)
    this.uiManager.updateResultOutput(
      `<span>🔄 Fetching tracks from "${this.uiManager.selectedPlaylist.name}"...</span>`
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

        const response = await this.spotifyApiService._apiRequest(endpoint, 'GET', null, params)
        const items = response.items

        if (!items) {
          console.error('No items received!')
          hasMoreData = false
          continue
        }

        const validItems = items.filter((trackItem) => this._isValidSpotifyUri(trackItem.track.uri))

        totalFetched += validItems.length
        console.log(`✅ Batch ${batchCount}: Got ${validItems.length} valid tracks (total: ${totalFetched})`)

        this.uiManager.updateResultOutput(
          `<span>🔄 Fetched ${totalFetched} / ${this.uiManager.selectedPlaylist.tracks.total} tracks...</span>`
        )

        for (const trackItem of validItems) {
          yield trackItem.track
        }

        offset += items.length
        if (!response.next) {
          hasMoreData = false
          console.log(`🏁 Reached end of playlist - total valid tracks: ${totalFetched}`)
        }
      } catch (error) {
        console.error(`❌ Error fetching tracks batch ${batchCount}:`, error)
        this.uiManager.showError(`Error fetching playlist tracks: ${error.message}`)
        hasMoreData = false
      }
    }
  }

  async _processTrackBatch(trackBatch, batchNumber) {
    console.log(`🎵 Processing batch ${batchNumber}: ${trackBatch.length} tracks with bulk API`)

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
          console.log(`🚫 Lyrics not found for "${track.song}" by ${track.artist}. Skipping track.`)
          filteredOutCountInBatch++
          continue
        }

        const isKeywordInLyrics = this.checkKeywordInLyrics(lyrics)

        if (this.filterMode === 'exclude') {
          if (isKeywordInLyrics) {
            console.log(`🚫 EXCLUDE mode: Filtering out "${track.song}" by ${track.artist} (matches keyword).`)
            filteredOutCountInBatch++
          } else {
            console.log(`✅ EXCLUDE mode: Keeping "${track.song}" by ${track.artist}.`)
            tracksToKeep.push(track)
          }
        } else if (this.filterMode === 'include') {
          if (isKeywordInLyrics) {
            tracksToKeep.push(track)
          } else {
            filteredOutCountInBatch++
          }
        }
      }

      const processedTrackIds = new Set(bulkResult.data.map((r) => r.track.id))
      const unprocessedTracks = trackBatch.filter((track) => !processedTrackIds.has(track.id))
      filteredOutCountInBatch += unprocessedTracks.length

      console.log(
        `✅ Batch ${batchNumber} completed - Kept: ${tracksToKeep.length}, Filtered out: ${filteredOutCountInBatch}`
      )
      return { tracksToKeep, filteredOutCountInBatch }
    } catch (error) {
      console.error(`❌ Bulk processing failed for batch ${batchNumber}:`, error)
      throw error
    }
  }

  checkKeywordInLyrics(lyrics) {
    const lowerCaseLyrics = lyrics.toLowerCase()
    for (const keyword of this.uiManager.keywords) {
      if (lowerCaseLyrics.includes(keyword.toLowerCase())) {
        return true
      }
    }
    return false
  }

  _isValidSpotifyUri(uri) {
    if (!uri || typeof uri !== 'string') {
      return false
    }

    // Spotify URIs should start with 'spotify:' and have the format spotify:track:id
    return uri.startsWith('spotify:track:') && uri.length > 14
  }

  async _createFilteredPlaylist() {
    try {
      const originalPlaylist = this.uiManager.selectedPlaylist
      const filterModeText = this.filterMode === 'exclude' ? 'Excluded' : 'Included'
      const keywordsText = this.uiManager.keywords.join(', ')

      const newPlaylistName = `${originalPlaylist.name} - ${filterModeText} (${keywordsText})`
      const description = `Filtered version of "${originalPlaylist.name}" - ${filterModeText} songs with keywords: ${keywordsText}`

      console.log(`🎵 Creating new playlist: "${newPlaylistName}"`)

      const playlistData = {
        name: newPlaylistName,
        description: description,
        public: false,
      }

      const newPlaylist = await this.spotifyApiService.createPlaylist(this.authService.userId, playlistData)
      console.log(`✅ Created new playlist with ID: ${newPlaylist.id}`)

      return newPlaylist
    } catch (error) {
      console.error('❌ Failed to create filtered playlist:', error)
      throw new Error(`Failed to create new playlist: ${error.message}`)
    }
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const authService = new AuthService()
  const spotifyApiService = new SpotifyApiService(authService)

  const uiManager = new UiManager(spotifyApiService, authService)

  new SpotifyPlaylistFilter(authService, spotifyApiService, uiManager)
})
