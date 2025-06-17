const { DataTypes, Sequelize } = require('sequelize')
const sequelize = require('./index.js')

const LyricsCache = sequelize.define(
  'LyricsCache',
  {
    songId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    artist: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    song: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lyrics: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
  },
  {
    indexes: [
      // Composite index for fast artist+song lookups
      {
        unique: true,
        fields: ['artist', 'song'],
      },
      // Index for songId lookups
      {
        fields: ['songId'],
      },
    ],
  }
)

module.exports = LyricsCache
module.exports.default = LyricsCache
module.exports.LyricsCache = LyricsCache
