class AuthService {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.userId = null
    this.clientId = null
    this.clientSecret = null

    this._loadStoredTokens()
    this._loadStoredCredentials()
  }

  _loadStoredTokens() {
    try {
      this.accessToken = sessionStorage.getItem('spotify_access_token')
      this.refreshToken = sessionStorage.getItem('spotify_refresh_token')
      this.userId = sessionStorage.getItem('spotify_user_id')
    } catch (error) {
      console.warn('Could not access sessionStorage for tokens:', error)
    }
  }

  _loadStoredCredentials() {
    try {
      this.clientId = localStorage.getItem('spotify_client_id')
      this.clientSecret = localStorage.getItem('spotify_client_secret')
    } catch (error) {
      console.warn('Could not access localStorage for credentials:', error)
    }
  }

  setCredentials(clientId, clientSecret) {
    if (
      !clientId ||
      typeof clientId !== 'string' ||
      clientId.trim().length === 0
    ) {
      throw new Error('Invalid client ID provided')
    }

    if (
      !clientSecret ||
      typeof clientSecret !== 'string' ||
      clientSecret.trim().length === 0
    ) {
      throw new Error('Invalid client secret provided')
    }

    this.clientId = clientId.trim()
    this.clientSecret = clientSecret.trim()

    try {
      localStorage.setItem('spotify_client_id', this.clientId)
      localStorage.setItem('spotify_client_secret', this.clientSecret)
    } catch (error) {
      console.warn('Failed to store credentials in localStorage:', error)
      throw new Error('Failed to save credentials')
    }
  }

  setClientId(clientId) {
    if (
      !clientId ||
      typeof clientId !== 'string' ||
      clientId.trim().length === 0
    ) {
      throw new Error('Invalid client ID provided')
    }

    this.clientId = clientId.trim()

    try {
      localStorage.setItem('spotify_client_id', this.clientId)
    } catch (error) {
      console.warn('Failed to store client ID in localStorage:', error)
      throw new Error('Failed to save client ID')
    }
  }

  getClientId() {
    return this.clientId
  }

  getClientSecret() {
    return this.clientSecret
  }

  hasCredentials() {
    return Boolean(
      this.clientId &&
        this.clientId.trim().length > 0 &&
        this.clientSecret &&
        this.clientSecret.trim().length > 0
    )
  }

  hasClientId() {
    return Boolean(this.clientId && this.clientId.trim().length > 0)
  }

  parseUrlParams() {
    const hashParams = this._parseHashParams()

    this._storeTokensFromParams(hashParams)
    this._clearUrlHash(hashParams)
  }

  isAuthenticated() {
    return Boolean(this.accessToken)
  }

  clearAuthData() {
    this.accessToken = null
    this.refreshToken = null

    this._clearStoredTokens()
  }

  clearCredentials() {
    this.clientId = null
    this.clientSecret = null

    try {
      localStorage.removeItem('spotify_client_id')
      localStorage.removeItem('spotify_client_secret')
    } catch (error) {
      console.warn('Failed to clear credentials from localStorage:', error)
    }
  }

  clearClientId() {
    this.clearCredentials()
  }

  _parseHashParams() {
    const hashString = window.location.hash.substring(1)
    const pairs = hashString.split('&')
    const hashParams = {}

    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key && value) {
        hashParams[key] = decodeURIComponent(value)
      }
    }

    return hashParams
  }

  _storeTokensFromParams(hashParams) {
    if (hashParams.access_token) {
      this.accessToken = hashParams.access_token

      try {
        sessionStorage.setItem('spotify_access_token', this.accessToken)
      } catch (error) {
        console.warn('Failed to store access_token in sessionStorage', error)
      }
    }

    if (hashParams.refresh_token) {
      this.refreshToken = hashParams.refresh_token

      try {
        sessionStorage.setItem('spotify_refresh_token', this.refreshToken)
      } catch (error) {
        console.warn('Failed to store refresh_token in sessionStorage', error)
      }
    }

    if (hashParams.uid) {
      this.userId = hashParams.uid

      try {
        sessionStorage.setItem('spotify_user_id', this.userId)
      } catch (error) {
        console.warn('Failed to store uid in sessionStorage', error)
      }
    }
  }

  _clearUrlHash(hashParams) {
    if (Object.keys(hashParams).length > 0) {
      window.location.hash = ''
    }
  }

  _clearStoredTokens() {
    try {
      sessionStorage.removeItem('spotify_access_token')
      sessionStorage.removeItem('spotify_refresh_token')
      sessionStorage.removeItem('spotify_user_id')
    } catch (error) {
      console.warn('Failed to clear sessionStorage', error)
    }
  }
}

export default AuthService
