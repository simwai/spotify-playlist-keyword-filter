class GeniusApiClient {
  constructor(logger, httpClient, config) {
    if (!logger) {
      throw new Error('No logger provided to GeniusApiClient!')
    }

    if (!httpClient) {
      throw new Error('No http client provided to GeniusApiClient!')
    }

    if (!config) {
      throw new Error('No config provided to GeniusApiClient!')
    }

    this.logger = logger
    this.httpClient = httpClient
    this.config = config

    this.tokenExpiry = null
  }

  async search(query) {
    this.accessToken = await this._getAccessToken()
    const response = await this.httpClient('https://api.genius.com/search', {
      searchParams: { q: query },
      headers: { Authorization: `Bearer ${this.accessToken}` },
      responseType: 'json',
    })

    if (response.body?.response?.hits?.length > 0) {
      const hit = response.body.response.hits[0].result
      return {
        id: hit.id,
        title: hit.title,
        artist: hit.primary_artist.name,
      }
    }

    return null
  }

  async getSong(songId) {
    const response = await this.httpClient(`https://api.genius.com/songs/${songId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      responseType: 'json',
    })

    return response.body.response.song
  }

  async _getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    this.logger.log('Getting new Genius access token...')

    const authString = `${this.config.genius.clientId}:${this.config.genius.clientSecret}`
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`

    const response = await this.httpClient.post('https://api.genius.com/oauth/token', {
      form: {
        grant_type: 'client_credentials',
      },
      headers: {
        Authorization: authHeader,
      },
      responseType: 'json',
    })

    this.accessToken = response.body.access_token
    this.tokenExpiry = Date.now() + 50 * 60 * 1000 // 50 minutes

    return this.accessToken
  }
}

module.exports = GeniusApiClient
module.exports.default = GeniusApiClient
module.exports.GeniusApiClient = GeniusApiClient
