const express = require('express')
const { LyricsService } = require('../services/lyrics.js')

const router = express.Router()
const lyricsService = new LyricsService()

router.get('/search', async (req, res) => {
  try {
    const { artist, song } = req.query

    if (!artist || !song) {
      return res.status(400).json({ error: 'Artist and song are required' })
    }

    const result = await lyricsService.searchSong(artist, song)
    res.json(result)
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
    const result = await lyricsService.getLyrics(songId)

    if (!result) {
      return res.status(404).json({ error: 'Lyrics not found' })
    }

    res.json(result)
  } catch (error) {
    console.error('❌ Lyrics fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch lyrics' })
  }
})

module.exports = router
