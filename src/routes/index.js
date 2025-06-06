const authRoutes = require('./auth.js')
const lyricsRoutes = require('./lyrics.js')
const path = require('path')
const express = require('express')

function setupRoutes(app, container) {
  app.use(express.static(path.join(__dirname, '../../frontend')))

  app.use('/', authRoutes(container))
  app.use('/api/lyrics', lyricsRoutes(container))

  app.get('*', (req, res) => {
    // Only redirect if it's not an API call, login, or callback
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

module.exports = { setupRoutes }
