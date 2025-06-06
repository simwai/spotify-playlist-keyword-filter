const needle = require('needle')
const config = require('../config/index.js')
const { models } = require('../database/index.js')
const { generateRandomString } = require('../utils/crypto.js')

class LyricsService {
  constructor(geniusClient, lyricsExtractor, cacheKeyGenerator) {
    this.geniusClient = geniusClient
    this.lyricsExtractor = lyricsExtractor
    this.cacheKeyGenerator = cacheKeyGenerator
  }

  async searchSong(artist, song) {
    const cacheKey = this.cacheKeyGenerator.generate(artist, song)

    const cachedResult = await this._getCachedSearch(cacheKey)
    if (cachedResult) {
      console.log('📦 Database cache hit for:', artist, '-', song)
      return this._formatSearchResult(cachedResult)
    }

    console.log(
      '🔍 Database cache miss, searching Genius for:',
      artist,
      '-',
      song
    )

    const searchResult = await this._searchOnGenius(artist, song)
    await this._cacheSearchResult(cacheKey, artist, song, searchResult)

    return searchResult
  }

  async getLyrics(songId) {
    const cachedLyrics = await this._getCachedLyrics(songId)
    if (cachedLyrics) {
      console.log('📦 Database cache hit for lyrics, song ID:', songId)
      return { lyrics: cachedLyrics }
    }

    console.log('🔍 Database cache miss for lyrics, fetching from Genius')

    const lyrics = await this._fetchLyricsFromGenius(songId)

    if (lyrics) {
      await this._cacheLyrics(songId, lyrics)
      return { lyrics }
    }

    return null
  }

  async _getCachedSearch(cacheKey) {
    const cachedResult = await models.LyricsCache.findOne({
      where: { cacheKey },
    })

    if (!cachedResult) {
      return null
    }

    const isExpired =
      Date.now() - new Date(cachedResult.timestamp).getTime() > config.cache.ttl
    return isExpired ? null : cachedResult
  }

  async _getCachedLyrics(songId) {
    const { Sequelize } = require('sequelize')
    const cachedLyrics = await models.LyricsCache.findOne({
      where: {
        songId: songId.toString(),
        lyrics: { [Sequelize.Op.ne]: null },
      },
    })

    return cachedLyrics?.lyrics || null
  }

  async _searchOnGenius(artist, song) {
    const searchQueries = this._generateSearchQueries(artist, song)

    for (const query of searchQueries) {
      const result = await this.geniusClient.search(query)
      if (result) {
        return {
          songId: result.id,
          found: true,
          title: result.title,
          artist: result.artist,
        }
      }
    }

    return { found: false }
  }

  async _fetchLyricsFromGenius(songId) {
    const songInfo = await this.geniusClient.getSong(songId)
    if (!songInfo) {
      return null
    }

    const pageResponse = await needle('get', songInfo.url)
    return this.lyricsExtractor.extract(pageResponse.body)
  }

  async _cacheSearchResult(cacheKey, artist, song, result) {
    await models.LyricsCache.upsert({
      cacheKey,
      artist: result.artist || artist,
      song: result.title || song,
      songId: result.songId?.toString(),
      found: result.found,
      timestamp: new Date(),
    })
  }

  async _cacheLyrics(songId, lyrics) {
    const existingEntry = await models.LyricsCache.findOne({
      where: { songId: songId.toString() },
    })

    if (existingEntry) {
      await existingEntry.update({
        lyrics,
        timestamp: new Date(),
      })
    } else {
      const generatedCacheKey = `songid-${songId}-${generateRandomString(8)}`

      await models.LyricsCache.create({
        cacheKey: generatedCacheKey,
        songId: songId.toString(),
        lyrics,
        found: true,
        timestamp: new Date(),
      })
    }
  }

  _generateSearchQueries(artist, song) {
    return [
      `${song} ${artist}`,
      `${song.replace(/\s*\([^)]*\)/g, '')} ${artist}`,
      `${artist} ${song}`,
      song,
    ]
  }

  _formatSearchResult(cachedResult) {
    return {
      songId: cachedResult.songId,
      found: cachedResult.found,
      title: cachedResult.song,
      artist: cachedResult.artist,
    }
  }
}

module.exports = { LyricsService }
