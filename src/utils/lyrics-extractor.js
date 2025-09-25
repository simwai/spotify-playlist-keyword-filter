class LyricsExtractor {
  constructor(he, logger) {
    if (!he) {
      throw new Error('No he provided to LyrcsExtractor!')
    }

    if (!logger) {
      throw new Error('No logger provided to LyricsExtractor!')
    }

    this.he = he
    this.logger = logger
  }

  extract(html) {
    try {
      this.logger.log('🔍 Extracting lyrics using data-lyrics-container...')

      const regex = /<div[^>]*data-lyrics-container="true"[^>]*>(.*?)<\/div>/gs
      const matches = html.match(regex)

      if (!matches) {
        this.logger.log('❌ No lyrics found with data-lyrics-container')
        return null
      }

      this.logger.log(`✅ Found ${matches.length} lyrics containers`)

      let allLyrics = ''

      for (const [index, match] of matches.entries()) {
        this.logger.log(`Processing container ${index + 1}...`)
        const lyrics = this._extractLyricsFromContainer(match)

        if (lyrics && lyrics.length > 20) {
          allLyrics += lyrics + '\n\n'
        }
      }

      if (allLyrics.trim().length > 50) {
        this.logger.log('✅ Successfully extracted lyrics!')
        this.logger.log('📄 Lyrics preview:', allLyrics.substring(0, 200) + '...')
        return allLyrics.trim()
      }

      this.logger.log('❌ No sufficient lyrics content found')
      return null
    } catch (error) {
      this.logger.error('💥 Error extracting lyrics:', error)
      return null
    }
  }

  _extractLyricsFromContainer(match) {
    const contentMatch = match.match(/<div[^>]*data-lyrics-container="true"[^>]*>(.*)<\/div>/s)

    if (!contentMatch?.[1]) {
      return null
    }

    const lyrics = contentMatch[1]
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<i>/gi, '')
      .replace(/<\/i>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim()

    return this.he.decode(lyrics)
  }
}

module.exports = LyricsExtractor
module.exports.default = LyricsExtractor
module.exports.LyricsExtractor = LyricsExtractor
