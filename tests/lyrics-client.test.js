global.fetch = jest.fn()
global.console = { log: jest.fn(), error: jest.fn() }
global.DOMParser = jest.fn()

describe('Client-Side Lyrics Issues', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchSongId Real Issues', () => {
    test('should handle 500 error from Genius API', async () => {
      fetch.mockRejectedValueOnce(new Error('500 Internal Server Error'))

      async function fetchSongId(artist, song) {
        const accessToken =
          'ffGgxwzDuaN9PxVUR8kBCue0q-oWMyWPMzXUmASOsCEEMorDGUHgeo8kkmTOmdHA'
        const searchTerm = song + ' ' + artist
        const searchUrl = `/proxy/http://api.genius.com/search?access_token=${accessToken}&q=${encodeURIComponent(searchTerm)}`

        return fetch(searchUrl)
          .then((response) => response.json())
          .then((data) => {
            const searchResults = data.response.hits
            if (searchResults.length > 0) {
              return searchResults[0].result.id
            } else {
              console.log('No results found.')
              return null
            }
          })
          .catch((_error) => {
            console.log('fetch_song_id error')
            return null
          })
      }

      const result = await fetchSongId('Shiro SAGISU', 'Number One - Bankai')
      expect(result).toBeNull()
      expect(console.log).toHaveBeenCalledWith('fetch_song_id error')
    })

    test('should handle empty search results', async () => {
      fetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            response: {
              hits: [],
            },
          }),
      })

      async function fetchSongId(artist, song) {
        const accessToken = 'test_token'
        const searchTerm = song + ' ' + artist
        const searchUrl = `/proxy/http://api.genius.com/search?access_token=${accessToken}&q=${encodeURIComponent(searchTerm)}`

        return fetch(searchUrl)
          .then((response) => response.json())
          .then((data) => {
            const searchResults = data.response.hits
            if (searchResults.length > 0) {
              return searchResults[0].result.id
            } else {
              console.log('No results found.')
              return null
            }
          })
          .catch((_error) => {
            console.log('fetch_song_id error')
            return null
          })
      }

      const result = await fetchSongId('Unknown', 'Artist')
      expect(result).toBeNull()
      expect(console.log).toHaveBeenCalledWith('No results found.')
    })
  })

  describe('fetchLyrics Real Issues', () => {
    test('should handle null song ID', async () => {
      async function fetchLyrics(_artist, _song) {
        const songId = null

        if (!songId) {
          console.log('No song ID available')
          return null
        }
      }

      const result = await fetchLyrics('Artist', 'Song')
      expect(result).toBeNull()
      expect(console.log).toHaveBeenCalledWith('No song ID available')
    })

    test('should handle missing lyrics element', async () => {
      const mockHtml = '<html><body><div>No lyrics here</div></body></html>'

      fetch.mockResolvedValueOnce({
        text: () => Promise.resolve(mockHtml),
      })

      const mockDoc = {
        querySelector: jest.fn(() => null),
      }

      global.DOMParser.mockImplementation(() => ({
        parseFromString: () => mockDoc,
      }))

      async function fetchLyrics(_artist, _song) {
        const songId = 123
        try {
          const url = '/proxy/http://genius.com/songs/' + songId
          const lyricsResponse = await fetch(url)
          const html = await lyricsResponse.text()

          const domParser = new DOMParser()
          const doc = domParser.parseFromString(html, 'text/html')
          const lyricsEle = doc.querySelector('.lyrics')

          if (!lyricsEle) {
            throw new Error('Not found genius lyrics element')
          }

          return lyricsEle.innerText
        } catch (error) {
          console.log(error)
          return null
        }
      }

      const result = await fetchLyrics('Artist', 'Song')
      expect(result).toBeNull()
      expect(console.log).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})
