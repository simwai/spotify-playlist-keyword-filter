const needle = require('needle')
const config = require('../config/index.js')
const { models } = require('../database/index.js')
const { generateRandomString } = require('../utils/crypto.js')
const { Sequelize } = require('sequelize')

class LyricsService {
  constructor(geniusClient, lyricsExtractor, cacheKeyGenerator) {
    this.geniusClient = geniusClient
    this.lyricsExtractor = lyricsExtractor
    this.cacheKeyGenerator = cacheKeyGenerator
  }

  async getBulkCachedResults(trackRequests, chunkSize = 25, maxParallel = 10) {
    const cacheKeys = trackRequests.map(({ artist, song }) =>
      this.cacheKeyGenerator.generate(artist, song)
    )

    console.log(
      `🔍 Parallel bulk cache lookup for ${cacheKeys.length} tracks (${maxParallel} parallel chunks of ${chunkSize})`
    )

    const { Sequelize } = require('sequelize')

    const chunks = this._chunkArray(cacheKeys, chunkSize)
    const cacheMap = new Map()

    const parallelLimit = Math.min(maxParallel, chunks.length)

    for (let i = 0; i < chunks.length; i += parallelLimit) {
      const chunkBatch = chunks.slice(i, i + parallelLimit)

      console.log(
        `📊 Processing cache chunk batch ${Math.floor(i / parallelLimit) + 1}/${Math.ceil(chunks.length / parallelLimit)} (${chunkBatch.length} chunks)`
      )

      const chunkPromises = chunkBatch.map(async (chunk, index) => {
        try {
          const chunkResults = await models.LyricsCache.findAll({
            where: {
              cacheKey: { [Sequelize.Op.in]: chunk },
            },
            raw: true,
          })

          console.log(
            `✅ Chunk ${i + index + 1}: Found ${chunkResults.length}/${chunk.length} cached results`
          )
          return chunkResults
        } catch (error) {
          console.error(
            `❌ Error fetching cache chunk ${i + index + 1}:`,
            error
          )
          throw error
        }
      })

      const chunkResults = await Promise.allSettled(chunkPromises)

      for (const settledResult of chunkResults) {
        if (settledResult.status !== 'fulfilled') {
          console.warn('Chunk promise rejected:', settledResult.reason)
          continue
        }

        for (const result of settledResult.value) {
          const isExpired =
            Date.now() - new Date(result.timestamp).getTime() > config.cache.ttl
          if (!isExpired) {
            cacheMap.set(result.cacheKey, result)
          }
        }
      }
    }

    return trackRequests.map(({ artist, song }) => {
      const cacheKey = this.cacheKeyGenerator.generate(artist, song)
      const cached = cacheMap.get(cacheKey)
      return {
        artist,
        song,
        cacheKey,
        cached: cached ? this._formatSearchResult(cached) : null,
        lyrics: cached?.lyrics || null,
      }
    })
  }

  async getBulkCachedLyrics(songIds, chunkSize = 25, maxParallel = 10) {
    console.log(
      `🔍 Parallel bulk lyrics cache lookup for ${songIds.length} song IDs`
    )

    const chunks = this._chunkArray(songIds, chunkSize)
    const lyricsMap = new Map()

    const parallelLimit = Math.min(maxParallel, chunks.length)

    for (let i = 0; i < chunks.length; i += parallelLimit) {
      const chunkBatch = chunks.slice(i, i + parallelLimit)

      console.log(
        `📊 Processing lyrics chunk batch ${Math.floor(i / parallelLimit) + 1}/${Math.ceil(chunks.length / parallelLimit)} (${chunkBatch.length} chunks)`
      )

      const chunkPromises = chunkBatch.map(async (chunk, index) => {
        const chunkResults = await models.LyricsCache.findAll({
          where: {
            songId: { [Sequelize.Op.in]: chunk.map((id) => id.toString()) },
            lyrics: { [Sequelize.Op.ne]: null },
          },
          attributes: ['songId', 'lyrics'],
          raw: true,
        })

        console.log(
          `✅ Lyrics chunk ${i + index + 1}: Found ${chunkResults.length}/${chunk.length} cached lyrics`
        )
        return chunkResults
      })

      const chunkResults = await Promise.allSettled(chunkPromises)
      const successfulResults = chunkResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
      for (const result of successfulResults) {
        lyricsMap.set(result.songId, result.lyrics)
      }
    }

    return songIds.map((songId) => ({
      songId,
      lyrics: lyricsMap.get(songId.toString()) || null,
    }))
  }

  _chunkArray(array, chunkSize) {
    const chunks = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  async processTracksBatch(tracks, cacheChunkSize = 50, maxParallel = 20) {
    console.log(
      `🎵 Processing batch of ${tracks.length} tracks with optimized parallel cache lookup (${maxParallel} parallel chunks)`
    )

    const trackRequests = tracks.map((track) => ({
      artist: track.artists[0].name,
      song: track.name,
      track: track,
    }))

    const startTime = Date.now()
    const cacheResults = await this.getBulkCachedResults(
      trackRequests,
      cacheChunkSize,
      maxParallel
    )
    const cacheTime = Date.now() - startTime
    console.log(`⚡ Cache lookup completed in ${cacheTime}ms`)

    const results = []
    const uncachedTracks = []

    for (const result of cacheResults) {
      if (result.cached && result.cached.found && result.lyrics) {
        console.log(`📦 Complete cache hit: ${result.artist} - ${result.song}`)
        results.push({
          track: result.track,
          searchResult: result.cached,
          lyrics: result.lyrics,
        })
      } else if (result.cached && result.cached.found && !result.lyrics) {
        console.log(`📦 Partial cache hit: ${result.artist} - ${result.song}`)
        uncachedTracks.push({
          ...result,
          needsLyrics: true,
        })
      } else {
        console.log(`❌ Cache miss: ${result.artist} - ${result.song}`)
        uncachedTracks.push({
          ...result,
          needsSearch: true,
        })
      }
    }

    if (uncachedTracks.length > 0) {
      const PARALLEL_LIMIT = 10
      console.log(
        `🔄 Processing ${uncachedTracks.length} uncached tracks with ${PARALLEL_LIMIT} parallel requests`
      )

      const uncachedResults = await this._processUncachedTracksParallel(
        uncachedTracks,
        PARALLEL_LIMIT
      )
      results.push(...uncachedResults)
    }

    return results
  }

  async _processUncachedTracksParallel(uncachedTracks, parallelLimit) {
    const results = []

    for (let i = 0; i < uncachedTracks.length; i += parallelLimit) {
      const chunk = uncachedTracks.slice(i, i + parallelLimit)

      const chunkPromises = chunk.map(async (trackData) => {
        try {
          if (trackData.needsSearch) {
            const searchResult = await this._searchOnGenius(
              trackData.artist,
              trackData.song
            )
            await this._cacheSearchResult(
              trackData.cacheKey,
              trackData.artist,
              trackData.song,
              searchResult
            )

            if (searchResult.found && searchResult.songId) {
              const lyrics = await this._fetchLyricsFromGenius(
                searchResult.songId
              )
              if (lyrics) {
                await this._cacheLyrics(searchResult.songId, lyrics)
                return {
                  track: trackData.track,
                  searchResult,
                  lyrics,
                }
              }
            }
          } else if (trackData.needsLyrics) {
            const lyrics = await this._fetchLyricsFromGenius(
              trackData.cached.songId
            )
            if (lyrics) {
              await this._cacheLyrics(trackData.cached.songId, lyrics)
              return {
                track: trackData.track,
                searchResult: trackData.cached,
                lyrics,
              }
            }
          }
        } catch (error) {
          console.error(
            `❌ Error processing ${trackData.artist} - ${trackData.song}:`,
            error
          )
        }
        return null
      })

      const chunkResults = await Promise.allSettled(chunkPromises)
      const successfulResults = chunkResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
        .filter((result) => result !== null)

      results.push(...successfulResults)

      if (i + parallelLimit < uncachedTracks.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
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
