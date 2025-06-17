const express = require('express')

module.exports = (container) => {
  const router = express.Router()
  const spotifyAuth = container.spotifyAuthService
  const logger = container.logger

  const buildErrorRedirect = (errorMessage) => {
    const baseUrl = container.config.app.frontendUrl

    return `${baseUrl}/#error=${encodeURIComponent(errorMessage)}`
  }

  router.get('/login', async (req, res) => {
    try {
      logger.log('🔐 Login endpoint accessed')
      logger.log('🍪 Existing cookies:', req.cookies)

      const authUrl = await spotifyAuth.getAuthUrl(res)
      logger.log('🔗 Auth URL generated:', authUrl)

      res.redirect(authUrl)
    } catch (loginError) {
      logger.error('Login failed:', loginError)
      res.redirect(buildErrorRedirect('Login failed'))
    }
  })

  router.get('/callback', async (req, res) => {
    try {
      logger.log('Callback endpoint accessed')
      const redirectUrl = await spotifyAuth.handleCallback(req, res)

      logger.log('Callback successful')
      res.redirect(redirectUrl)
    } catch (callbackError) {
      logger.error('Callback failed:', callbackError)
      res.redirect(buildErrorRedirect('Authentication failed'))
    }
  })

  router.get('/refresh_token', async (_req, res) => {
    try {
      logger.log('Refresh token endpoint accessed')
      const redirectUrl = await spotifyAuth.refreshAccessToken()
      res.redirect(redirectUrl)
    } catch (refreshError) {
      logger.error('Token refresh failed:', refreshError)
      res.redirect(buildErrorRedirect('Token refresh failed'))
    }
  })

  return router
}
