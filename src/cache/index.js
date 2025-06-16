const path = require('node:path')
const { Sequelize } = require('sequelize')
const storage = path.join(__dirname, '../../lyrics_cache.db')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storage,
  logging: false,
})

// Initialize the database
const initializeDatabase = async (logger) => {
  try {
    await sequelize.authenticate()
    logger.log('✅ Database connection established successfully')

    const sequelizeInstance = await sequelize.sync()
    logger.log('✅ Database synchronized')
    return sequelizeInstance
  } catch (error) {
    logger.error('❌ Database initialization failed:', error)
  }
}

module.exports = sequelize
module.exports.default = sequelize
module.exports.sequelize = sequelize
module.exports.initializeDatabase = initializeDatabase
