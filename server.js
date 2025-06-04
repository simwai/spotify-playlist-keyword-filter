const app = require('./src/app.js')
const config = require('./src/config/index.js')
const { initDatabase } = require('./src/database/index.js')

async function startServer() {
  try {
    await initDatabase()

    const port = config.server.port
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    throw new Error('Server startup failed')
  }
}

if (require.main === module) {
  startServer()
}

module.exports = app
