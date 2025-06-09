const express = require('express')

module.exports = (container) => {
  const router = express.Router()

  router.get('/search', async (req, res) => {
    try {
      const { artist, song } = req.query

      if (!artist || !song) {
        return res.status(400).json({
          error: 'Both artist and song parameters are required',
        })
      }

      const lyricsService =
        container.lyricsService || container.get('LyricsService')

      if (!lyricsService) {
        return res.status(503).json({
          error: 'Lyrics service not available',
        })
      }

      const result = await lyricsService.searchSong(artist, song)

      if (result) {
        res.json({ found: true, songId: result.id })
      } else {
        res.json({ found: false })
      }
    } catch (error) {
      console.error('Error searching lyrics:', error)
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/:songId', async (req, res) => {
    try {
      const { songId } = req.params

      const lyricsService =
        container.lyricsService || container.get('LyricsService')

      if (!lyricsService) {
        return res.status(503).json({
          error: 'Lyrics service not available',
        })
      }

      const lyrics = await lyricsService.getLyrics(songId)

      if (lyrics) {
        res.json({ lyrics })
      } else {
        res.status(404).json({ error: 'Lyrics not found' })
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error)
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/bulk-process', async (req, res) => {
    try {
      const { tracks } = req.body

      if (!tracks || !Array.isArray(tracks)) {
        return res.status(400).json({
          error: 'Tracks array required',
        })
      }

      const lyricsService =
        container.lyricsService || container.get('LyricsService')

      if (!lyricsService) {
        return res.status(503).json({
          error: 'Lyrics service not available',
        })
      }
      const results = await lyricsService.processTracksBatch(tracks)

      res.json({
        processed: tracks.length,
        results: results.length,
        data: results.map((result) => ({
          track: result.track,

          lyrics: result.lyrics,
        })),
      })
    } catch (error) {
      console.error('Error in bulk processing:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
