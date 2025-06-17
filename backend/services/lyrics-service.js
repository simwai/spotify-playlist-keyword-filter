class LyricsService {
  constructor(geniusClient, lyricsExtractor, httpClient, logger, lyricsModel) {
    if (!geniusClient) {
      throw new Error('No genius client provided to LyricsService!')
    }

    if (!lyricsExtractor) {
      throw new Error('No lyrics extractor provided to LyricsService!')
    }

    if (!httpClient) {
      throw new Error('No http client provided to LyricsService!')
    }

    if (!logger) {
      throw new Error('No logger provided to LyricsService!')
    }

    if (!lyricsModel) {
      throw new Error('No lyrics cache model provided to LyricsService!')
    }

    this.geniusClient = geniusClient
    this.lyricsExtractor = lyricsExtractor
    this.httpClient = httpClient
    this.logger = logger
    this.lyricsModel = lyricsModel
  }

  async * processTracksBatch(tracks) {
    const BATCH_SIZE = 10

    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const batch = tracks.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((track) => this._processTrack(track))
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          yield result.value
        } else if (result.status === 'rejected') {
          this.logger.warn(result.reason)
        }
      }
    }
  }

  async searchSong(artist, song) {
    // Try to find songId in cache first
    try {
      const cachedEntry = await this.lyricsModel.findOne({
        where: {
          artist: artist.trim(),
          song: song.trim(),
        },
      })

      if (cachedEntry?.songId) {
        this.logger.log(`📦 Cache hit for song search: ${artist} - ${song}`)
        return {
          songId: cachedEntry.songId,
          title: song,
          artist: artist,
        }
      }
    } catch (error) {
      this.logger.error('Error checking song cache:', error)
    }

    // If not in cache, search with Genius API
    this.logger.log(`🔍 Searching Genius for: ${artist} - ${song}`)
    const queries = [
      `${song} ${artist}`,
      `${song.replace(/\s*\([^)]*\)/g, '')} ${artist}`,
      `${artist} ${song}`,
      song,
    ]

    for (const query of queries) {
      const result = await this.geniusClient.search(query)
      if (result) {
        // Save to cache for future lookups
        try {
          await this.lyricsModel.upsert({
            songId: result.id,
            artist: artist.trim(),
            song: song.trim(),
            timestamp: new Date(),
          })
        } catch (error) {
          this.logger.error('Error caching song search result:', error)
        }

        return {
          songId: result.id,
          title: result.title,
          artist: result.artist,
        }
      }
    }

    // Nothing found - cache the miss
    try {
      await this.lyricsModel.upsert({
        songId: 'unknown',
        artist: artist.trim(),
        song: song.trim(),
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error('Error caching song search miss:', error)
    }

    return null
  }

  async _processTrack(track) {
    // Check if we have lyrics in the cache
    try {
      const cachedEntry = await this.lyricsModel.findOne({
        where: {
          artist: track.artist.trim(),
          song: track.song.trim(),
        },
      })

      if (cachedEntry?.lyrics) {
        this.logger.log(
          `📦 Cache hit for lyrics: ${track.artist} - ${track.song}`
        )
        return { track, lyrics: cachedEntry.lyrics }
      }

      // If we have a cache entry but no lyrics, it means we previously couldn't find lyrics
      if (cachedEntry && cachedEntry.lyrics === null) {
        this.logger.log(
          `📦 Cache hit (no lyrics): ${track.artist} - ${track.song}`
        )
        return null
      }
    } catch (error) {
      this.logger.error('Error checking lyrics cache:', error)
    }

    // Not in cache, proceed with normal search and fetch
    this.logger.log(
      `🔍 Fetching fresh lyrics for: ${track.artist} - ${track.song}`
    )
    const searchResult = await this.searchSong(track.artist, track.song)
    if (!searchResult?.songId) {
      return null
    }

    const lyrics = await this._fetchLyricsFromGenius(searchResult.songId)

    // Cache the result regardless of whether lyrics were found
    try {
      await this.lyricsModel.upsert({
        songId: searchResult.songId,
        artist: track.artist.trim(),
        song: track.song.trim(),
        lyrics: lyrics,
        timestamp: new Date(),
      })
      this.logger.log(`💾 Cached lyrics for: ${track.artist} - ${track.song}`)
    } catch (error) {
      this.logger.error('Error caching lyrics:', error)
    }

    if (!lyrics) {
      return null
    }

    return { track, lyrics }
  }

  async _fetchLyricsFromGenius(songId) {
    const songInfo = await this.geniusClient.getSong(songId)
    if (!songInfo?.url) {
      return null
    }

    const response = await this.httpClient.get(songInfo.url)
    return this.lyricsExtractor.extract(response.body)
  }
}

module.exports = LyricsService
module.exports.default = LyricsService
module.exports.LyricsService = LyricsService
