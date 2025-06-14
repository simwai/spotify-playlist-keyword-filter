window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class TrackProcessor {
  constructor(uiManager) {
    this.uiManager = uiManager
  }

  async processTrackBatch(trackBatch, batchNumber, keyword, filterMode) {
    console.log(
      `<i class="fas fa-music mr-2"></i>Processing batch ${batchNumber}: ${trackBatch.length} tracks with bulk API`
    )

    try {
      const bulkResult =
        await window.SpotifyPlaylistFilter.lyricApi.processTrackBulk(trackBatch)
      console.log(
        `<i class="fas fa-check-circle text-green-600 mr-2"></i>Bulk processing completed: ${bulkResult.results} results from ${bulkResult.processed} tracks`
      )

      const result = this.filterTracksFromBulkResult(
        bulkResult,
        keyword,
        filterMode
      )
      console.log(
        `<i class="fas fa-check-circle text-green-600 mr-2"></i>Batch ${batchNumber} completed - Kept: ${result.tracksToKeep.length}, Filtered out: ${result.filteredOutCount}`
      )

      return result
    } catch (error) {
      console.error(
        `<i class="fas fa-times-circle text-red-600 mr-2"></i>Bulk processing failed for batch ${batchNumber}: ${error.message}`
      )
    }
  }
}

window.SpotifyPlaylistFilter.TrackProcessor = TrackProcessor
