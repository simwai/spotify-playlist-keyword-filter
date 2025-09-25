const he = require('he')
const { ConsoleLogger } = require('@simwai/utils/build/node/index.cjs')

const { LyricsService } = require('./services/lyrics-service.js')
const { GeniusApiClient } = require('./clients/genius-api.js')
const { LyricsExtractor } = require('./utils/lyrics-extractor.js')
const config = require('./config/index.js')
const { SpotifyAuthService } = require('./services/spotify-auth-service.js')
const { SpotifyApiClient } = require('./clients/spotify-api.js')
const { got } = require('got-cjs')

const httpClient = got
const logger = new ConsoleLogger({ isTimeEnabled: true })
const geniusClient = new GeniusApiClient(logger, httpClient, config)
const lyricsExtractor = new LyricsExtractor(he, logger)
const LyricsCache = require('./cache/lyrics-cache-model.js')
const lyricsService = new LyricsService(geniusClient, lyricsExtractor, httpClient, logger, LyricsCache)
const spotifyAuthService = new SpotifyAuthService(logger, config, httpClient)
const spotifyApiClient = new SpotifyApiClient(httpClient, config)

const container = {
  lyricsService,
  logger,
  config,
  spotifyAuthService,
  spotifyApiClient,
  httpClient,
}

module.exports.container = container
