class LyricsService {
  constructor() {
    this.apiBaseUrl = window.location.origin // Assumes frontend and backend are on the same domain
  }

  /**
   * Sends a batch of tracks to the backend to get lyrics for all of them.
   * @param {Array<Object>} trackBatch - An array of track objects.
   * @returns {Promise<Array<Object>>} - A promise that resolves to an array of results,
   *                                      where each result is { track, lyrics }.
   */
  async processTracksBatch(trackBatch) {
    if (!trackBatch || trackBatch.length === 0) {
      return []
    }

    console.log(
      `🎤 Sending batch of ${trackBatch.length} tracks to backend for lyrics processing.`
    )

    const requestPayload = {
      tracks: trackBatch.map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists,
      })),
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/lyrics/bulk-process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        }
      )

      if (!response.ok) {
        throw new Error(
          `Backend lyrics processing failed with status: ${response.status}`
        )
      }

      const bulkResult = await response.json()

      return bulkResult.data || []
    } catch (error) {
      console.error(
        '❌ Error in LyricsService while processing track batch:',
        error
      )

      return []
    }
  }
}

export default LyricsService
