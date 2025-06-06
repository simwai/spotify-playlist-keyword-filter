const { TYPES } = require('../types.js')
const { SimpleContainer } = require('./simple-container.js')

const validateDependencies = () => {
  const requiredModules = [
    { path: '../services/spotify-auth.js', export: 'SpotifyAuthService' },
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

  if (missingModules.length > 0) {
    throw new Error(`Missing required modules:\n${missingModules.join('\n')}`)
  }
}

const setupContainer = () => {
  console.log('🔧 Setting up dependency injection container...')

  try {
    validateDependencies()

    const container = new SimpleContainer()

    const { SpotifyAuthService } = require('../services/spotify-auth.js')
    const { LyricsService } = require('../services/lyrics.js')
    const { GeniusApiClient } = require('../clients/genius-api.js')
    const { LyricsExtractor } = require('../utils/lyrics-extractor.js')
    const { CacheKeyGenerator } = require('../utils/cache-key-generator.js')

    console.log(`🔗 Binding services with TYPES:`, Object.keys(TYPES))

    container
      .bind(TYPES.SpotifyAuthService)
      .to(SpotifyAuthService)
      .inSingletonScope()

    container.bind(TYPES.LyricsExtractor).to(LyricsExtractor).inSingletonScope()

    container
      .bind(TYPES.CacheKeyGenerator)
      .to(CacheKeyGenerator)
      .inSingletonScope()

    container.bind(TYPES.GeniusApiClient).to(GeniusApiClient).inSingletonScope()
    container
      .bind(TYPES.LyricsService)
      .toDynamicValue(() => {
        const geniusClient = container.get(TYPES.GeniusApiClient)
        const lyricsExtractor = container.get(TYPES.LyricsExtractor)
        const cacheKeyGenerator = container.get(TYPES.CacheKeyGenerator)
        return new LyricsService(
          geniusClient,
          lyricsExtractor,
          cacheKeyGenerator
        )
      })
      .inSingletonScope()

    container.validateBindings()

    console.log('✅ Container setup completed successfully')
    console.log(
      `📋 Registered services: [${container.listServices().join(', ')}]`
    )

    return container
  } catch (error) {
    console.error('❌ Container setup failed:', error.message)
    throw new Error(`Container initialization failed: ${error.message}`)
  }
}

module.exports = { setupContainer }
