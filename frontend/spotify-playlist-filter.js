class SpotifyPlaylistFilter {
  constructor(spotifyApiService, lyricsService, uiManager) {
    this.spotifyApiService = spotifyApiService
    this.lyricsService = lyricsService
    this.uiManager = uiManager
  }

  async initializeFilterProcess() {
    /* 🔄 always work with the *current* state */
    this.playlist = window.appState.selectedPlaylist
    this.keywords = window.appState.keywords
    this.filterMode = window.appState.filterMode

    if (!this.playlist) {
      this.uiManager.showError('Please select a playlist.')
      return
    }
    if (this.keywords.length === 0) {
      this.uiManager.showError('Please add keywords.')
      return
    }

    this.uiManager.toggleStartButton(true)
    this.uiManager.updateResultOutput(
      `<div class="flex items-center justify-center py-4 gap-3">
        <div class="inline-flex items-center justify-center w-6 h-6 border-2 border-t-transparent border-spotify-green rounded-full animate-spin" role="status"></div>
        <span class="text-gray-800">🚀 Starting filter process...</span>
      </div>`
    )

    try {
      const result = await this._filterTracks()

      if (result.tracksToKeep.length > 0) {
        await this._createPlaylistFromFilteredTracks(this.playlist, result)
      } else {
        this.uiManager.updateResultOutput(
          `ℹ️ Filtering complete. No tracks matched your criteria to be kept. ${result.filteredOutCount} tracks were filtered out.`
        )
      }
    } catch (error) {
      console.error('❌ Filtering process failed:', error)
      this.uiManager.showError(
        `Filtering process failed: ${error.message || 'An unknown error occurred.'}`
      )
    } finally {
      this.uiManager.toggleStartButton(false)
    }
  }

  async _filterTracks() {
    let processedTrackCount = 0
    let totalFilteredOutCount = 0
    const allTracksToKeep = []
    const BATCH_SIZE_PROCESSING = 10
    let currentProcessingBatch = []
    let batchNumber = 0

    const trackGenerator = this.spotifyApiService.fetchPlaylistTracks(
      this.playlist
    )

    for await (const track of trackGenerator) {
      currentProcessingBatch.push(track)
      processedTrackCount++

      const isLastTrack = processedTrackCount === this.playlist.tracks.total
      if (
        currentProcessingBatch.length >= BATCH_SIZE_PROCESSING ||
        isLastTrack
      ) {
        batchNumber++
        this.uiManager.updateResultOutput(
          `<span>🔄 Processing batch ${batchNumber}... (Processed: ${processedTrackCount}/${this.playlist.tracks.total})</span>`
        )

        const batchResult = await this._processTrackBatch(
          currentProcessingBatch,
          batchNumber
        )

        allTracksToKeep.push(...batchResult.tracksToKeep)
        totalFilteredOutCount += batchResult.filteredOutCountInBatch
        currentProcessingBatch = []

        this.uiManager.updateResultOutput(
          `<span>🔄 Processed: ${processedTrackCount}/${this.playlist.tracks.total} | Kept: ${allTracksToKeep.length} | Filtered: ${totalFilteredOutCount}</span>`
        )
      }
    }

    this.uiManager.updateResultOutput(
      `<span>🏁 Track processing complete. Total Processed: ${processedTrackCount} | Total Kept: ${allTracksToKeep.length} | Total Filtered Out: ${totalFilteredOutCount}</span>`
    )

    return {
      tracksToKeep: allTracksToKeep,
      filteredOutCount: totalFilteredOutCount,
    }
  }

  async _processTrackBatch(trackBatch, batchNumber) {
    console.log(
      `🎵 Processing batch ${batchNumber}: ${trackBatch.length} tracks.`
    )
    const resultsWithLyrics =
      await this.lyricsService.processTracksBatch(trackBatch)

    const tracksToKeep = []
    let filteredOutCountInBatch = 0

    for (const result of resultsWithLyrics) {
      const { track, lyrics } = result

      if (!lyrics) {
        filteredOutCountInBatch++
        continue
      }

      const hasKeyword = this._checkKeywordInLyrics(lyrics, this.keywords)
      const shouldKeep =
        (this.filterMode === 'exclude' && !hasKeyword) ||
        (this.filterMode === 'include' && hasKeyword)
      if (shouldKeep) {
        tracksToKeep.push(track)
      } else {
        filteredOutCountInBatch++
      }
    }

    console.log(
      `✅ Batch ${batchNumber} completed - Kept: ${tracksToKeep.length}, Filtered out: ${filteredOutCountInBatch}`
    )
    return { tracksToKeep, filteredOutCountInBatch }
  }

  _checkKeywordInLyrics(lyrics) {
    const lowerCaseLyrics = lyrics.toLowerCase()
    for (const keyword of this.keywords) {
      if (lowerCaseLyrics.includes(keyword.toLowerCase())) {
        return true
      }
    }
    return false
  }

  async _createPlaylistFromFilteredTracks(originalPlaylist, filterResult) {
    this.uiManager.updateResultOutput(
      '<span>✨ Creating your new filtered playlist...</span>'
    )
    const newPlaylist = await this._createFilteredPlaylist(originalPlaylist)
    if (!newPlaylist || !newPlaylist.id) {
      throw new Error('Failed to create the new playlist on Spotify.')
    }
    const trackUrisToKeep = filterResult.tracksToKeep
      .map((track) => track.uri)
      .filter((uri) => this.spotifyApiService.isValidSpotifyUri(uri))

    if (trackUrisToKeep.length > 0) {
      await this.spotifyApiService.addTracksToPlaylist(
        newPlaylist.id,
        trackUrisToKeep
      )

      const invalidUriCount =
        filterResult.tracksToKeep.length - trackUrisToKeep.length
      let successMessage = `✅ Success! New playlist "${newPlaylist.name}" created with ${trackUrisToKeep.length} tracks. ${filterResult.filteredOutCount} tracks were filtered out.`
      if (invalidUriCount > 0) {
        successMessage += ` (${invalidUriCount} tracks were skipped due to invalid URIs).`
      }
      successMessage += ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`

      this.uiManager.updateResultOutput(successMessage)
    } else {
      this.uiManager.showError(
        'Filtering complete, but no valid tracks were left to add to a new playlist.'
      )
    }
  }

  _createFilteredPlaylist(originalPlaylist) {
    const filteredPlaylistName = `${originalPlaylist.name} (Filtered)`
    const description = `Filtered version of "${originalPlaylist.name}" - based on keyword filtering.`

    return this.spotifyApiService.createPlaylist(
      filteredPlaylistName,
      description,
      false
    )
  }
}
export default SpotifyPlaylistFilter
