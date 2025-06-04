const express = require('express')
const { SpotifyAuthService } = require('../services/spotify-auth.js')

const router = express.Router()
const spotifyAuth = new SpotifyAuthService()

router.get('/login', async (req, res) => {
  try {
    console.log('🔐 Login endpoint accessed')
    const authUrl = await spotifyAuth.getAuthUrl(res)
    res.redirect(authUrl)
  } catch (error) {
    console.error('❌ Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/callback', async (req, res) => {
  try {
    const redirectUrl = await spotifyAuth.handleCallback(req, res)
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('❌ Callback error:', error)

    if (error.message === 'direct_access') {
      return res.redirect('/login')
    }

    const frontendUrl = 'http://localhost:8888' // Should come from config
    res.redirect(`${frontendUrl}/#error=${encodeURIComponent(error.message)}`)
  }
})

router.get('/refresh_token', async (req, res) => {
  try {
    const redirectUrl = await spotifyAuth.refreshToken()
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('❌ Refresh token error:', error)
    const frontendUrl = 'http://localhost:8888' // Should come from config
    res.redirect(`${frontendUrl}/#error=refresh_failed`)
  }
})

module.exports = router
