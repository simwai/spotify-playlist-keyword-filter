const { Sequelize } = require('sequelize')
const path = require('path')

let sequelize

if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // Use Postgres in production if available
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  })
  console.log('Using Postgres database')
} else {
  // Fall back to SQLite
  const storage =
    process.env.NODE_ENV === 'production'
      ? '/tmp/lyrics_cache.sqlite'
      : path.join(__dirname, '../../lyrics_cache.sqlite')

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storage,
    logging: false,
  })
  console.log('Using SQLite database at:', storage)
}

module.exports = { sequelize }
