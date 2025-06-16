// TODO Add backend tests
const express = require('express')

const { setupMiddleware } = require('./middleware/index.js')
const { setupRoutes } = require('./routes/index.js')
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/error-handler.js')
const config = require('./config/index.js')
const { createContainer } = require('./container.js')

const _removePortInUrl = (url) => {
  return url.replace(/:\d+/, '')
}

// Main / Index
async function run() {
  const app = express()
  const container = await createContainer()

  setupMiddleware(app)
  setupRoutes(app, container)

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.listen(config.app.port, () => {
    container.logger.log(
      `🚀 Server running on ${_removePortInUrl(config.app.frontendUrl)}:${config.app.port}`
    )
  })
}

run()
