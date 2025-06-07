const express = require('express')
const config = require('../config/index.js')
const { TYPES } = require('../types.js')

module.exports = (container) => {
  const router = express.Router()
  const spotifyAuth = container.get(TYPES.SpotifyAuthService)

  const buildErrorRedirect = (errorMessage) => {
    const baseUrl = config.spotify.redirectUri || 'http://localhost:8888'

    return `${baseUrl}/#error=${encodeURIComponent(errorMessage)}`
  }

  router.get('/login', async (req, res) => {
    try {
      console.log('🔐 Login endpoint accessed')
      console.log('🍪 Existing cookies:', req.cookies)

      const authUrl = await spotifyAuth.getAuthUrl(res)
      console.log('🔗 Auth URL generated:', authUrl)

      res.redirect(authUrl)
    } catch (loginError) {
      console.error('Login failed:', loginError)
      res.redirect(buildErrorRedirect('Login failed'))
    }
  })

  router.get('/callback', async (req, res) => {
    try {
      console.log('Callback endpoint accessed')
      const redirectUrl = await spotifyAuth.handleCallback(req, res)

      console.log('Callback successful')
      res.redirect(redirectUrl)
    } catch (callbackError) {
      console.error('Callback failed:', callbackError)
      res.redirect(buildErrorRedirect('Authentication failed'))
    }
  })

  router.get('/refresh_token', async (req, res) => {
    try {
      console.log('Refresh token endpoint accessed')
      const redirectUrl = await spotifyAuth.refreshAccessToken()
      res.redirect(redirectUrl)
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError)
      res.redirect(buildErrorRedirect('Token refresh failed'))
    }
  })

  return router
}
