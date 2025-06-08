const { SpotifyApiClient } = require('../clients/spotify-api.js')

const { SpotifyAuthService } = require('../services/spotify-auth.js')

const validateDependencies = () => {
  const requiredModules = [
    { path: '../services/spotify-auth.js', export: 'SpotifyAuthService' },
    { path: '../clients/spotify-api.js', export: 'SpotifyApiClient' },
  ]

  const optionalModules = [
    { path: '../services/lyrics.js', export: 'LyricsService' },
    { path: '../clients/genius-api.js', export: 'GeniusApiClient' },
    { path: '../utils/lyrics-extractor.js', export: 'LyricsExtractor' },
    { path: '../utils/cache-key-generator.js', export: 'CacheKeyGenerator' },
  ]

  const missingModules = []

  for (const module of requiredModules) {
    try {
      const moduleExports = require(module.path)
      if (!moduleExports[module.export]) {
        missingModules.push(`${module.path} - missing export: ${module.export}`)
      }
    } catch (error) {
      missingModules.push(`${module.path} - ${error.message}`)
    }
  }

  for (const module of optionalModules) {
    try {
      const moduleExports = require(module.path)
      if (!moduleExports[module.export]) {
        console.warn(
          `⚠️ Optional module missing: ${module.path} - ${module.export}`
        )
      }
    } catch (error) {
      console.warn(
        `⚠️ Optional module not found: ${module.path} - ${error.message}`
      )
    }
  }

  if (missingModules.length > 0) {
    throw new Error(`Missing required modules:\n${missingModules.join('\n')}`)
  }
}

const setupContainer = () => {
  console.log('🔧 Setting up simplified container...')

  try {
    validateDependencies()
    const container = {
      spotifyAuth: null,
      lyricsService: null,

      createSpotifyClient: (accessToken, refreshToken) => {
        return new SpotifyApiClient(accessToken, refreshToken)
      },

      init() {
        this.spotifyAuth = new SpotifyAuthService()

        try {
          const { LyricsService } = require('../services/lyrics.js')
          const { GeniusApiClient } = require('../clients/genius-api.js')
          const { LyricsExtractor } = require('../utils/lyrics-extractor.js')
          const {
            CacheKeyGenerator,
          } = require('../utils/cache-key-generator.js')

          const geniusClient = new GeniusApiClient()
          const lyricsExtractor = new LyricsExtractor()
          const cacheKeyGenerator = new CacheKeyGenerator()

          this.lyricsService = new LyricsService(
            geniusClient,
            lyricsExtractor,
            cacheKeyGenerator
          )
          console.log('✅ Lyrics service initialized')
        } catch (error) {
          console.warn('⚠️ Lyrics service not available:', error.message)
        }

        return this
      },
      get(serviceType) {
        switch (serviceType) {
          case 'SpotifyAuthService':
            return this.spotifyAuth
          case 'LyricsService':
            return this.lyricsService
          default:
            throw new Error(`Unknown service type: ${serviceType}`)
        }
      },
    }

    container.init()

    console.log('✅ Container setup completed successfully')

    console.log(
      '📋 Available services:',
      Object.keys(container).filter(
        (key) => typeof container[key] !== 'function'
      )
    )

    return container
  } catch (error) {
    console.error('❌ Container setup failed:', error.message)
    throw new Error(`Container initialization failed: ${error.message}`)
  }
}

module.exports = { setupContainer }
