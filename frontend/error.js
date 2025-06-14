window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class SpotifyApiError extends Error {
  constructor(message, status, originalError) {
    super(message)
    this.name = 'SpotifyApiError'
    this.status = status
    this.originalError = originalError
  }
}

class LyricApiError extends Error {
  constructor(message, originalError) {
    super(message)
    this.name = 'LyricApiError'
    this.originalError = originalError
  }
}

class PlaylistError extends Error {
  constructor(message, originalError) {
    super(message)
    this.name = 'PlaylistError'
    this.originalError = originalError
  }
}

window.SpotifyPlaylistFilter.SpotifyApiError = SpotifyApiError
window.SpotifyPlaylistFilter.LyricApiError = LyricApiError
window.SpotifyPlaylistFilter.PlaylistError = PlaylistError
