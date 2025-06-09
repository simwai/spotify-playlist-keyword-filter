window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class App {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.userId = null
    this.playlist = []
    this.selectedPlaylist = null
    this.keyword = []
    this.filterMode = 'exclude'

    this.storage = window.SpotifyPlaylistFilter.util.safeSessionStorage()
    this.uiManager = new window.SpotifyPlaylistFilter.UiManager()
    this.trackProcessor = new window.SpotifyPlaylistFilter.TrackProcessor(
      this.uiManager
    )

    this.loadTokenFromStorage()
    this.initializeApp()
  }

  loadTokenFromStorage() {
    this.accessToken = this.storage.getItem('spotify_access_token')
    this.refreshToken = this.storage.getItem('spotify_refresh_token')
    this.userId = this.storage.getItem('spotify_user_id')
  }

  initializeApp() {
    this.parseUrlParam()
    this.setupEventListener()
    this.updateUI()
  }

  parseUrlParam() {
    const hashParam = window.SpotifyPlaylistFilter.util.parseUrlHash()

    if (hashParam.access_token) {
      this.accessToken = hashParam.access_token
      this.storage.setItem('spotify_access_token', this.accessToken)
    }

    if (hashParam.refresh_token) {
      this.refreshToken = hashParam.refresh_token
      this.storage.setItem('spotify_refresh_token', this.refreshToken)
    }

    if (hashParam.uid) {
      this.userId = hashParam.uid
      this.storage.setItem('spotify_user_id', this.userId)
    }

    if (Object.keys(hashParam).length > 0) {
      window.SpotifyPlaylistFilter.util.clearUrlHash()
    }

    const errorMessage = hashParam.error
    if (errorMessage) {
      this.uiManager.showError(decodeURIComponent(errorMessage))
    }
  }

  setupEventListener() {
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

    const filterModeInput = document.querySelectorAll(
      'input[name="filter-mode"]'
    )
    filterModeInput.forEach((input) => {
      input.addEventListener('change', (event) => {
        this.filterMode = event.target.value
        this.uiManager.renderKeyword(this.keyword, this.filterMode, (index) =>
          this.removeKeyword(index)
        )
      })
    })

    const backButton = document.getElementById('back-to-playlists-button')
    backButton?.addEventListener('click', () => {
      this.uiManager.navigateTo('playlist-selection')
    })
  }

  async updateUI() {
    if (this.accessToken) {
      this.spotifyApi = new window.SpotifyPlaylistFilter.SpotifyApi(
        this.accessToken
      )
      this.playlistManager = new window.SpotifyPlaylistFilter.PlaylistManager(
        this.spotifyApi,
        this.uiManager
      )

      if (!this.userId) {
        try {
          const userData = await this.spotifyApi.getCurrentUser()
          this.userId = userData.id
          this.storage.setItem('spotify_user_id', this.userId)
        } catch (error) {
          this.handleAuthError()
          return
        }
      }

      this.loadPlaylist()
    } else {
      this.uiManager.navigateTo('login')
    }
  }

  handleAuthError() {
    this.accessToken = null
    this.refreshToken = null
    this.userId = null
    this.storage.removeItem('spotify_access_token')
    this.storage.removeItem('spotify_refresh_token')
    this.storage.removeItem('spotify_user_id')
    this.uiManager.navigateTo('login')
    this.uiManager.showError(
      'Session expired or token invalid. Please log in again.'
    )
  }

  async loadPlaylist() {
    if (!this.accessToken) {
      this.uiManager.showError('Access token not available. Please log in.')
      this.uiManager.navigateTo('login')
      return
    }

    if (!this.userId) {
      this.uiManager.showError(
        'User ID not available. Please try logging in again.'
      )
      this.uiManager.navigateTo('login')
      return
    }

    try {
      this.playlist = await this.playlistManager.loadUserPlaylist()
      this.uiManager.renderPlaylist(this.playlist)
      this.uiManager.setCachedPlaylist(this.playlist)
      this.uiManager.navigateTo('playlist-selection')
      this.uiManager.initTableSort()
      this.uiManager.setupPlaylistClickHandler((playlist) =>
        this.selectPlaylist(playlist)
      )
    } catch (error) {
      console.error('Error loading playlists:', error)
      this.uiManager.showError(`Failed to load playlists: ${error.message}`)
    }
  }

  selectPlaylist(playlist) {
    this.selectedPlaylist = playlist
    console.log('Selected playlist:', playlist.name, playlist.id)
    this.uiManager.navigateTo('tag-form', { playlist })
    this.uiManager.updateResultOutput('')
  }

  addKeyword() {
    const tagInput = document.getElementById('tag-input')
    const keyword = tagInput.value.trim()

    if (keyword && !this.keyword.includes(keyword)) {
      this.keyword.push(keyword)
      this.uiManager.renderKeyword(this.keyword, this.filterMode, (index) =>
        this.removeKeyword(index)
      )
      tagInput.value = ''
      this.uiManager.updateStartButtonVisibility(this.keyword.length > 0)
    }
  }

  removeKeyword(index) {
    this.keyword.splice(index, 1)
    this.uiManager.renderKeyword(this.keyword, this.filterMode, (index) =>
      this.removeKeyword(index)
    )
    this.uiManager.updateStartButtonVisibility(this.keyword.length > 0)
  }

  async startFiltering() {
    if (!this.selectedPlaylist || this.keyword.length === 0) {
      this.uiManager.showError('Please select a playlist and add keywords.')
      return
    }

    this.uiManager.setStartButtonLoading(true)
    this.uiManager.showLoadingSpinner('Starting filter process...')

    try {
      let processedTrackCount = 0
      let totalFilteredOutCount = 0
      const allTracksToKeep = []
      const batchSize =
        window.SpotifyPlaylistFilter.config.spotify.batchSize.processing
      let currentProcessingBatch = []
      let batchNumber = 0

      const trackGenerator = this.playlistManager.fetchPlaylistTracksGenerator(
        this.selectedPlaylist
      )

      for await (const track of trackGenerator) {
        currentProcessingBatch.push(track)
        processedTrackCount++

        if (
          currentProcessingBatch.length >= batchSize ||
          processedTrackCount === this.selectedPlaylist.tracks.total
        ) {
          batchNumber++
          this.uiManager.updateResultOutput(
            `<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Processing batch ${batchNumber} of tracks for lyrics & filtering... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
          )

          const batchResult = await this.trackProcessor.processTrackBatch(
            currentProcessingBatch,
            batchNumber,
            this.keyword,
            this.filterMode
          )

          allTracksToKeep.push(...batchResult.tracksToKeep)
          totalFilteredOutCount += batchResult.filteredOutCount
          currentProcessingBatch = []

          this.uiManager.updateResultOutput(
            `<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total} | Kept so far: ${allTracksToKeep.length} | Filtered out: ${totalFilteredOutCount}</span>`
          )
        }
      }

      if (currentProcessingBatch.length > 0) {
        batchNumber++
        this.uiManager.updateResultOutput(
          `<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Processing final batch ${batchNumber} of tracks... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
        )

        const batchResult = await this.trackProcessor.processTrackBatch(
          currentProcessingBatch,
          batchNumber,
          this.keyword,
          this.filterMode
        )

        allTracksToKeep.push(...batchResult.tracksToKeep)
        totalFilteredOutCount += batchResult.filteredOutCount

        this.uiManager.updateResultOutput(
          `<span><i class="fas fa-flag-checkered mr-2"></i>Track processing complete. Total Processed: ${processedTrackCount} | Total Kept: ${allTracksToKeep.length} | Total Filtered Out: ${totalFilteredOutCount}</span>`
        )
      }

      if (allTracksToKeep.length > 0) {
        const newPlaylist = await this.playlistManager.createFilteredPlaylist(
          this.selectedPlaylist,
          this.userId,
          this.keyword,
          this.filterMode
        )

        if (newPlaylist && newPlaylist.id) {
          const trackUriToKeep = allTracksToKeep
            .map((track) => track.uri)
            .filter((uri) => uri && typeof uri === 'string')

          console.log(
            `<i class="fas fa-chart-bar mr-2"></i>Track URI validation: ${allTracksToKeep.length} tracks -> ${trackUriToKeep.length} valid URIs`
          )

          if (trackUriToKeep.length > 0) {
            await this.playlistManager.addTracksToPlaylist(
              newPlaylist.id,
              trackUriToKeep
            )

            const invalidUriCount =
              allTracksToKeep.length - trackUriToKeep.length
            const successMessage = `<i class="fas fa-check-circle text-green-600 mr-2"></i>Filtering complete! New playlist "${newPlaylist.name}" created with ${trackUriToKeep.length} tracks. ${totalFilteredOutCount} tracks were filtered out.`
            const invalidUriMessage =
              invalidUriCount > 0
                ? ` (${invalidUriCount} tracks had invalid URIs and were skipped)`
                : ''

            this.uiManager.showSuccess(
              successMessage +
                invalidUriMessage +
                ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`
            )
          } else {
            this.uiManager.showError(
              'No valid track URIs found. Unable to create playlist.'
            )
          }
        }
      } else {
        this.uiManager.showSuccess(
          `<i class="fas fa-info-circle text-blue-600 mr-2"></i>Filtering complete. No tracks matched your criteria to be kept. ${totalFilteredOutCount} tracks were filtered out.`
        )
      }
    } catch (error) {
      console.error(
        '<i class="fas fa-times-circle text-red-600 mr-2"></i>Filtering process failed:',
        error
      )
      this.uiManager.showError(
        `Filtering process failed: ${error.message || 'An unknown error occurred.'}`
      )
    } finally {
      this.uiManager.setStartButtonLoading(false)
    }
  }
}

window.SpotifyPlaylistFilter.App = App
