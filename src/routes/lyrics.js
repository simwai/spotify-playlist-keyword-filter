const express = require('express')

module.exports = (container) => {
  const router = express.Router()

  router.post('/bulk-process', async (req, res) => {
    const { tracks } = req.body
    if (!tracks) {
      return res.status(400).json({
        error: 'Invalid tracks array provided to /bulk-process',
      })
    }

    const lyricsService = container.lyricsService
    if (!lyricsService) {
      return res.status(503).json({
        error: 'Lyrics service not available',
      })
    }

    try {
      const trackRequests = tracks.map((track) => ({
        artist: track.artists[0].name,
        song: track.name,
        uri: track.uri,
        spotifyId: track.id,
      }))

      const results = []
      for await (const result of lyricsService.processTracksBatch(
        trackRequests
      )) {
        results.push(result)
      }

      res.json({
        processed: tracks.length,
        results: results.length,
        data: results,
      })
    } catch (error) {
      container.logger.error('Error in bulk processing:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
