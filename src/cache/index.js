const path = require('node:path')
const { Sequelize } = require('sequelize')
const { ConsoleLogger } = require('@simwai/utils')
const storage = path.join(__dirname, '../../lyrics_cache.db')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storage,
  logging: false,
})

// Initialize the database
const initializeDatabase = async () => {
  const logger = new ConsoleLogger()

  try {
    await sequelize.authenticate()
    logger.log('✅ Database connection established successfully')

    await sequelize.sync()
    logger.log('✅ Database synchronized')
  } catch (error) {
    logger.error('❌ Database initialization failed:', error)
  }
}

// Initialize immediately
initializeDatabase()

module.exports = sequelize
module.exports.default = sequelize
module.exports.sequelize = sequelize
