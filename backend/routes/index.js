const path = require('path')
const express = require('ultimate-express')

const authRoutes = require('./auth.js')
const lyricsRoutes = require('./lyrics.js')
const { SpotifyRoutes } = require('./spotify.js')

function setupRoutes(app, container) {
  app.use(express.static(path.join(__dirname, '../../frontend')))

  app.use('/', authRoutes(container))
  app.use('/api/lyrics', lyricsRoutes(container))
  app.use('/api/spotify', SpotifyRoutes(container))

  app.get('*', (req, res) => {
    if (
      !req.path.startsWith('/api') &&
      req.path !== '/login' &&
      req.path !== '/callback' &&
      req.path !== '/refresh_token'
    ) {
      res.sendFile(path.join(__dirname, '../../frontend/index.html'))
    }
  })
}

module.exports.setupRoutes = setupRoutes
