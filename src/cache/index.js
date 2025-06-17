const path = require('node:path')
const { Sequelize } = require('sequelize')
const storage = path.join(__dirname, '../../lyrics_cache.db')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storage,
  logging: false,
  pool: {
    max: 20, // Maximum number of connection pool
    min: 5, // Minimum number of connection pool
    acquire: 60000, // Maximum time (ms) to get a connection
    idle: 10000, // Maximum time (ms) a connection can be idle
  },
})

// Initialize the database
const initializeDatabase = async (logger) => {
  try {
    await sequelize.authenticate()
    logger.log('✅ Database connection established successfully')

    const sequelizeInstance = await sequelize.sync()
    logger.log('✅ Database synchronized')

    await sequelize.query('PRAGMA journal_mode=WAL')
    await sequelize.query('PRAGMA cache_size=-20000') // ~20MB cache
    await sequelize.query('PRAGMA synchronous=NORMAL')
    return sequelizeInstance
  } catch (error) {
    logger.error('❌ Database initialization failed:', error)
  }
}

module.exports = sequelize
module.exports.default = sequelize
module.exports.sequelize = sequelize
module.exports.initializeDatabase = initializeDatabase
