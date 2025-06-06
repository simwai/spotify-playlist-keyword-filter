const express = require('express')
const { TYPES } = require('../types.js')

module.exports = (container) => {
  if (!container) {
    throw new Error('Container is required for lyrics routes')
  }

  const router = express.Router()
  let lyricsService
  try {
    console.log('🔍 Resolving LyricsService from container...')
    lyricsService = container.get(TYPES.LyricsService)
    console.log('✅ LyricsService resolved successfully')
  } catch (error) {
    console.error('❌ Failed to resolve LyricsService:', error.message)
    console.log('📋 Available services:', container.listServices())
    throw new Error(`Route initialization failed: ${error.message}`)
  }

  router.get('/search', async (req, res) => {
    try {
      const { artist, song } = req.query

      if (!artist || !song) {
        return res.status(400).json({
          error: 'Artist and song parameters are required',
          received: { artist, song },
        })
      }

      const searchResult = await lyricsService.searchSong(artist, song)
      res.json(searchResult)
    } catch (error) {
      console.error('❌ Search error:', error)
      res.status(500).json({
        error: 'Failed to search for song',
        details: error.message,
      })
    }
  })

  router.get('/:songId', async (req, res) => {
    try {
      const { songId } = req.params
      if (!songId) {
        return res.status(400).json({ error: 'Song ID is required' })
      }

      const lyricsResult = await lyricsService.getLyrics(songId)

      if (!lyricsResult) {
        return res
          .status(404)
          .json({ error: 'Lyrics not found for the given song ID' })
      }
      res.json(lyricsResult)
    } catch (error) {
      console.error('❌ Lyrics fetch error:', error)
      res.status(500).json({
        error: 'Failed to fetch lyrics',
        details: error.message,
      })
    }
  })

  return router
}
