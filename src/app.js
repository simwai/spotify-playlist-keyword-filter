const express = require('express')
const { setupMiddleware } = require('./middleware/index.js')
const { setupRoutes } = require('./routes/index.js')
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/error-handler.js')

const app = express()

setupMiddleware(app)
setupRoutes(app)

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
