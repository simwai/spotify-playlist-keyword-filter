const he = require('he')
const { got } = require('got-cjs')

const { LyricsService } = require('./services/lyrics-service.js')
const { GeniusApiClient } = require('./clients/genius-api.js')
const { LyricsExtractor } = require('./utils/lyrics-extractor.js')
const config = require('./config/index.js')
const { SpotifyAuthService } = require('./services/spotify-auth-service.js')
const { SpotifyApiClient } = require('./clients/spotify-api.js')
const LyricsCache = require('./cache/lyrics-cache-model.js')

const httpClient = got.extend({
  headers: {
    'Accept-Encoding': 'br, gzip, deflate',
  },
  decompress: true,
})

async function createContainer() {
  const utils = await import('@simwai/utils')
  const ConsoleLogger = utils.ConsoleLogger

  const logger = new ConsoleLogger({ isTimeEnabled: true })
  const geniusClient = new GeniusApiClient(logger, httpClient, config)
  const lyricsExtractor = new LyricsExtractor(he, logger)

  const lyricsService = new LyricsService(
    geniusClient,
    lyricsExtractor,
    httpClient,
    logger,
    LyricsCache
  )

  const spotifyAuthService = new SpotifyAuthService(logger, config, httpClient)

  const spotifyClient = (
    accessToken = null,
    refreshToken = null,
    clientId = null,
    clientSecret = null
  ) => {
    return new SpotifyApiClient(
      httpClient,
      config,
      accessToken,
      refreshToken,
      clientId,
      clientSecret
    )
  }

  const container = {
    lyricsService,
    logger,
    config,
    spotifyAuthService,
    spotifyClient,
    httpClient,
  }

  return container
}

module.exports.createContainer = createContainer
