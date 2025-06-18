const { LyricsExtractor } = require('../backend/utils/lyrics-extractor.js')

describe('LyricsExtractor – expected behaviour', () => {
  it('throws when dependencies missing (constructor validation)', () => {
    expect(() => new LyricsExtractor(null, {})).toThrow('No he provided')
    expect(() => new LyricsExtractor({}, null)).toThrow('No logger provided')
  })

  it('returns cleaned text from Genius HTML snippet', () => {
    const he = { decode: (s) => s }
    const logger = { log: jest.fn(), error: jest.fn() }
    const extractor = new LyricsExtractor(he, logger)

    const html = `
      <div data-lyrics-container="true">
        <p>Hello <i>darkness</i> my old friend</p><br/>
        <p>I've come to talk with you again</p>
      </div>`

    const result = extractor.extract(html)
    expect(result).toContain('Hello darkness my old friend')
    expect(result).toContain("I've come to talk with you again")
  })

  it('returns null when no lyrics container found', () => {
    const he = { decode: (s) => s }
    const logger = { log: jest.fn(), error: jest.fn() }
    const extractor = new LyricsExtractor(he, logger)

    expect(extractor.extract('<html><div>no lyrics</div></html>')).toBeNull()
  })
})
