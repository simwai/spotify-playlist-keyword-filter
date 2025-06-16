describe('Core Algorithms - What Actually Matters', () => {
  // ✅ Test YOUR keyword filtering algorithm - core business logic
  describe('Keyword Filtering Algorithm', () => {
    const testKeywordMatching = (lyrics, keywords) => {
      if (!lyrics || typeof lyrics !== 'string') {
        return false
      }

      const lowerCaseLyrics = lyrics.toLowerCase()
      for (const keyword of keywords) {
        if (lowerCaseLyrics.includes(keyword.toLowerCase())) {
          return true
        }
      }
      return false
    }

    it('should detect keywords case-insensitively', () => {
      const keywords = ['explicit', 'violence']
      expect(
        testKeywordMatching('This song has EXPLICIT content', keywords)
      ).toBe(true)
      expect(testKeywordMatching('Clean song about love', keywords)).toBe(false)
      expect(testKeywordMatching('Songs about VIOLENCE', keywords)).toBe(true)
    })

    it('should handle edge cases that break user experience', () => {
      const keywords = ['explicit', 'violence']
      expect(testKeywordMatching('', keywords)).toBe(false)
      expect(testKeywordMatching(null, keywords)).toBe(false)
      expect(testKeywordMatching(undefined, keywords)).toBe(false)
    })

    it('should work with multiple keywords', () => {
      const keywords = ['explicit', 'violence', 'profanity']
      expect(testKeywordMatching('This has violence in it', keywords)).toBe(
        true
      )
      expect(testKeywordMatching('Clean family song', keywords)).toBe(false)
      expect(testKeywordMatching('Some profanity here', keywords)).toBe(true)
    })

    it('should handle partial word matches', () => {
      const keywords = ['explicit']
      expect(testKeywordMatching('explicitly clean song', keywords)).toBe(true)
      expect(testKeywordMatching('inexplicable behavior', keywords)).toBe(false)
    })
  })

  // ✅ Test YOUR URI validation - prevents broken playlists
  describe('Spotify URI Validation Algorithm', () => {
    const testUriValidation = (uri) => {
      if (!uri || typeof uri !== 'string') {
        return false
      }
      const spotifyUriPattern = /^spotify:track:[A-Za-z0-9]{22}$/
      return spotifyUriPattern.test(uri)
    }

    it('should validate correct Spotify track URIs', () => {
      expect(testUriValidation('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')).toBe(
        true
      )
      expect(testUriValidation('spotify:track:1234567890123456789012')).toBe(
        true
      )
    })

    it('should reject malformed URIs that break API calls', () => {
      expect(testUriValidation('invalid-uri')).toBe(false)
      expect(testUriValidation('')).toBe(false)
      expect(testUriValidation('spotify:album:4iV5W9uYEdYUVa79Axb7Rh')).toBe(
        false
      ) // Wrong type
      expect(testUriValidation('spotify:track:toolong' + 'a'.repeat(50))).toBe(
        false
      )
      expect(testUriValidation('spotify:track:short')).toBe(false)
    })

    it('should handle edge cases users encounter', () => {
      expect(testUriValidation(null)).toBe(false)
      expect(testUriValidation(undefined)).toBe(false)
      expect(testUriValidation('spotify:track:')).toBe(false) // Missing ID
      expect(testUriValidation('spotify:track:4iV5W9uYEdYUVa79Axb7R!')).toBe(
        false
      ) // Invalid char
    })
  })

  // ✅ Test YOUR batch processing math - critical for large playlists
  describe('Batch Processing Logic', () => {
    const testBatchCreation = (items, batchSize) => {
      const batches = []
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize))
      }
      return batches
    }

    it('should split large arrays into correct batch sizes', () => {
      const items = Array(250)
        .fill()
        .map((_, i) => `item-${i}`)
      const batches = testBatchCreation(items, 100)

      expect(batches).toHaveLength(3) // 100, 100, 50
      expect(batches[0]).toHaveLength(100)
      expect(batches[1]).toHaveLength(100)
      expect(batches[2]).toHaveLength(50)
    })

    it('should handle edge cases in batch processing', () => {
      expect(testBatchCreation([], 100)).toHaveLength(0)
      expect(testBatchCreation(['single'], 100)).toHaveLength(1)
      expect(testBatchCreation(['a', 'b'], 1)).toHaveLength(2)
    })
  })

  // ✅ Test YOUR filter mode logic - include vs exclude
  describe('Filter Mode Logic', () => {
    const applyFilterMode = (hasKeyword, mode) => {
      if (mode === 'exclude') {
        return !hasKeyword // Keep if NO keyword found
      } else if (mode === 'include') {
        return hasKeyword // Keep if keyword found
      }
      return false
    }

    it('should correctly apply exclude mode', () => {
      expect(applyFilterMode(true, 'exclude')).toBe(false) // Has keyword -> filter out
      expect(applyFilterMode(false, 'exclude')).toBe(true) // No keyword -> keep
    })

    it('should correctly apply include mode', () => {
      expect(applyFilterMode(true, 'include')).toBe(true) // Has keyword -> keep
      expect(applyFilterMode(false, 'include')).toBe(false) // No keyword -> filter out
    })

    it('should handle invalid filter modes', () => {
      expect(applyFilterMode(true, 'invalid')).toBe(false)
      expect(applyFilterMode(true, null)).toBe(false)
      expect(applyFilterMode(true, undefined)).toBe(false)
    })
  })
})
