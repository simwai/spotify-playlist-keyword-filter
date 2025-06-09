const express = require('express')
const { setupMiddleware } = require('./middleware/index.js')
const { setupRoutes } = require('./routes/index.js')
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/error-handler.js')
const { setupContainer } = require('./container/index.js')
const config = require('./config/index.js')
const { initDatabase } = require('./database/index.js')

// Setup Express app
const container = setupContainer()
const app = express()

setupMiddleware(app)
setupRoutes(app, container)

app.use(notFoundHandler)
app.use(errorHandler)

const startServer = async () => {
  try {
    await initDatabase()

    app.listen(config.app.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.app.port}`)
    })
  } catch (error) {
    console.error('💥 Failed to start server:', error)
  }
}

startServer()
