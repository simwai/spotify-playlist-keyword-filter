const he = require('he')

class LyricsExtractor {
  extract(html) {
    try {
      console.log('🔍 Extracting lyrics using data-lyrics-container...')

      const regex = /<div[^>]*data-lyrics-container="true"[^>]*>(.*?)<\/div>/gs
      const matches = html.match(regex)

      if (!matches || matches.length === 0) {
        console.log('❌ No lyrics found with data-lyrics-container')
        return null
      }

      console.log(`✅ Found ${matches.length} lyrics containers`)

      let allLyrics = ''

      for (const [index, match] of matches.entries()) {
        console.log(`Processing container ${index + 1}...`)
        const lyrics = this._extractLyricsFromContainer(match)

        if (lyrics && lyrics.length > 20) {
          allLyrics += lyrics + '\n\n'
        }
      }

      if (allLyrics.trim().length > 50) {
        console.log('✅ Successfully extracted lyrics!')
        console.log('📄 Lyrics preview:', allLyrics.substring(0, 200) + '...')
        return allLyrics.trim()
      }

      console.log('❌ No sufficient lyrics content found')
      return null
    } catch (error) {
      console.error('💥 Error extracting lyrics:', error)
      return null
    }
  }

  _extractLyricsFromContainer(match) {
    const contentMatch = match.match(
      /<div[^>]*data-lyrics-container="true"[^>]*>(.*)<\/div>/s
    )

    if (!contentMatch || !contentMatch[1]) {
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

    return he.decode(lyrics)
  }
}

module.exports = { LyricsExtractor }
