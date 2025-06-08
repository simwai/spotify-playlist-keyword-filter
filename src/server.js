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

const container = setupContainer()
const app = express()

setupMiddleware(app)
setupRoutes(app, container)

app.use(notFoundHandler)
app.use(errorHandler)

const startServer = async () => {
  try {
    await initDatabase()

    const server = app.listen(config.app.port, () => {
      console.log(
        `🚀 Server running on ${config.app.frontendUrl}:${config.app.port}`
      )
    })

    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`)
      server.close(() => {
        console.log('✅ HTTP server closed')
        throw new Error('Server shutdown')
      })
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('💥 Failed to start server:', error)
  }
}

startServer()
