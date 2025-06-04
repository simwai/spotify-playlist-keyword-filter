const authRoutes = require('./auth.js')
const lyricsRoutes = require('./lyrics.js')
const adminRoutes = require('./admin.js')
const staticRoutes = require('./static.js')

function setupRoutes(app) {
  app.use('/', staticRoutes)
  app.use('/', authRoutes)
  app.use('/api/lyrics', lyricsRoutes)
  app.use('/api/admin', adminRoutes)
}

module.exports = { setupRoutes }
