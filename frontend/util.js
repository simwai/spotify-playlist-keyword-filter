window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

const parseUrlHash = () => {
  return window.location.hash
    .substring(1)
    .split('&')
    .reduce((param, item) => {
      const [key, value] = item.split('=')
      if (key && value) {
        param[key] = decodeURIComponent(value)
      }
      return param
    }, {})
}

const clearUrlHash = () => {
  window.location.hash = ''
}

const isValidSpotifyUri = (uri) => {
  if (!uri || typeof uri !== 'string') {
    console.warn('❌ Invalid URI: not a string or null/undefined:', uri)
    return false
  }

  const spotifyUriPattern = /^spotify:track:[A-Za-z0-9]{22}$/
  const isValid = spotifyUriPattern.test(uri)

  if (!isValid) {
    console.warn('❌ Invalid Spotify URI format:', uri)
    if (!uri.startsWith('spotify:track:')) {
      console.warn('  → URI does not start with "spotify:track:"')
    } else {
      const trackId = uri.replace('spotify:track:', '')
      console.warn(
        `  → Track ID "${trackId}" has length ${trackId.length} (expected 22)`
      )
    }
  }

  return isValid
}

const safeSessionStorage = () => {
  const canUse = (() => {
    try {
      sessionStorage.setItem('test', 'test')
      sessionStorage.removeItem('test')
      return true
    } catch (e) {
      return false
    }
  })()

  return {
    setItem: (key, value) => {
      if (canUse) {
        try {
          sessionStorage.setItem(key, value)
        } catch (e) {
          console.warn(`Failed to store ${key} in sessionStorage`, e)
        }
      }
    },
    getItem: (key) => {
      if (canUse) {
        try {
          return sessionStorage.getItem(key)
        } catch (e) {
          console.warn(`Could not access sessionStorage for ${key}:`, e)
          return null
        }
      }
      return null
    },
    removeItem: (key) => {
      if (canUse) {
        try {
          sessionStorage.removeItem(key)
        } catch (e) {
          console.warn(`Failed to remove ${key} from sessionStorage`, e)
        }
      }
    },
  }
}

window.SpotifyPlaylistFilter.util = {
  parseUrlHash,
  clearUrlHash,
  isValidSpotifyUri,
  safeSessionStorage,
}
