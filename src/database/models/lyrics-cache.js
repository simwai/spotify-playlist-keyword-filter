const { DataTypes, Sequelize } = require('sequelize')
const { sequelize } = require('../connection.js')

const LyricsCache = sequelize.define('LyricsCache', {
  cacheKey: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  artist: {
    type: DataTypes.STRING,
  },
  song: {
    type: DataTypes.STRING,
  },
  songId: {
    type: DataTypes.STRING,
  },
  lyrics: {
    type: DataTypes.TEXT,
  },
  found: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
})

module.exports = { LyricsCache }
