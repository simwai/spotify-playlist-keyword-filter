window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

window.SpotifyPlaylistFilter.config = {
  spotify: {
    apiBaseUrl: 'https://api.spotify.com/v1',
    batchSize: {
      processing: 10,
      adding: 100,
      fetching: 50,
    },
  },
  api: {
    baseUrl: window.location.origin,
  },
  ui: {
    animationDelay: 300,
  },
}
