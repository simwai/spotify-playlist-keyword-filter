const express = require('ultimate-express')

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
      const { client_id, client_secret } = req.query

      logger.log('🔐 Login endpoint accessed')
      logger.log('🍪 Existing cookies:', req.cookies)
      logger.log('📝 Client ID provided:', client_id?.substring(0, 8) + '...')
      logger.log(
        '📝 Client Secret provided:',
        client_secret?.substring(0, 8) + '...'
      )

      if (
        !client_id ||
        typeof client_id !== 'string' ||
        client_id.trim().length === 0
      ) {
        logger.error('No valid client ID provided in login request')
        return res.redirect(
          buildErrorRedirect('Client ID is required for login')
        )
      }

      if (
        !client_secret ||
        typeof client_secret !== 'string' ||
        client_secret.trim().length === 0
      ) {
        logger.error('No valid client secret provided in login request')
        return res.redirect(
          buildErrorRedirect('Client Secret is required for login')
        )
      }

      if (!/^[a-f0-9]{32}$/i.test(client_id.trim())) {
        logger.error('Invalid client ID format provided:', client_id)
        return res.redirect(buildErrorRedirect('Invalid Client ID format'))
      }

      if (!/^[a-f0-9]{32}$/i.test(client_secret.trim())) {
        logger.error('Invalid client secret format provided:', client_secret)
        return res.redirect(buildErrorRedirect('Invalid Client Secret format'))
      }

      const authUrl = await spotifyAuth.getAuthUrl(
        res,
        client_id.trim(),
        client_secret.trim()
      )
      logger.log('🔗 Auth URL generated:', authUrl?.substring(0, 100) + '...')

      res.redirect(authUrl)
    } catch (loginError) {
      logger.error('Login failed:', loginError)
      res.redirect(buildErrorRedirect('Login failed: ' + loginError.message))
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
      res.redirect(
        buildErrorRedirect('Authentication failed: ' + callbackError.message)
      )
    }
  })

  router.get('/refresh_token', async (req, res) => {
    try {
      const { client_id, client_secret } = req.query

      logger.log('Refresh token endpoint accessed')
      logger.log(
        '📝 Client ID for refresh:',
        client_id?.substring(0, 8) + '...'
      )
      logger.log(
        '📝 Client Secret for refresh:',
        client_secret?.substring(0, 8) + '...'
      )

      if (
        !client_id ||
        typeof client_id !== 'string' ||
        client_id.trim().length === 0
      ) {
        logger.error('No client ID provided for token refresh')
        return res.redirect(
          buildErrorRedirect('Client ID is required for token refresh')
        )
      }

      if (
        !client_secret ||
        typeof client_secret !== 'string' ||
        client_secret.trim().length === 0
      ) {
        logger.error('No client secret provided for token refresh')
        return res.redirect(
          buildErrorRedirect('Client Secret is required for token refresh')
        )
      }

      if (!/^[a-f0-9]{32}$/i.test(client_id.trim())) {
        logger.error('Invalid client ID format for refresh:', client_id)
        return res.redirect(
          buildErrorRedirect('Invalid Client ID format for refresh')
        )
      }

      if (!/^[a-f0-9]{32}$/i.test(client_secret.trim())) {
        logger.error('Invalid client secret format for refresh:', client_secret)
        return res.redirect(
          buildErrorRedirect('Invalid Client Secret format for refresh')
        )
      }

      const redirectUrl = await spotifyAuth.refreshAccessToken(
        client_id.trim(),
        client_secret.trim()
      )
      res.redirect(redirectUrl)
    } catch (refreshError) {
      logger.error('Token refresh failed:', refreshError)
      res.redirect(
        buildErrorRedirect('Token refresh failed: ' + refreshError.message)
      )
    }
  })

  return router
}
