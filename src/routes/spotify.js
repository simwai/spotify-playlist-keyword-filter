const express = require('express')

class SpotifyRoutes {
  constructor(container) {
    this.container = container
  }

  async getUserProfile(req, res) {
    try {
      const { access_token, refresh_token } = req.query
      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' })
      }

      const spotifyClient = this.container.spotifyClient(
        access_token,
        refresh_token
      )
      const profile = await spotifyClient.getUserProfile()

      res.json(profile)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async getPlaylists(req, res) {
    try {
      const { access_token, refresh_token, limit = 50, offset = 0 } = req.query
      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' })
      }

      const spotifyClient = this.container.spotifyClient(
        access_token,
        refresh_token
      )
      const playlists = await spotifyClient.getUserPlaylists(
        parseInt(limit),
        parseInt(offset)
      )

      res.json(playlists)
    } catch (error) {
      console.error('Error fetching playlists:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async getPlaylistTracks(req, res) {
    try {
      const {
        access_token,
        refresh_token,
        limit = 50,
        offset = 0,
        fields,
      } = req.query
      const { id } = req.params

      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' })
      }

      const spotifyClient = this.container.spotifyClient(
        access_token,
        refresh_token
      )
      const tracks = await spotifyClient.getPlaylistTracks(
        id,
        parseInt(limit),
        parseInt(offset),
        fields
      )

      res.json(tracks)
    } catch (error) {
      console.error('Error fetching playlist tracks:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async createPlaylist(req, res) {
    try {
      const { access_token, refresh_token } = req.query
      const { userId, name, description, public: isPublic } = req.body

      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' })
      }

      const spotifyClient = this.container.spotifyClient(
        access_token,
        refresh_token
      )
      const playlist = await spotifyClient.createPlaylist(
        userId,
        name,
        description,
        isPublic
      )

      res.json(playlist)
    } catch (error) {
      console.error('Error creating playlist:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async addTracksToPlaylist(req, res) {
    try {
      const { access_token, refresh_token } = req.query
      const { id } = req.params
      const { uris } = req.body

      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' })
      }

      const spotifyClient = this.container.spotifyClient(
        access_token,
        refresh_token
      )
      const result = await spotifyClient.addTracksToPlaylist(id, uris)

      res.json(result)
    } catch (error) {
      console.error('Error adding tracks to playlist:', error)
      res.status(500).json({ error: error.message })
    }
  }

  getRouter() {
    const router = express.Router()

    router.get('/user-profile', this.getUserProfile.bind(this))
    router.get('/playlists', this.getPlaylists.bind(this))
    router.get('/playlist/:id/tracks', this.getPlaylistTracks.bind(this))
    router.post('/playlists', this.createPlaylist.bind(this))
    router.post('/playlist/:id/tracks', this.addTracksToPlaylist.bind(this))

    return router
  }
}

module.exports = {
  SpotifyRoutes: (container) => new SpotifyRoutes(container).getRouter(),
}
