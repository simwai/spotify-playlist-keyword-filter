const { models } = require('../database/index.js')

class AdminService {
  async clearCache() {
    await models.LyricsCache.destroy({ where: {} })
    console.log('🧹 Cache cleared')
  }

  async getCacheStats() {
    const { Sequelize } = require('sequelize')

    const totalEntries = await models.LyricsCache.count()
    const entriesWithLyrics = await models.LyricsCache.count({
      where: { lyrics: { [Sequelize.Op.ne]: null } },
    })

    return {
      totalEntries,
      entriesWithLyrics,
      entriesWithoutLyrics: totalEntries - entriesWithLyrics,
    }
  }
}

module.exports = { AdminService }
