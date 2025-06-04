const needle = require('needle')
const config = require('../config/index.js')

class GeniusApiClient {
  constructor() {
    this.cachedToken = null
    this.tokenExpiry = null
  }

  async search(query) {
    const accessToken = await this._getAccessToken()
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`

    const response = await needle('get', searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (
      response.statusCode === 200 &&
      response.body?.response?.hits?.length > 0
    ) {
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
    const accessToken = await this._getAccessToken()
    const songUrl = `https://api.genius.com/songs/${songId}`

    const response = await needle('get', songUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (response.statusCode === 200) {
      return response.body.response.song
    }

    return null
  }

  async _getAccessToken() {
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken
    }

    console.log('Getting new Genius access token...')

    const response = await needle(
      'post',
      'https://api.genius.com/oauth/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${config.genius.clientId}:${config.genius.clientSecret}`).toString('base64')}`,
        },
      }
    )

    if (response.statusCode !== 200) {
      throw new Error('Failed to get Genius access token')
    }

    this.cachedToken = response.body.access_token
    this.tokenExpiry = Date.now() + 50 * 60 * 1000 // 50 minutes

    return this.cachedToken
  }
}

module.exports = { GeniusApiClient }
