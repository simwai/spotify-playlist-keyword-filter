window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

const searchLyric = async (artist, song) => {
  try {
    const searchResponse = await fetch(
      `${window.SpotifyPlaylistFilter.config.api.baseUrl}/api/lyrics/search?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`
    )

    if (!searchResponse.ok) {
      console.warn(
        `Lyrics search failed for ${artist} - ${song}: ${searchResponse.status}`
      )
      return null
    }

    const searchData = await searchResponse.json()

    if (!searchData.found || !searchData.songId) {
      console.log(`Lyrics not found (search stage) for: ${artist} - ${song}`)
      return null
    }

    const lyricResponse = await fetch(
      `${window.SpotifyPlaylistFilter.config.api.baseUrl}/api/lyrics/${searchData.songId}`
    )

    if (!lyricResponse.ok) {
      console.warn(
        `Fetching lyrics for ID ${searchData.songId} failed: ${lyricResponse.status}`
      )
      return null
    }

    const lyricData = await lyricResponse.json()
    return lyricData.lyrics
  } catch (error) {
    console.error(`Error fetching lyrics for ${artist} - ${song}:`, error)
    throw new window.SpotifyPlaylistFilter.LyricApiError(
      `Failed to fetch lyrics for ${artist} - ${song}`,
      error
    )
  }
}

const processTrackBulk = async (track) => {
  try {
    const response = await fetch(
      `${window.SpotifyPlaylistFilter.config.api.baseUrl}/api/lyrics/bulk-process`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracks: track.map((track) => ({
            name: track.name,
            artists: track.artists,
            uri: track.uri,
            id: track.id,
          })),
        }),
      }
    )

    if (!response.ok) {
      throw new window.SpotifyPlaylistFilter.LyricApiError(
        `Bulk processing failed: ${response.status}`
      )
    }

    return response.json()
  } catch (error) {
    console.error('Bulk processing failed:', error)
    throw new window.SpotifyPlaylistFilter.LyricApiError(
      'Bulk track processing failed',
      error
    )
  }
}

window.SpotifyPlaylistFilter.lyricApi = {
  searchLyric,
  processTrackBulk,
}
