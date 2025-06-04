const { sequelize } = require('./connection.js')
const { LyricsCache } = require('./models/lyrics-cache.js')

async function initDatabase() {
  try {
    await sequelize.authenticate()
    console.log('✅ Database connection established successfully')

    await sequelize.sync()
    console.log('✅ Database synchronized')
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error)
    throw error
  }
}

module.exports = {
  sequelize,
  initDatabase,
  models: {
    LyricsCache,
  },
}
