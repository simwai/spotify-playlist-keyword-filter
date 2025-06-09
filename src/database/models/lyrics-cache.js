const { DataTypes, Sequelize } = require('sequelize')
const { sequelize } = require('../connection.js')

const LyricsCache = sequelize.define(
  'LyricsCache',
  {
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
  },
  {
    indexes: [
      {
        name: 'idx_cache_key',
        fields: ['cacheKey'],
      },
      {
        name: 'idx_song_id_lyrics',
        fields: ['songId', 'lyrics'],
      },
      {
        name: 'idx_timestamp',
        fields: ['timestamp'],
      },
      {
        name: 'composite_cache_key_timestamp',
        fields: ['cacheKey', 'timestamp'],
      },
    ],
  }
)

module.exports = { LyricsCache }
