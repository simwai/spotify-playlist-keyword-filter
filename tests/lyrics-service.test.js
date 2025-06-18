const { LyricsService } = require('../backend/services/lyrics-service.js')

const makeLyricsModel = ({ cachedRow = null, upsertError = null } = {}) => ({
  findOne: jest.fn().mockResolvedValue(cachedRow),
  upsert: jest.fn().mockImplementation(() => {
    if (upsertError) {
      throw upsertError
    }
    return Promise.resolve()
  }),
})

const makeMocks = () => ({
  genius: { search: jest.fn(), getSong: jest.fn() },
  extractor: { extract: jest.fn() },
  http: { get: jest.fn() },
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
})

describe('LyricsService – critical workflows', () => {
  const track = { artist: 'Artist', song: 'Song', uri: 'uri', spotifyId: 'id' }

  it('throws when dependencies missing', () => {
    const { extractor, http, logger } = makeMocks()
    const model = makeLyricsModel()

    expect(
      () => new LyricsService(null, extractor, http, logger, model)
    ).toThrow('No genius client provided')
  })

  it('yields cached lyrics (fast path)', async () => {
    const model = makeLyricsModel({ cachedRow: { lyrics: 'cached lyrics' } })
    const mocks = makeMocks()
    const service = new LyricsService(
      mocks.genius,
      mocks.extractor,
      mocks.http,
      mocks.logger,
      model
    )

    const results = await collectAsyncGenerator(
      service.processTracksBatch([track])
    )

    expect(results).toEqual([{ track, lyrics: 'cached lyrics' }])
    expect(mocks.genius.search).not.toHaveBeenCalled()
  })

  it('fetches and caches when not found', async () => {
    const model = makeLyricsModel()
    const mocks = makeMocks()

    mocks.genius.search.mockResolvedValue({
      id: 99,
      title: 'Song',
      artist: 'Artist',
    })
    mocks.genius.getSong.mockResolvedValue({ url: 'http://lyrics-url' })
    mocks.http.get.mockResolvedValue({
      body: '<div data-lyrics-container="true">Fresh lyrics</div>',
    })
    mocks.extractor.extract.mockReturnValue('Fresh lyrics')

    const service = new LyricsService(
      mocks.genius,
      mocks.extractor,
      mocks.http,
      mocks.logger,
      model
    )

    const results = await collectAsyncGenerator(
      service.processTracksBatch([track])
    )

    expect(results).toEqual([{ track, lyrics: 'Fresh lyrics' }])
    expect(model.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        songId: 99,
        artist: 'Artist',
        song: 'Song',
        lyrics: 'Fresh lyrics',
      })
    )
  })

  it('handles search failures gracefully', async () => {
    const model = makeLyricsModel()
    const mocks = makeMocks()

    mocks.genius.search.mockResolvedValue(null) // No results

    const service = new LyricsService(
      mocks.genius,
      mocks.extractor,
      mocks.http,
      mocks.logger,
      model
    )

    const results = await collectAsyncGenerator(
      service.processTracksBatch([track])
    )

    expect(results).toEqual([]) // No results yielded
  })
})
