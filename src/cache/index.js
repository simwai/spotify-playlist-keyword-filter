const path = require('node:path')
const { Sequelize } = require('sequelize')

const storage = path.join(__dirname, '../../lyrics_cache.db')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storage,
  logging: false,
})

// Initialize the database
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate()
    console.log('✅ Database connection established successfully')

    await sequelize.sync()
    console.log('✅ Database synchronized')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
  }
}

// Initialize immediately
initializeDatabase()

module.exports = sequelize
module.exports.default = sequelize
module.exports.sequelize = sequelize
